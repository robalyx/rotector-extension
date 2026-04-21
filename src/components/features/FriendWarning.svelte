<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { PROFILE_SELECTORS, SEARCH_SELECTORS, STATUS_SELECTORS } from '@/lib/types/constants';
	import type { UserStatus } from '@/lib/types/api';
	import type { CombinedStatus } from '@/lib/types/custom-api';
	import { logger } from '@/lib/utils/logger';
	import { sanitizeEntityId } from '@/lib/utils/sanitizer';
	import { getFlaggingResult } from '@/lib/utils/status-utils';
	import { formatViolationReasons } from '@/lib/utils/violation-formatter';
	import Modal from '../ui/Modal.svelte';

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
		avatarUrl?: string;
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

	// User display info
	let userInfo: UserInfo | null = $state(null);

	// Display fields
	const sanitizedUserId = $derived(sanitizeEntityId(userId) ?? '');
	const displayName = $derived(username || `User ${sanitizedUserId}`);

	// Flagging API data and derived figures
	const flaggingData = $derived(getFlaggingResult(userStatus ?? null)?.data);
	const confidence = $derived(Math.round((flaggingData?.confidence ?? 0) * 100));
	const violations = $derived.by(() => {
		const reasons = flaggingData?.reasons;
		if (!reasons) return [];
		return formatViolationReasons(reasons)
			.sort((a, b) => b.confidence - a.confidence)
			.slice(0, 3);
	});

	// Handle proceed with friend request
	function handleProceed() {
		logger.userAction('friend_warning_proceed', {
			userId: sanitizedUserId,
			statusFlag: flaggingData?.flagType
		});
		onProceed?.();
		isOpen = false;
	}

	// Handle cancel friend request
	function handleCancel() {
		logger.userAction('friend_warning_cancel', {
			userId: sanitizedUserId,
			statusFlag: flaggingData?.flagType
		});
		onCancel?.();
		isOpen = false;
	}

	// Handle block user
	function handleBlock() {
		logger.userAction('friend_warning_block', {
			userId: sanitizedUserId,
			statusFlag: flaggingData?.flagType
		});
		onBlock?.();
		isOpen = false;
	}

	// Extract user info from the page DOM
	function extractUserInfo(): UserInfo | null {
		if (!sanitizedUserId) return null;

		let username = '';
		let avatarUrl: string | undefined;

		// Check if we're on a profile page
		const isProfilePage = window.location.pathname.includes('/users/');

		if (isProfilePage) {
			const profileHeader = document.querySelector(PROFILE_SELECTORS.HEADER);
			if (profileHeader) {
				// Get username from profile username element
				const usernameElement = profileHeader.querySelector(PROFILE_SELECTORS.USERNAME);
				if (usernameElement) {
					let text = usernameElement.textContent?.trim() ?? '';
					if (text.startsWith('@')) text = text.substring(1);
					username = text;
				}

				// Get avatar image
				const avatarImg = profileHeader.querySelector(PROFILE_SELECTORS.AVATAR_IMG);
				if (avatarImg instanceof HTMLImageElement && avatarImg.src) {
					avatarUrl = avatarImg.src;
				}
			}
		} else {
			// Try to find user info from search card
			const searchCard = document.querySelector(
				`${SEARCH_SELECTORS.CARD.CONTAINER}[${STATUS_SELECTORS.DATA_USER_ID}="${userId}"]`
			);
			if (searchCard) {
				// Get username from search card
				const usernameElement = searchCard.querySelector(SEARCH_SELECTORS.CARD.USERNAME);
				if (usernameElement) {
					username = usernameElement.textContent?.trim() ?? '';
				}

				// Get avatar image from search card
				const avatarImg = searchCard.querySelector(SEARCH_SELECTORS.CARD.AVATAR_IMG);
				if (avatarImg instanceof HTMLImageElement && avatarImg.src) {
					avatarUrl = avatarImg.src;
				}
			}
		}

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
				{$_('friend_warning_user_confidence', { values: { 0: String(confidence) } })}
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
