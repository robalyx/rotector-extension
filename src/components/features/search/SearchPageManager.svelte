<script lang="ts">
	import { logger } from '@/lib/utils/logging/logger';
	import { waitForElement } from '@/lib/utils/dom/element-waiter';
	import { PAGE_TYPES, STATUS_SELECTORS, USER_ACTIONS } from '@/lib/types/constants';
	import { SEARCH_SELECTORS } from '@/lib/controllers/selectors/search';
	import {
		consumeSkipWarning,
		proceedFriendClick
	} from '@/lib/services/friends/friend-button-intercept';
	import UserListManager from '../lists/UserListManager.svelte';
	import FriendWarning from '../friends/FriendWarning.svelte';

	interface Props {
		onMount?: (cleanup: () => void) => void;
	}

	let { onMount }: Props = $props();

	let showSearchList = $state(false);
	let friendWarningUserId = $state<string | null>(null);
	let friendButtonHandler: ((event: Event) => void) | null = null;

	const friendWarningOpen = $derived(friendWarningUserId !== null);

	$effect(() => {
		void waitForElement(SEARCH_SELECTORS.CONTAINER).then((r) => {
			if (r.success) showSearchList = true;
		});
		setupFriendWarningInterception();
		onMount?.(cleanup);

		return cleanup;
	});

	function setupFriendWarningInterception() {
		friendButtonHandler = (event: Event) => {
			if (!(event.target instanceof HTMLElement)) return;
			const target = event.target;

			const searchContainer = target.closest(SEARCH_SELECTORS.CONTAINER);
			if (!searchContainer) return;

			const friendButton = target.closest<HTMLElement>(SEARCH_SELECTORS.FRIEND_BUTTON);
			if (!friendButton) return;

			if (consumeSkipWarning(friendButton)) return;

			const buttonText = friendButton.textContent.trim().toLowerCase();
			if (!buttonText.includes('add')) return;

			const userCard = friendButton.closest(SEARCH_SELECTORS.CARD.CONTAINER);
			if (!userCard) return;

			if (!userCard.hasAttribute(STATUS_SELECTORS.DATA_FLAGGED)) return;

			const userId = userCard.getAttribute(STATUS_SELECTORS.DATA_USER_ID);
			if (!userId) return;

			event.preventDefault();
			event.stopPropagation();
			friendWarningUserId = userId;
		};

		// Attach to document to survive Angular DOM replacements
		document.addEventListener('click', friendButtonHandler, true);
	}

	function handleFriendProceed() {
		if (!friendWarningUserId) return;
		logger.userAction(USER_ACTIONS.FRIEND_PROCEED, { userId: friendWarningUserId });

		const userCard = document.querySelector(
			`${SEARCH_SELECTORS.CARD.CONTAINER}[${STATUS_SELECTORS.DATA_USER_ID}="${friendWarningUserId}"]`
		);
		const friendButton = userCard?.querySelector<HTMLElement>(SEARCH_SELECTORS.FRIEND_BUTTON);

		if (friendButton) {
			proceedFriendClick(friendButton);
		} else {
			logger.warn('Could not find friend button to proceed with friend request');
		}

		friendWarningUserId = null;
	}

	function handleFriendCancel() {
		if (friendWarningUserId) {
			logger.userAction(USER_ACTIONS.FRIEND_CANCEL, { userId: friendWarningUserId });
		}
		friendWarningUserId = null;
	}

	function handleFriendBlock() {
		if (friendWarningUserId) {
			logger.userAction(USER_ACTIONS.FRIEND_BLOCK, { userId: friendWarningUserId });
			window.open(`https://www.roblox.com/users/${friendWarningUserId}/profile`, '_blank');
		}
		friendWarningUserId = null;
	}

	function cleanup() {
		if (friendButtonHandler) {
			document.removeEventListener('click', friendButtonHandler, true);
		}
	}
</script>

{#if showSearchList}
	<UserListManager pageType={PAGE_TYPES.SEARCH_USER} />
{/if}

{#if friendWarningOpen && friendWarningUserId}
	<FriendWarning
		isOpen={friendWarningOpen}
		onBlock={handleFriendBlock}
		onCancel={handleFriendCancel}
		onProceed={handleFriendProceed}
		userId={friendWarningUserId}
	/>
{/if}
