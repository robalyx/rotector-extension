<script lang="ts">
  import { STATUS } from '../../lib/types/constants';
  import type { UserStatus } from '../../lib/types/api';
  import { logger } from '../../lib/utils/logger';
  import { sanitizeUserId } from '../../lib/utils/sanitizer';
  import { calculateStatusBadges } from '../../lib/utils/status-utils';
  import { userStatusService } from '../../lib/services/user-status-service';
  import { tooltipManager } from '../../lib/services/tooltip-manager';
  import UserTooltip from './UserTooltip.svelte';
  import ExpandedTooltip from './ExpandedTooltip.svelte';
  import Portal from 'svelte-portal';

  interface Props {
    userId: string | number;
    status?: UserStatus | null;
    loading?: boolean;
    error?: string | null;
    showTooltips?: boolean;
    showText?: boolean;
    skipAutoFetch?: boolean;
    onClick?: (userId: string) => void;
    onQueue?: (userId: string) => void;
  }

  let {
    userId,
    status = null,
    loading = false,
    error = null,
    showTooltips = true,
    showText = true,
    skipAutoFetch = false,
    onClick,
    onQueue
  }: Props = $props();

  // Local state
  let container = $state<HTMLElement>();
  let showPreviewTooltip = $state(false);
  let showExpandedTooltip = $state(false);
  let isTooltipHovered = $state(false);
  let tooltipId = $state<string>(`tooltip-${Math.random().toString(36).substr(2, 9)}`);
  let expandedTooltipId = $state<string>(`expanded-${Math.random().toString(36).substr(2, 9)}`);
  let cachedStatus = $state<UserStatus | null>(null);
  let hoverTimeout = $state<ReturnType<typeof setTimeout> | null>(null);

  // Computed values
  const sanitizedUserId = $derived(() => {
    const id = sanitizeUserId(userId);
    return id ? id.toString() : '';
  });

  const statusConfig = $derived(() => {
    if (error) {
      return {
        iconClass: 'status-icon-error',
        textContent: 'Error',
        textClass: 'status-text-error',
        confidence: null,
        isReportable: false,
        isQueued: false,
        isOutfitOnly: false
      };
    }

    const activeStatus = status || cachedStatus;

    if (loading || !activeStatus) {
      return {
        iconClass: 'status-icon-loading',
        textContent: 'Checking...',
        textClass: '',
        confidence: null,
        isReportable: false,
        isQueued: false,
        isOutfitOnly: false
      };
    }

    const confidence = Math.round(activeStatus.confidence * 100);
    
    const { isReportable, isOutfitOnly } = calculateStatusBadges(activeStatus);

    switch (activeStatus.flagType) {
      case STATUS.FLAGS.SAFE:
        return {
          iconClass: 'status-icon-safe',
          textContent: 'Safe',
          textClass: 'status-text-safe',
          confidence,
          isReportable,
          isQueued: !!activeStatus.isQueued,
          isOutfitOnly
        };
      case STATUS.FLAGS.UNSAFE:
        return {
          iconClass: 'status-icon-unsafe',
          textContent: 'Unsafe',
          textClass: 'status-text-unsafe',
          confidence,
          isReportable,
          isQueued: !!activeStatus.isQueued,
          isOutfitOnly
        };
      case STATUS.FLAGS.PENDING:
        return {
          iconClass: 'status-icon-pending',
          textContent: `Under Review (${confidence}%)`,
          textClass: 'status-text-pending',
          confidence,
          isReportable,
          isQueued: !!activeStatus.isQueued,
          isOutfitOnly
        };
      case STATUS.FLAGS.QUEUED:
        return {
          iconClass: 'status-icon-queued',
          textContent: 'Flagged (Pending)',
          textClass: 'status-text-queued',
          confidence,
          isReportable,
          isQueued: true,
          isOutfitOnly
        };
      default:
        return {
          iconClass: 'status-icon-error',
          textContent: 'Unknown',
          textClass: 'status-text-error',
          confidence,
          isReportable: false,
          isQueued: false,
          isOutfitOnly: false
        };
    }
  });

  // Handle click to show expanded tooltip
  function handleClick(event: MouseEvent | KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (loading || !status) return;

    logger.userAction('status_indicator_clicked', { userId: sanitizedUserId() });

    if (onClick) {
      onClick(sanitizedUserId());
    }

    if (showTooltips) {
      showPreviewTooltip = false;
      showExpandedTooltip = true;
    }
  }

  // Handle keyboard events
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      handleClick(event);
    }
  }

  // Handle mouse enter for preview tooltip
  function handleMouseEnter() {
    if (!showTooltips || loading || (!status && !error && !cachedStatus) || showExpandedTooltip) return;
    
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    
    hoverTimeout = setTimeout(() => {
      if (!showExpandedTooltip) {
        showPreviewTooltip = true;
      }
    }, 300);
  }

  // Handle mouse leave
  function handleMouseLeave() {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    
    requestAnimationFrame(() => {
      if (!isTooltipHovered) {
        showPreviewTooltip = false;
      }
    });
  }

  // Handle tooltip mouse events
  function handleTooltipMouseEnter() {
    isTooltipHovered = true;
  }

  function handleTooltipMouseLeave() {
    isTooltipHovered = false;
    showPreviewTooltip = false;
    tooltipManager.hide(tooltipId);
  }

  // Handle queue action
  function handleQueue() {
    if (onQueue) {
      onQueue(sanitizedUserId());
    }
  }

  // Handle expanded tooltip actions
  function handleExpandedQueue() {
    handleQueue();
    showExpandedTooltip = false;
  }

  // Close expanded tooltip
  function closeExpandedTooltip() {
    showExpandedTooltip = false;
    tooltipManager.hide(expandedTooltipId);
  }

  // Fetch and cache user status
  $effect(() => {
    const id = sanitizedUserId();
    if (!id) return;

    // If no status provided and not loading, check cache or fetch
    if (!status && !loading && !error && !skipAutoFetch) {
      const cached = userStatusService.getCachedStatus(id);
      if (cached) {
        cachedStatus = cached;
        logger.debug('StatusIndicator: using cached status', { 
          userId: id, 
          flagType: cached.flagType 
        });
      } else {
        // Fetch status asynchronously
        userStatusService.getStatus(id).then(result => {
          if (result) {
            cachedStatus = result;
            logger.debug('StatusIndicator: fetched new status', { 
              userId: id, 
              flagType: result.flagType 
            });
          }
        }).catch(err => {
          logger.error('StatusIndicator: failed to fetch status', { userId: id, error: err });
        });
      }
    }
  });


  // Setup hover handlers
  $effect(() => {
    return () => {
      // Cleanup hover timeout on unmount
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
    };
  });

  // Handle tooltip registration
  $effect(() => {
    const id = sanitizedUserId();
    if (!id || !container) return;

    // Register/show preview tooltip
    if (showPreviewTooltip) {
      tooltipManager.register({
        id: tooltipId,
        type: 'preview',
        userId: id,
        element: container,
        priority: 1
      });
      tooltipManager.show(tooltipId);
    } else {
      tooltipManager.hide(tooltipId);
    }

    // Register/show expanded tooltip
    if (showExpandedTooltip) {
      tooltipManager.register({
        id: expandedTooltipId,
        type: 'expanded',
        userId: id,
        element: container,
        priority: 2
      });
      tooltipManager.show(expandedTooltipId);
    } else {
      tooltipManager.hide(expandedTooltipId);
    }

    // Cleanup on unmount
    return () => {
      tooltipManager.unregister(tooltipId);
      tooltipManager.unregister(expandedTooltipId);
    };
  });

  // Listen for escape key to close tooltips
  $effect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showExpandedTooltip) {
          showExpandedTooltip = false;
        } else if (showPreviewTooltip) {
          showPreviewTooltip = false;
        }
      }
    };

    if (showPreviewTooltip || showExpandedTooltip) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  });
</script>

<button
  bind:this={container}
  class="status-container"
  aria-label={showTooltips ? `Status: ${statusConfig().textContent}. Click for details.` : statusConfig().textContent}
  data-status-flag={status?.flagType}
  data-user-id={sanitizedUserId()}
  onclick={handleClick}
  onkeydown={handleKeydown}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  title={showTooltips ? undefined : statusConfig().textContent}
>
  <!-- Status Icon -->
  <div class="{statusConfig().iconClass}">
    {#if statusConfig().isReportable}
      <div class="reportable-badge"></div>
    {/if}

    {#if statusConfig().isQueued}
      <div class="queue-badge"></div>
    {/if}

    {#if statusConfig().isOutfitOnly}
      <div class="outfit-badge"></div>
    {/if}
  </div>

  <!-- Status Text -->
  {#if showText}
    <span class="{statusConfig().textClass}">
      {statusConfig().textContent}
    </span>
  {/if}
</button>

<!-- Preview Tooltip -->
{#if showTooltips && showPreviewTooltip && container}
  <Portal target="#rotector-tooltip-portal">
    <UserTooltip
      anchorElement={container}
      {error}
      onClose={() => showPreviewTooltip = false}
      onExpand={() => { showPreviewTooltip = false; showExpandedTooltip = true; }}
      onMouseEnter={handleTooltipMouseEnter}
      onMouseLeave={handleTooltipMouseLeave}
      onQueue={handleQueue}
      status={status || cachedStatus}
      {userId}
    />
  </Portal>
{/if}

<!-- Expanded Tooltip -->
{#if showExpandedTooltip && container}
  <Portal target="#rotector-tooltip-portal">
    <ExpandedTooltip
      {error}
      onClose={closeExpandedTooltip}
      onQueue={handleExpandedQueue}
      sourceElement={container}
      status={status || cachedStatus}
      {userId}
    />
  </Portal>
{/if} 