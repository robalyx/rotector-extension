<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { STATUS, STATUS_SELECTORS } from '@/lib/types/constants';
	import { PROFILE_SELECTORS } from '@/lib/controllers/selectors/profile';
	import { SEARCH_SELECTORS } from '@/lib/controllers/selectors/search';
	import type { UserStatus } from '@/lib/types/api';
	import type { CombinedStatus } from '@/lib/types/custom-api';
	import { logger } from '@/lib/utils/logging/logger';
	import { sanitizeEntityId } from '@/lib/utils/dom/sanitizer';
	import { getFlaggingResult } from '@/lib/utils/status/status-utils';
	import { formatViolationReasons } from '@/lib/utils/status/violation-formatter';
	import Modal from '../../ui/Modal.svelte';

	interface Props {
		isOpen: boolean;
		userId: string | number;
		username?: string | null;
		userStatus?: CombinedStatus<UserStatus> | null;
		onProceed?: () => void;
		onCancel?: () => void;
		onBlock?: () => void;
	}

	interface UserInfo {
		userId: string;
		username: string;
		avatarUrl?: string | undefined;
	}

	let {
		isOpen = $bindable(),
		userId,
		username = null,
		userStatus = null,
		onProceed,
		onCancel,
		onBlock
	}: Props = $props();

	let userInfo: UserInfo | null = $state(null);

	const sanitizedUserId = $derived(sanitizeEntityId(userId) ?? '');
	const displayName = $derived(username || `User ${sanitizedUserId}`);

	// Flagging API data and derived figures
	const flaggingData = $derived(getFlaggingResult(userStatus ?? null)?.data);
	const isRedacted = $derived(flaggingData?.flagType === STATUS.FLAGS.REDACTED);
	const confidence = $derived(Math.round((flaggingData?.confidence ?? 0) * 100));
	const violations = $derived.by(() => {
		const reasons = flaggingData?.reasons;
		if (!reasons || isRedacted) return [];
		return formatViolationReasons(reasons)
			.sort((a, b) => b.confidence - a.confidence)
			.slice(0, 3);
	});

	function handleProceed() {
		logger.userAction('friend_warning_proceed', {
			userId: sanitizedUserId,
			statusFlag: flaggingData?.flagType
		});
		onProceed?.();
		isOpen = false;
	}

	function handleCancel() {
		logger.userAction('friend_warning_cancel', {
			userId: sanitizedUserId,
			statusFlag: flaggingData?.flagType
		});
		onCancel?.();
		isOpen = false;
	}

	function handleBlock() {
		logger.userAction('friend_warning_block', {
			userId: sanitizedUserId,
			statusFlag: flaggingData?.flagType
		});
		onBlock?.();
		isOpen = false;
	}

	function extractUserInfo(): UserInfo | null {
		if (!sanitizedUserId) return null;

		const isProfilePage = window.location.pathname.includes('/users/');
		const container = isProfilePage
			? document.querySelector(PROFILE_SELECTORS.HEADER)
			: document.querySelector(
					`${SEARCH_SELECTORS.CARD.CONTAINER}[${STATUS_SELECTORS.DATA_USER_ID}="${String(userId)}"]`
				);

		if (!container) return { userId: sanitizedUserId, username: '', avatarUrl: undefined };

		const [usernameSel, avatarSel] = isProfilePage
			? [PROFILE_SELECTORS.USERNAME, PROFILE_SELECTORS.AVATAR_IMG]
			: [SEARCH_SELECTORS.CARD.USERNAME, SEARCH_SELECTORS.CARD.AVATAR_IMG];

		let username = container.querySelector(usernameSel)?.textContent.trim() ?? '';
		if (isProfilePage && username.startsWith('@')) username = username.substring(1);

		const avatarImg = container.querySelector(avatarSel);
		const avatarUrl =
			avatarImg instanceof HTMLImageElement && avatarImg.src ? avatarImg.src : undefined;

		return { userId: sanitizedUserId, username, avatarUrl };
	}

	$effect(() => {
		if (isOpen) {
			userInfo = extractUserInfo();
		}
	});
</script>

<Modal onCancel={handleCancel} status="warning" title={$_('friend_warning_title')} bind:isOpen>
	<div class="friend-warning-user-card">
		<div class="friend-warning-avatar">
			{#if userInfo?.avatarUrl}
				<img
					alt={$_('friend_warning_avatar_alt', { values: { 0: userInfo.username } })}
					src={userInfo.avatarUrl}
				/>
			{/if}
		</div>
		<div class="friend-warning-user-meta">
			<div class="friend-warning-user-name">
				{userInfo?.username || displayName}
			</div>
			<div class="friend-warning-user-confidence">
				{#if isRedacted}
					{$_('tooltip_header_redacted')}
				{:else if confidence > 0}
					{$_('friend_warning_user_confidence', { values: { 0: String(confidence) } })}
				{/if}
			</div>
		</div>
	</div>

	{#if violations.length > 0}
		<div class="modal-section">
			<header class="modal-section-head">
				<h3 class="modal-section-title">{$_('friend_warning_flagged_for_heading')}</h3>
			</header>
			<ul class="modal-list">
				{#each violations as violation (violation.typeName)}
					<li class="friend-warning-violation">
						<span class="modal-list-bullet-warning" aria-hidden="true"></span>
						<div class="friend-warning-violation-body">
							<div class="friend-warning-violation-head">
								<span class="friend-warning-violation-name">{violation.typeName}</span>
								<span class="friend-warning-violation-confidence">{violation.confidence}%</span>
							</div>
							{#if violation.message}
								{@const lines = violation.message
									.split('\n')
									.map((l) => l.trim())
									.filter(Boolean)}
								{#if lines.length > 1}
									<ul class="friend-warning-violation-sources">
										{#each lines as line, i (i)}
											<li>{line}</li>
										{/each}
									</ul>
								{:else}
									<p class="friend-warning-violation-message">{violation.message}</p>
								{/if}
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="friend-warning-high-risk">
		{$_('friend_warning_high_risk_message')}
	</div>

	{#snippet actions()}
		<button class="modal-button-danger-outline" onclick={handleBlock} type="button">
			{$_('friend_warning_block_button')}
		</button>
		<button class="modal-button-cancel ml-auto" onclick={handleCancel} type="button">
			{$_('friend_warning_cancel_button')}
		</button>
		<button class="modal-button-danger" onclick={handleProceed} type="button">
			{$_('friend_warning_proceed_button')}
		</button>
	{/snippet}
</Modal>
