<script lang="ts">
	import type { GroupStatus, UserStatus } from '@/lib/types/api';
	import type { CombinedStatus } from '@/lib/types/custom-api';
	import { ENTITY_TYPES } from '@/lib/types/constants';
	import { logger } from '@/lib/utils/logger';
	import { sanitizeEntityId } from '@/lib/utils/sanitizer';
	import { getStatusConfig } from '@/lib/utils/status-config';
	import { groupStatusService, userStatusService } from '@/lib/services/entity-status-service';
	import { countCustomApiFlags, ROTECTOR_API_ID } from '@/lib/services/unified-query-service';
	import { restrictedAccessStore } from '@/lib/stores/restricted-access';
	import { getLoggedInUserId } from '@/lib/utils/client-id';
	import { Flag, Hourglass, Shirt } from 'lucide-svelte';
	import StatusIcon from '@/lib/components/icons/StatusIcon.svelte';

	import Tooltip from './Tooltip.svelte';
	import Portal from 'svelte-portal';

	type EntityStatus = UserStatus | GroupStatus;

	interface Props {
		entityId: string;
		entityType: 'user' | 'group';
		entityStatus?: CombinedStatus | null;
		error?: string | null;
		showText?: boolean;
		skipAutoFetch?: boolean;
		onClick?: (entityId: string) => void;
		onQueue?: (entityId: string, isReprocess?: boolean, status?: EntityStatus | null) => void;
	}

	let {
		entityId,
		entityType,
		entityStatus = null,
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

	// Check if access is restricted
	const isRestricted = $derived($restrictedAccessStore.isRestricted);

	// Check if this is a self-lookup
	const isSelfLookup = $derived.by(() => {
		if (entityType !== ENTITY_TYPES.USER) return false;
		const clientId = getLoggedInUserId();
		const targetId = sanitizeEntityId(entityId);
		return clientId !== null && targetId !== null && clientId === targetId;
	});

	const statusConfig = $derived(() => {
		if (!entityStatus) {
			return getStatusConfig(cachedStatus, cachedStatus, true, null, entityType);
		}

		const rotector = entityStatus.customApis.get(ROTECTOR_API_ID);
		const rotectorStatus = rotector?.data ?? cachedStatus;
		const rotectorLoading = rotector?.loading ?? false;
		const rotectorError = rotector?.error ?? null;
		const effectiveError = rotectorError || error;

		return getStatusConfig(
			rotectorStatus,
			cachedStatus,
			rotectorLoading,
			effectiveError,
			entityType
		);
	});

	const isGroup = $derived(() => entityType === 'group');

	// Count custom API flags
	const customApiFlagCount = $derived(() => {
		if (!entityStatus) return 0;
		return countCustomApiFlags(entityStatus);
	});

	// Compute visible badges in priority order
	const visibleBadges = $derived(() => {
		const badges: string[] = [];
		if (!isGroup() && statusConfig().isReportable) badges.push('reportable');
		if (statusConfig().isQueued) badges.push('queue');
		if (!isGroup() && statusConfig().isOutfitOnly) badges.push('outfit');
		if (customApiFlagCount() > 0) badges.push('integration');
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

		const rotector = entityStatus?.customApis.get(ROTECTOR_API_ID);
		const rotectorLoading = rotector?.loading ?? false;
		const hasData = rotector?.data || cachedStatus;

		if (rotectorLoading || (!hasData && !error && !isRestricted && !isSelfLookup)) return;

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

		const rotector = entityStatus?.customApis.get(ROTECTOR_API_ID);
		const rotectorLoading = rotector?.loading ?? false;
		const hasData = rotector?.data || cachedStatus;

		if (
			rotectorLoading ||
			(!hasData && !error && !isRestricted && !isSelfLookup) ||
			showExpandedTooltip
		)
			return;

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
			const rotector = entityStatus?.customApis.get(ROTECTOR_API_ID);
			const tooltipStatus = rotector?.data ?? cachedStatus;
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

		// Skip fetching if access is restricted
		if (isRestricted && !isSelfLookup) return;

		const rotector = entityStatus?.customApis.get(ROTECTOR_API_ID);
		const rotectorLoading = rotector?.loading ?? false;
		const hasRotectorData = rotector?.data;

		// If no status provided and not loading, check cache or fetch
		if (!hasRotectorData && !rotectorLoading && !error && !skipAutoFetch) {
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
	data-status-flag={entityStatus?.customApis.get(ROTECTOR_API_ID)?.data?.flagType}
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
	</span>

	<!-- Badge Container -->
	<span class="badge-container">
		{#if !isGroup() && statusConfig().isReportable}
			<span class="reportable-badge {badgeStackClasses().reportable}">
				<Flag size={10} strokeWidth={2.5} />
			</span>
		{/if}

		{#if statusConfig().isQueued}
			<span class="queue-badge {badgeStackClasses().queue}">
				<Hourglass size={8} strokeWidth={2.5} />
			</span>
		{/if}

		{#if !isGroup() && statusConfig().isOutfitOnly}
			<span class="outfit-badge {badgeStackClasses().outfit}">
				<Shirt size={9} strokeWidth={2.5} />
			</span>
		{/if}

		{#if customApiFlagCount() > 0}
			<span class="integration-badge {badgeStackClasses().integration}">
				{customApiFlagCount()}
			</span>
		{/if}
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
			userId={entityId}
			userStatus={entityStatus}
		/>
	</Portal>
{/if}

<!-- Expanded Tooltip -->
{#if showExpandedTooltip && container}
	<Portal target="#rotector-tooltip-portal">
		<Tooltip
			anchorElement={container}
			{entityType}
			{error}
			mode="expanded"
			onClose={closeExpandedTooltip}
			onQueue={handleExpandedQueue}
			userId={entityId}
			userStatus={entityStatus}
		/>
	</Portal>
{/if}
