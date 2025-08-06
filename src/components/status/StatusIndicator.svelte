<script lang="ts">
    import type {UserStatus} from '@/lib/types/api';
    import {STATUS} from '@/lib/types/constants';
    import {logger} from '@/lib/utils/logger';
    import {sanitizeUserId} from '@/lib/utils/sanitizer';
    import {getStatusConfig} from '@/lib/utils/status-config';
    import {userStatusService} from '@/lib/services/user-status-service';

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
    let showBadgeExpansion = $state(false);

    let cachedStatus = $state<UserStatus | null>(null);
    let hoverTimeout = $state<ReturnType<typeof setTimeout> | null>(null);

    // Computed values
    const sanitizedUserId = $derived(() => {
        const id = sanitizeUserId(userId);
        return id ? id.toString() : '';
    });

    const statusConfig = $derived(() => getStatusConfig(status, cachedStatus, loading, error));

    const integrationCount = $derived(() => {
        const activeStatus = status || cachedStatus;
        return activeStatus?.integrationSources ? Object.keys(activeStatus.integrationSources).length : 0;
    });

    const shouldShowIntegrationBadge = $derived(() => {
        const activeStatus = status || cachedStatus;
        return integrationCount() > 0 && activeStatus?.flagType !== STATUS.FLAGS.INTEGRATION;
    });

    // Compute visible badges in priority order
    const visibleBadges = $derived(() => {
        const badges: string[] = [];
        if (statusConfig().isReportable) badges.push('reportable');
        if (statusConfig().isQueued) badges.push('queue');
        if (shouldShowIntegrationBadge()) badges.push('integration');
        if (statusConfig().isOutfitOnly) badges.push('outfit');
        return badges;
    });

    // Compute stack classes for each badge type
    const badgeStackClasses = $derived(() => {
        const classes: Record<string, string> = {};
        visibleBadges().forEach((badge, index) => {
            classes[badge] = `badge-stack-${index + 1}`;
        });
        return classes;
    });

    // Handle click to show expanded tooltip
    function handleClick(event: MouseEvent | KeyboardEvent) {
        event.preventDefault();
        event.stopPropagation();

        if (loading || !status) return;

        logger.userAction('status_indicator_clicked', {userId: sanitizedUserId()});

        if (onClick) {
            onClick(sanitizedUserId());
        }

        if (showTooltips) {
            showPreviewTooltip = false;
            showExpandedTooltip = true;
            showBadgeExpansion = false;
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
        if (!showExpandedTooltip) {
            showBadgeExpansion = true;
        }

        if (!showTooltips || loading || (!status && !error && !cachedStatus) || showExpandedTooltip) return;

        clearHoverTimeout();

        hoverTimeout = setTimeout(() => {
            if (!showExpandedTooltip) {
                showPreviewTooltip = true;
            }
        }, 150);
    }

    // Handle mouse leave
    function handleMouseLeave() {
        clearHoverTimeout();

        requestAnimationFrame(() => {
            if (!isTooltipHovered) {
                showPreviewTooltip = false;
                showBadgeExpansion = false;
            }
        });
    }

    // Handle tooltip mouse enter
    function handleTooltipMouseEnter() {
        isTooltipHovered = true;
    }

    // Handle tooltip mouse leave
    function handleTooltipMouseLeave() {
        isTooltipHovered = false;
        showPreviewTooltip = false;
        showBadgeExpansion = false;
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
        showBadgeExpansion = false;
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
                    logger.error('StatusIndicator: failed to fetch status', {userId: id, error: err});
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
    class="status-container" class:badge-expanded={showBadgeExpansion}
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
  <span class="{statusConfig().iconClass}">
    <!-- Badge Container -->
    <span class="badge-container">
      {#if statusConfig().isReportable}
        <span class="reportable-badge {badgeStackClasses().reportable}"></span>
      {/if}

      {#if statusConfig().isQueued}
        <span class="queue-badge {badgeStackClasses().queue}"></span>
      {/if}

      {#if shouldShowIntegrationBadge()}
        <span class="integration-badge {badgeStackClasses().integration}">{integrationCount()}</span>
      {/if}

      {#if statusConfig().isOutfitOnly}
        <span class="outfit-badge {badgeStackClasses().outfit}"></span>
      {/if}
    </span>
  </span>

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