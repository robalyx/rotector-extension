<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { LoaderCircle } from '@lucide/svelte';
	import Modal from '../../ui/Modal.svelte';
	import StatusIcon from '@/components/icons/StatusIcon.svelte';
	import { restrictedAccessStore, markRestrictionNoticeSeen } from '@/lib/stores/restricted-access';
	import { userStatusService } from '@/lib/services/rotector/entity-status';
	import { getCurrentAvatarInfo } from '@/lib/services/roblox/api';
	import { getLoggedInUserId } from '@/lib/utils/client-id';
	import { getStatusConfig } from '@/lib/utils/status/status-config';
	import { formatViolationReasons } from '@/lib/utils/status/violation-formatter';
	import { logger } from '@/lib/utils/logging/logger';
	import type { UserStatus } from '@/lib/types/api';

	let isOpen = $state(true);
	let userInfo = $state<{ username: string; thumbnailUrl: string | null } | null>(null);
	let userStatus = $state<UserStatus | null>(null);
	let reasonsLoading = $state(true);

	const restrictionTimestamp = $derived($restrictedAccessStore.timestamp);

	const reasons = $derived(
		userStatus?.reasons
			? formatViolationReasons(userStatus.reasons).toSorted((a, b) => b.confidence - a.confidence)
			: []
	);

	const statusConfig = $derived.by(() => {
		if (!userStatus) return null;
		return getStatusConfig(userStatus, null, false, null, 'user');
	});

	// Fetch own avatar info and live status for the modal
	$effect(() => {
		const userId = getLoggedInUserId();
		if (!userId) {
			reasonsLoading = false;
			return;
		}

		let cancelled = false;
		Promise.all([getCurrentAvatarInfo(userId), userStatusService.getStatus(userId)])
			.then(([info, status]) => {
				if (cancelled) return;
				userInfo = info;
				userStatus = status;
				reasonsLoading = false;
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				logger.error('Failed to load restriction context:', error);
				reasonsLoading = false;
			});

		return () => {
			cancelled = true;
		};
	});

	// Persist the seen timestamp so the modal stays dismissed for this incident
	async function handleClose() {
		if (restrictionTimestamp != null) {
			try {
				await markRestrictionNoticeSeen(restrictionTimestamp);
			} catch (error) {
				logger.error('Failed to persist restriction notice seen flag:', error);
			}
		}
	}

	function handleAppeal() {
		window.open('https://rotector.com', '_blank', 'noopener,noreferrer');
	}
</script>

<Modal
	cancelText={$_('restriction_notice_close')}
	confirmText={$_('restriction_notice_appeal_button')}
	onClose={handleClose}
	onConfirm={handleAppeal}
	status="error"
	title={$_('restriction_notice_title')}
	bind:isOpen
>
	<div class="modal-user-card">
		<div class="modal-user-card-avatar">
			{#if userInfo?.thumbnailUrl}
				<img alt="" src={userInfo.thumbnailUrl} />
			{/if}
		</div>
		<div class="modal-user-card-meta">
			{#if userInfo?.username}
				<div class="modal-user-card-handle">@{userInfo.username}</div>
			{/if}
		</div>
		{#if statusConfig}
			<span style:color={statusConfig.iconColor} class="modal-user-card-chip">
				<StatusIcon name={statusConfig.iconName} color={statusConfig.iconColor} size={14} />
				{statusConfig.textContent}
			</span>
		{/if}
	</div>

	<p class="modal-paragraph mt-3">{$_('restriction_notice_intro')}</p>

	<div class="modal-section">
		<header class="modal-section-head">
			<h3 class="modal-section-title">{$_('restriction_notice_why_title')}</h3>
		</header>
		<p class="modal-paragraph">{$_('restriction_notice_why_intro')}</p>
		{#if reasonsLoading}
			<p class="modal-reason-status">
				<LoaderCircle class="inline animate-spin" size={14} />
				{$_('restriction_notice_reasons_loading')}
			</p>
		{:else if reasons.length === 0}
			<p class="modal-reason-status">{$_('restriction_notice_reasons_failed')}</p>
		{:else}
			<ul class="modal-reason-list">
				{#each reasons as reason (reason.typeName)}
					<li class="modal-reason-item">
						<span class="modal-reason-name">{reason.typeName}</span>
						<span class="modal-reason-confidence">{reason.confidence}%</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="modal-section">
		<header class="modal-section-head">
			<h3 class="modal-section-title">{$_('restriction_notice_works_title')}</h3>
		</header>
		<ul class="modal-list">
			<li class="modal-list-item">
				<span class="modal-list-bullet-success" aria-hidden="true"></span>
				<span>{$_('restriction_notice_works_item1')}</span>
			</li>
			<li class="modal-list-item">
				<span class="modal-list-bullet-success" aria-hidden="true"></span>
				<span>{$_('restriction_notice_works_item2')}</span>
			</li>
			<li class="modal-list-item">
				<span class="modal-list-bullet-success" aria-hidden="true"></span>
				<span>{$_('restriction_notice_works_item3')}</span>
			</li>
		</ul>
	</div>

	<div class="modal-section">
		<header class="modal-section-head">
			<h3 class="modal-section-title">{$_('restriction_notice_blocked_title')}</h3>
		</header>
		<ul class="modal-list">
			<li class="modal-list-item">
				<span class="modal-list-bullet-error" aria-hidden="true"></span>
				<span>{$_('restriction_notice_blocked_item1')}</span>
			</li>
			<li class="modal-list-item">
				<span class="modal-list-bullet-error" aria-hidden="true"></span>
				<span>{$_('restriction_notice_blocked_item2')}</span>
			</li>
			<li class="modal-list-item">
				<span class="modal-list-bullet-error" aria-hidden="true"></span>
				<span>{$_('restriction_notice_blocked_item3')}</span>
			</li>
			<li class="modal-list-item">
				<span class="modal-list-bullet-error" aria-hidden="true"></span>
				<span>{$_('restriction_notice_blocked_item4')}</span>
			</li>
		</ul>
	</div>

	<div class="modal-section">
		<header class="modal-section-head">
			<h3 class="modal-section-title">{$_('restriction_notice_appeal_title')}</h3>
		</header>
		<p class="modal-paragraph">{$_('restriction_notice_appeal_body')}</p>
	</div>
</Modal>
