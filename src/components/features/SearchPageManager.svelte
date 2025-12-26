<script lang="ts">
	import { logger } from '@/lib/utils/logger';
	import { waitForElement } from '@/lib/utils/element-waiter';
	import { SEARCH_SELECTORS, PAGE_TYPES, USER_ACTIONS } from '@/lib/types/constants';
	import type { CombinedStatus } from '@/lib/types/custom-api';
	import UserListManager from './UserListManager.svelte';
	import FriendWarning from './FriendWarning.svelte';

	interface Props {
		onMount?: (cleanup: () => void) => void;
	}

	let { onMount }: Props = $props();

	// Component state
	let showSearchList = $state(false);
	let friendWarningUserId = $state<string | null>(null);
	let friendButtonHandler: ((event: Event) => void) | null = null;

	// Computed values
	const friendWarningOpen = $derived(friendWarningUserId !== null);

	// Initialize components when mounted
	$effect(() => {
		void initialize();
		onMount?.(cleanup);

		return cleanup;
	});

	// Initialize search page components
	async function initialize() {
		try {
			await setupSearchListPage();
			setupFriendWarningInterception();
			logger.debug('SearchPageManager initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize SearchPageManager:', error);
		}
	}

	// Set up search list page
	async function setupSearchListPage() {
		const result = await waitForElement(SEARCH_SELECTORS.CONTAINER);

		if (!result.success) {
			throw new Error('Search results container not found on search page');
		}

		showSearchList = true;
		logger.debug('Search results detected and will be managed');
	}

	// Set up friend warning interception using event delegation
	function setupFriendWarningInterception() {
		friendButtonHandler = (event: Event) => {
			const target = event.target as HTMLElement;

			// Handle clicks within search results
			const searchContainer = target.closest(SEARCH_SELECTORS.CONTAINER);
			if (!searchContainer) return;

			// Check if clicked element or parent is a friend button
			const friendButton = target.closest(SEARCH_SELECTORS.FRIEND_BUTTON);
			if (!friendButton) return;

			// Check if already proceeding
			if ((friendButton as HTMLElement).dataset.skipWarning) {
				delete (friendButton as HTMLElement).dataset.skipWarning;
				return;
			}

			// Intercept "Add" buttons
			const buttonText = friendButton.textContent?.trim().toLowerCase() || '';
			if (!buttonText.includes('add')) return;

			// Find the user card containing this button
			const userCard = friendButton.closest(SEARCH_SELECTORS.CARD.CONTAINER);
			if (!userCard) return;

			// Check if user is flagged
			if (!userCard.hasAttribute('data-rotector-flagged')) return;

			// Get user ID from the card
			const userId = userCard.getAttribute('data-rotector-user-id');
			if (!userId) return;

			// Prevent friend request and show warning
			event.preventDefault();
			event.stopPropagation();
			friendWarningUserId = userId;
		};

		// Attach to document to survive Angular DOM replacements
		document.addEventListener('click', friendButtonHandler, true);
		logger.debug('Friend warning interception set up for search page');
	}

	// Handle user processed events
	function handleUserProcessed(processedUserId: string, status: CombinedStatus) {
		logger.debug('Search page user processed', {
			userId: processedUserId,
			hasStatus: !!status
		});
	}

	// Handle errors
	function handleError(error: string) {
		logger.error('Search page UserListManager error:', error);
	}

	// Handle friend request proceed
	function handleFriendProceed() {
		if (!friendWarningUserId) return;

		logger.userAction(USER_ACTIONS.FRIEND_PROCEED, { userId: friendWarningUserId });

		// Find the friend button for this user and trigger click
		const userCard = document.querySelector(
			`${SEARCH_SELECTORS.CARD.CONTAINER}[data-rotector-user-id="${friendWarningUserId}"]`
		);
		const friendButton = userCard?.querySelector(
			SEARCH_SELECTORS.FRIEND_BUTTON
		) as HTMLElement | null;

		if (friendButton) {
			friendButton.dataset.skipWarning = 'true';
			friendButton.click();
			logger.debug('Friend request proceeded - simulated click');
		} else {
			logger.warn('Could not find friend button to proceed with friend request');
		}

		friendWarningUserId = null;
	}

	// Handle friend request cancel
	function handleFriendCancel() {
		if (friendWarningUserId) {
			logger.userAction(USER_ACTIONS.FRIEND_CANCEL, { userId: friendWarningUserId });
		}
		friendWarningUserId = null;
		logger.debug('Friend request cancelled by user');
	}

	// Handle block user action
	function handleFriendBlock() {
		if (friendWarningUserId) {
			logger.userAction(USER_ACTIONS.FRIEND_BLOCK, { userId: friendWarningUserId });
			// dev note: to keep it simple, we will just redirect them to the profile page
			window.open(`https://www.roblox.com/users/${friendWarningUserId}/profile`, '_blank');
		}
		friendWarningUserId = null;
	}

	// Cleanup resources
	function cleanup() {
		try {
			// Clean up event listener from document
			if (friendButtonHandler) {
				document.removeEventListener('click', friendButtonHandler, true);
				friendButtonHandler = null;
			}

			logger.debug('SearchPageManager cleanup completed');
		} catch (error) {
			logger.error('Failed to cleanup SearchPageManager:', error);
		}
	}
</script>

<!-- Search Results List Manager -->
{#if showSearchList}
	<UserListManager
		onError={handleError}
		onUserProcessed={handleUserProcessed}
		pageType={PAGE_TYPES.SEARCH_USER}
	/>
{/if}

<!-- Friend Warning Modal -->
{#if friendWarningOpen && friendWarningUserId}
	<FriendWarning
		isOpen={friendWarningOpen}
		onBlock={handleFriendBlock}
		onCancel={handleFriendCancel}
		onProceed={handleFriendProceed}
		userId={friendWarningUserId}
	/>
{/if}
