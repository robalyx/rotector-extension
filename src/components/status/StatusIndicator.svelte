<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { EntityStatus } from '@/lib/types/api';
	import type { CombinedStatus } from '@/lib/types/custom-api';
	import { ENTITY_TYPES } from '@/lib/types/constants';
	import { logger } from '@/lib/utils/logging/logger';
	import { sanitizeEntityId } from '@/lib/utils/dom/sanitizer';
	import { getStatusConfig } from '@/lib/utils/status/status-config';
	import { groupStatusService, userStatusService } from '@/lib/services/rotector/entity-status';
	import { countCustomApiFlags } from '@/lib/services/rotector/unified-query';
	import { ROTECTOR_API_ID } from '@/lib/stores/custom-apis';
	import { restrictedAccessStore } from '@/lib/stores/restricted-access';
	import { getLoggedInUserId } from '@/lib/utils/client-id';
	import { openOutfitViewer } from '@/lib/stores/outfit-viewer';
	import { reportFirstDetectionIfEligible } from '@/lib/stores/first-detection';
	import {
		getBadgeStackClasses,
		getRotectorMembershipBadge,
		getRotectorOutfitEvidence
	} from '@/lib/utils/status/status-projection';
	import { Flag, Hourglass } from '@lucide/svelte';
	import StatusIcon from '@/components/icons/StatusIcon.svelte';

	import MembershipIcon from '@/components/ui/membership/MembershipIcon.svelte';
	import { designKey, tierOf } from '@/lib/utils/membership-designs';
	import Tooltip from './Tooltip.svelte';
	import OverlayPortal from '@/components/overlay/OverlayPortal.svelte';

	interface Props {
		entityId: string;
		entityType: 'user' | 'group';
		entityStatus?: CombinedStatus | null | undefined;
		error?: string | null | undefined;
		showText?: boolean | undefined;
		skipAutoFetch?: boolean | undefined;
		suppressMembershipBadge?: boolean | undefined;
		onClick?: ((entityId: string) => void) | undefined;
		onQueue?:
			| ((entityId: string, isReprocess?: boolean, status?: EntityStatus | null) => void)
			| undefined;
		userUsername?: string | undefined;
		userDisplayName?: string | undefined;
		userAvatarUrl?: string | undefined;
	}

	let {
		entityId,
		entityType,
		entityStatus = null,
		error = null,
		showText = true,
		skipAutoFetch = false,
		suppressMembershipBadge = false,
		onClick,
		onQueue,
		userUsername,
		userDisplayName,
		userAvatarUrl
	}: Props = $props();

	let container = $state<HTMLElement>();
	let showPreviewTooltip = $state(false);
	let showExpandedTooltip = $state(false);
	let isTooltipHovered = $state(false);
	let showBadgeExpansion = $state(false);

	let cachedStatus = $state<EntityStatus | null>(null);
	let hoverTimeout = $state<ReturnType<typeof setTimeout> | null>(null);

	const statusService = $derived(
		entityType === ENTITY_TYPES.USER ? userStatusService : groupStatusService
	);

	const sanitizedEntityId = $derived(sanitizeEntityId(entityId) || '');

	const isRestricted = $derived($restrictedAccessStore.isRestricted);

	const isSelfLookup = $derived.by(() => {
		if (entityType !== ENTITY_TYPES.USER) return false;
		const clientId = getLoggedInUserId();
		const targetId = sanitizeEntityId(entityId);
		return clientId !== null && targetId !== null && clientId === targetId;
	});

	const statusConfig = $derived.by(() => {
		if (!entityStatus) {
			return getStatusConfig(cachedStatus, cachedStatus, !cachedStatus, null, entityType);
		}

		const rotector = entityStatus.get(ROTECTOR_API_ID);
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

	const isGroup = $derived(entityType === ENTITY_TYPES.GROUP);

	const flaggedOutfits = $derived(isGroup ? null : getRotectorOutfitEvidence(entityStatus));

	const customApiFlagCount = $derived(entityStatus ? countCustomApiFlags(entityStatus) : 0);

	const membershipBadge = $derived(
		!isGroup && !suppressMembershipBadge ? getRotectorMembershipBadge(entityStatus) : null
	);
	const membershipTier = $derived(membershipBadge ? tierOf(membershipBadge.tier) : null);
	const membershipIconKey = $derived(
		membershipBadge && membershipTier
			? designKey(membershipBadge.iconDesign, membershipTier, 'icon')
			: null
	);

	const badgeStackClasses = $derived(
		getBadgeStackClasses({
			isGroup,
			isReportable: statusConfig.isReportable,
			isQueued: statusConfig.isQueued,
			customApiFlagCount,
			hasMembership: membershipBadge !== null
		})
	);

	const rotector = $derived(entityStatus?.get(ROTECTOR_API_ID));
	const rotectorLoading = $derived(rotector?.loading ?? false);
	const hasData = $derived(!!(rotector?.data || cachedStatus));
	const tooltipBlocked = $derived(
		rotectorLoading || (!hasData && !error && !isRestricted && !isSelfLookup)
	);

	function handleClick(event: MouseEvent | KeyboardEvent) {
		event.preventDefault();
		event.stopPropagation();

		if (tooltipBlocked) return;

		logger.userAction('status_indicator_clicked', { entityId: sanitizedEntityId, entityType });

		onClick?.(sanitizedEntityId);

		showPreviewTooltip = false;
		showExpandedTooltip = true;
		showBadgeExpansion = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			handleClick(event);
		}
	}

	function clearHoverTimeout() {
		if (hoverTimeout) {
			clearTimeout(hoverTimeout);
			hoverTimeout = null;
		}
	}

	// If the indicator unmounts within the 150ms hover debounce, clear the pending
	// timeout so it doesn't fire post-unmount and write to dead state
	$effect(() => clearHoverTimeout);

	function handleMouseEnter() {
		if (!showExpandedTooltip) {
			showBadgeExpansion = true;
		}

		if (tooltipBlocked || showExpandedTooltip) return;

		clearHoverTimeout();

		hoverTimeout = setTimeout(() => {
			if (!showExpandedTooltip) {
				showPreviewTooltip = true;
			}
		}, 150);
	}

	function handleMouseLeave() {
		clearHoverTimeout();

		requestAnimationFrame(() => {
			if (!isTooltipHovered) {
				showPreviewTooltip = false;
				showBadgeExpansion = false;
			}
		});
	}

	function handleTooltipMouseEnter() {
		isTooltipHovered = true;
	}

	function handleTooltipMouseLeave() {
		isTooltipHovered = false;
		showPreviewTooltip = false;
		showBadgeExpansion = false;
	}

	function handleQueue(isReprocess = false) {
		onQueue?.(sanitizedEntityId, isReprocess, rotector?.data ?? cachedStatus);
	}

	function handleExpandedQueue(isReprocess = false, tooltipStatus: EntityStatus | null = null) {
		onQueue?.(sanitizedEntityId, isReprocess, tooltipStatus);
		showExpandedTooltip = false;
	}

	function closeExpandedTooltip() {
		showExpandedTooltip = false;
		showBadgeExpansion = false;
	}

	function handleViewOutfits() {
		openOutfitViewer(entityId, flaggedOutfits ?? []);
	}

	$effect(() => {
		if (!sanitizedEntityId) return;
		if (isRestricted && !isSelfLookup) return;
		if (rotector?.data || rotectorLoading || error || skipAutoFetch) return;

		void statusService.getOrFetch(sanitizedEntityId).then((result) => {
			if (result) cachedStatus = result;
		});
	});

	$effect(() => {
		reportFirstDetectionIfEligible({
			entityType,
			userId: sanitizedEntityId,
			isSelfLookup,
			flagType: (rotector?.data ?? cachedStatus)?.flagType
		});
	});

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
		return () => {};
	});
</script>

<button
	bind:this={container}
	class="status-container"
	class:badge-expanded={showBadgeExpansion}
	aria-label={$_('status_indicator_aria_label', { values: { 0: statusConfig.textContent } })}
	data-status-flag={rotector?.data?.flagType}
	data-user-id={sanitizedEntityId}
	onclick={handleClick}
	onkeydown={handleKeydown}
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
	title={undefined}
	type="button"
>
	<span
		class="status-icon-wrapper"
		class:animate-spin-loading={statusConfig.iconName === 'loading'}
	>
		<StatusIcon
			name={statusConfig.iconName}
			class="status-icon-base"
			color={statusConfig.iconColor}
		/>
	</span>

	<span class="badge-container">
		{#if !isGroup && statusConfig.isReportable}
			<span class="reportable-badge {badgeStackClasses['reportable']}">
				<Flag size={10} strokeWidth={2.5} />
			</span>
		{/if}

		{#if statusConfig.isQueued}
			<span class="queue-badge {badgeStackClasses['queue']}">
				<Hourglass size={8} strokeWidth={2.5} />
			</span>
		{/if}

		{#if customApiFlagCount > 0}
			<span class="integration-badge {badgeStackClasses['integration']}">
				{customApiFlagCount}
			</span>
		{/if}

		{#if membershipBadge && membershipIconKey}
			<span class="membership-stack-badge tier-{membershipTier} {badgeStackClasses['membership']}">
				<MembershipIcon iconKey={membershipIconKey} size={10} />
			</span>
		{/if}
	</span>

	{#if showText}
		<span class={statusConfig.textClass}>
			{statusConfig.textContent}
		</span>
	{/if}
</button>

{#if showPreviewTooltip && container}
	<OverlayPortal>
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
			onViewOutfits={isGroup ? undefined : handleViewOutfits}
			{userAvatarUrl}
			{userDisplayName}
			userId={entityId}
			userStatus={entityStatus}
			{userUsername}
		/>
	</OverlayPortal>
{/if}

{#if showExpandedTooltip && container}
	<OverlayPortal>
		<Tooltip
			anchorElement={container}
			{entityType}
			{error}
			mode="expanded"
			onClose={closeExpandedTooltip}
			onQueue={handleExpandedQueue}
			onViewOutfits={isGroup ? undefined : handleViewOutfits}
			{userAvatarUrl}
			{userDisplayName}
			userId={entityId}
			userStatus={entityStatus}
			{userUsername}
		/>
	</OverlayPortal>
{/if}
