<script lang="ts">
  import type { UserStatus } from '../../lib/types/api';
  import { logger } from '../../lib/utils/logger';
  import { sanitizeUserId } from '../../lib/utils/sanitizer';
  import { getStatusConfig } from '../../lib/utils/status-config';
  import { userStatusService } from '../../lib/services/user-status-service';

  import Tooltip from './Tooltip.svelte';
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

  let cachedStatus = $state<UserStatus | null>(null);
  let hoverTimeout = $state<ReturnType<typeof setTimeout> | null>(null);

  // Computed values
  const sanitizedUserId = $derived(() => {
    const id = sanitizeUserId(userId);
    return id ? id.toString() : '';
  });

  const statusConfig = $derived(() => getStatusConfig(status, cachedStatus, loading, error));

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

  // Clear hover timeout
  function clearHoverTimeout() {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
  }

  // Handle mouse enter for preview tooltip
  function handleMouseEnter() {
    if (!showTooltips || loading || (!status && !error && !cachedStatus) || showExpandedTooltip) return;
    
    clearHoverTimeout();
    
    hoverTimeout = setTimeout(() => {
      if (!showExpandedTooltip) {
        showPreviewTooltip = true;
      }
    }, 300);
  }

  // Handle mouse leave
  function handleMouseLeave() {
    clearHoverTimeout();
    
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
      clearHoverTimeout();
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
    <Tooltip
      anchorElement={container}
      {error}
      mode="preview"
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
    <Tooltip
      anchorElement={container}
      {error}
      mode="expanded"
      onClose={closeExpandedTooltip}
      onQueue={handleExpandedQueue}
      status={status || cachedStatus}
      {userId}
    />
  </Portal>
{/if} 