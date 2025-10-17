<script lang="ts">
	import type { GroupStatus, UserStatus } from '@/lib/types/api';
	import { ENTITY_TYPES, STATUS } from '@/lib/types/constants';
	import { logger } from '@/lib/utils/logger';
	import { sanitizeEntityId } from '@/lib/utils/sanitizer';
	import { getStatusConfig } from '@/lib/utils/status-config';
	import { groupStatusService, userStatusService } from '@/lib/services/entity-status-service';
	import { Flag, Hourglass, Shirt } from 'lucide-svelte';
	import StatusIcon from '@/lib/components/icons/StatusIcon.svelte';

	import Tooltip from './Tooltip.svelte';
	import Portal from 'svelte-portal';

	type EntityStatus = UserStatus | GroupStatus;

	interface Props {
		entityId: string;
		entityType: 'user' | 'group';
		status?: EntityStatus | null;
		loading?: boolean;
		error?: string | null;
		showText?: boolean;
		skipAutoFetch?: boolean;
		onClick?: (entityId: string) => void;
		onQueue?: (entityId: string, isReprocess?: boolean, status?: EntityStatus | null) => void;
	}

	let {
		entityId,
		entityType,
		status = null,
		loading = false,
		error = null,
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

	let cachedStatus = $state<EntityStatus | null>(null);
	let hoverTimeout = $state<ReturnType<typeof setTimeout> | null>(null);

	// Get the appropriate service based on entity type
	const statusService = $derived(() => {
		return entityType === ENTITY_TYPES.USER ? userStatusService : groupStatusService;
	});

	// Computed values
	const sanitizedEntityId = $derived(() => {
		return sanitizeEntityId(entityId) || '';
	});

	const statusConfig = $derived(() => getStatusConfig(status, cachedStatus, loading, error));

	const integrationCount = $derived(() => {
		if (entityType !== ENTITY_TYPES.USER) return 0;

		const activeStatus = status || cachedStatus;
		const userStatus = activeStatus as UserStatus;
		return userStatus?.integrationSources ? Object.keys(userStatus.integrationSources).length : 0;
	});

	const shouldShowIntegrationBadge = $derived(() => {
		const activeStatus = status || cachedStatus;
		return integrationCount() > 0 && activeStatus?.flagType !== STATUS.FLAGS.INTEGRATION;
	});

	const isGroup = $derived(() => entityType === 'group');

	// Compute visible badges in priority order
	const visibleBadges = $derived(() => {
		const badges: string[] = [];
		if (!isGroup() && statusConfig().isReportable) badges.push('reportable');
		if (statusConfig().isQueued) badges.push('queue');
		if (shouldShowIntegrationBadge()) badges.push('integration');
		if (!isGroup() && statusConfig().isOutfitOnly) badges.push('outfit');
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

		logger.userAction('status_indicator_clicked', { entityId: sanitizedEntityId(), entityType });

		if (onClick) {
			onClick(sanitizedEntityId());
		}

		showPreviewTooltip = false;
		showExpandedTooltip = true;
		showBadgeExpansion = false;
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

		if (loading || (!status && !error && !cachedStatus) || showExpandedTooltip) return;

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
	function handleQueue(isReprocess = false) {
		if (onQueue) {
			const tooltipStatus = status || cachedStatus;
			onQueue(sanitizedEntityId(), isReprocess, tooltipStatus);
		}
	}

	// Handle expanded tooltip actions
	function handleExpandedQueue(isReprocess = false, tooltipStatus: EntityStatus | null = null) {
		if (onQueue) {
			onQueue(sanitizedEntityId(), isReprocess, tooltipStatus);
		}
		showExpandedTooltip = false;
	}

	// Close expanded tooltip
	function closeExpandedTooltip() {
		showExpandedTooltip = false;
		showBadgeExpansion = false;
	}

	// Fetch and cache user status
	$effect(() => {
		const id = sanitizedEntityId();
		if (!id) return;

		// If no status provided and not loading, check cache or fetch
		if (!status && !loading && !error && !skipAutoFetch) {
			const service = statusService();
			const cached = service.getCachedStatus(id);
			if (cached) {
				cachedStatus = cached;
				logger.debug('StatusIndicator: using cached status', {
					entityId: id,
					entityType,
					flagType: cached.flagType
				});
			} else {
				// Fetch status asynchronously
				service
					.getStatus(id)
					.then((result) => {
						if (result) {
							cachedStatus = result;
							logger.debug('StatusIndicator: fetched new status', {
								entityId: id,
								entityType,
								flagType: result.flagType
							});
						}
					})
					.catch((err: unknown) => {
						logger.error('StatusIndicator: failed to fetch status', {
							entityId: id,
							entityType,
							error: err
						});
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
		return () => {}; // No-op cleanup when tooltips are not shown
	});
</script>

<button
	bind:this={container}
	class="status-container"
	class:badge-expanded={showBadgeExpansion}
	aria-label={`Status: ${statusConfig().textContent}. Click for details.`}
	data-status-flag={status?.flagType}
	data-user-id={sanitizedEntityId()}
	onclick={handleClick}
	onkeydown={handleKeydown}
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
	title={undefined}
	type="button"
>
	<!-- Status Icon -->
	<span
		class="status-icon-wrapper"
		class:animate-spin-loading={statusConfig().iconName === 'loading'}
	>
		<StatusIcon
			name={statusConfig().iconName}
			class="status-icon-base"
			color={statusConfig().iconColor}
		/>
		<!-- Badge Container -->
		<span class="badge-container">
			{#if !isGroup() && statusConfig().isReportable}
				<span class="reportable-badge {badgeStackClasses().reportable}">
					<Flag color="white" size={10} strokeWidth={2.5} />
				</span>
			{/if}

			{#if statusConfig().isQueued}
				<span class="queue-badge {badgeStackClasses().queue}">
					<Hourglass color="white" size={8} strokeWidth={2.5} />
				</span>
			{/if}

			{#if shouldShowIntegrationBadge()}
				<span class="integration-badge {badgeStackClasses().integration}">{integrationCount()}</span
				>
			{/if}

			{#if !isGroup() && statusConfig().isOutfitOnly}
				<span class="outfit-badge {badgeStackClasses().outfit}">
					<Shirt color="white" size={9} strokeWidth={2.5} />
				</span>
			{/if}
		</span>
	</span>

	<!-- Status Text -->
	{#if showText}
		<span class={statusConfig().textClass}>
			{statusConfig().textContent}
		</span>
	{/if}
</button>

<!-- Preview Tooltip -->
{#if showPreviewTooltip && container}
	<Portal target="#rotector-tooltip-portal">
		{@const tooltipStatus = status || cachedStatus}
		<Tooltip
			anchorElement={container}
			{entityType}
			{error}
			mode="preview"
			onClose={() => (showPreviewTooltip = false)}
			onExpand={() => {
				showPreviewTooltip = false;
				showExpandedTooltip = true;
			}}
			onMouseEnter={handleTooltipMouseEnter}
			onMouseLeave={handleTooltipMouseLeave}
			onQueue={handleQueue}
			status={tooltipStatus}
			userId={entityId}
		/>
	</Portal>
{/if}

<!-- Expanded Tooltip -->
{#if showExpandedTooltip && container}
	<Portal target="#rotector-tooltip-portal">
		{@const tooltipStatus = status || cachedStatus}
		<Tooltip
			anchorElement={container}
			{entityType}
			{error}
			mode="expanded"
			onClose={closeExpandedTooltip}
			onQueue={handleExpandedQueue}
			status={tooltipStatus}
			userId={entityId}
		/>
	</Portal>
{/if}
