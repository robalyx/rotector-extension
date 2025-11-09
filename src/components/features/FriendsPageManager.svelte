<script lang="ts">
	import { logger } from '@/lib/utils/logger';
	import { waitForElement } from '@/lib/utils/element-waiter';
	import { FRIENDS_SELECTORS, PAGE_TYPES } from '@/lib/types/constants';
	import type { CombinedStatus } from '@/lib/types/custom-api';
	import UserListManager from './UserListManager.svelte';

	interface Props {
		onMount?: (cleanup: () => void) => void;
	}

	let { onMount }: Props = $props();

	// Component state
	let showFriendsList = $state(false);

	// Initialize components when mounted
	$effect(() => {
		void initialize();
		onMount?.(cleanup);

		return cleanup;
	});

	// Initialize friends page components
	async function initialize() {
		try {
			await setupFriendsListPage();
			logger.debug('FriendsPageManager initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize FriendsPageManager:', error);
		}
	}

	// Set up friends list page
	async function setupFriendsListPage() {
		const result = await waitForElement(FRIENDS_SELECTORS.CONTAINER);

		if (!result.success) {
			throw new Error('Friends list container not found on friends page');
		}

		showFriendsList = true;
		logger.debug('Friends list detected and will be managed');
	}

	// Handle user processed events
	function handleUserProcessed(processedUserId: string, status: CombinedStatus) {
		logger.debug('Friends page user processed', {
			userId: processedUserId,
			hasStatus: !!status
		});
	}

	// Handle errors
	function handleError(error: string) {
		logger.error('Friends page UserListManager error:', error);
	}

	// Cleanup resources
	function cleanup() {
		try {
			logger.debug('FriendsPageManager cleanup completed');
		} catch (error) {
			logger.error('Failed to cleanup FriendsPageManager:', error);
		}
	}
</script>

<!-- Friends List Manager -->
{#if showFriendsList}
	<UserListManager
		onError={handleError}
		onUserProcessed={handleUserProcessed}
		pageType={PAGE_TYPES.FRIENDS_LIST}
	/>
{/if}
