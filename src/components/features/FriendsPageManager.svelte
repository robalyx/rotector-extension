<script lang="ts">
	import { mount } from 'svelte';
	import { logger } from '@/lib/utils/logger';
	import { waitForElement } from '@/lib/utils/element-waiter';
	import { COMPONENT_CLASSES, FRIENDS_SELECTORS, PAGE_TYPES } from '@/lib/types/constants';
	import { getLoggedInUserId } from '@/lib/utils/client-id';
	import { normalizePathname } from '@/lib/utils/page-detection';
	import type { CombinedStatus } from '@/lib/types/custom-api';
	import UserListManager from './UserListManager.svelte';
	import FriendsScanBar from './FriendsScanBar.svelte';

	interface Props {
		onMount?: (cleanup: () => void) => void;
	}

	let { onMount }: Props = $props();

	// Component state
	let showFriendsList = $state(false);
	let scanBarContainer: HTMLElement | null = null;
	let scanBarCleanup: (() => void) | null = null;

	// Initialize components when mounted
	$effect(() => {
		void initialize();
		onMount?.(cleanup);

		window.addEventListener('hashchange', handleHashChange);

		return () => {
			window.removeEventListener('hashchange', handleHashChange);
			cleanup();
		};
	});

	function handleHashChange() {
		if (isFriendsTab() && !scanBarContainer) {
			void setupScanBar();
		} else if (!isFriendsTab() && scanBarContainer) {
			cleanupScanBar();
		}
	}

	// Initialize friends page components
	async function initialize() {
		try {
			await setupFriendsListPage();
			await setupScanBar();
			logger.debug('FriendsPageManager initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize FriendsPageManager:', error);
		}
	}

	function getUserIdFromUrl(): string | null {
		const pathname = normalizePathname(window.location.pathname);
		const match = pathname.match(/\/users\/(\d+)\/friends/);
		if (match) {
			return match[1];
		}
		if (pathname === '/users/friends' || pathname === '/users/friends/') {
			return getLoggedInUserId();
		}
		return null;
	}

	function isFriendsTab(): boolean {
		const hash = window.location.hash;
		return hash === '' || hash === '#!/friends';
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

	// Inject scan bar into friends page header
	async function setupScanBar() {
		if (!isFriendsTab()) return;

		const userId = getUserIdFromUrl();
		if (!userId) return;

		// Wait for Roblox to render the friends content header
		const headerResult = await waitForElement('.friends-content .container-header');
		if (!headerResult.success || !headerResult.element) return;

		const header = headerResult.element;
		const filter = header.querySelector('.friends-filter');
		if (!filter) return;

		// Create container and mount scan bar before the search filter
		const container = document.createElement('span');
		container.className = COMPONENT_CLASSES.FRIENDS_SCAN;

		header.insertBefore(container, filter);
		scanBarContainer = container;

		const component = mount(FriendsScanBar, {
			target: container,
			props: { userId }
		}) as { unmount?: () => void };

		// Header uses display:block so vertically center the scan bar
		const offset = Math.round((header.offsetHeight - container.offsetHeight) / 2);
		if (offset > 0) container.style.marginTop = `${offset}px`;

		scanBarCleanup = () => {
			component?.unmount?.();
		};
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

	// Remove scan bar component and DOM element
	function cleanupScanBar() {
		if (scanBarCleanup) {
			scanBarCleanup();
			scanBarCleanup = null;
		}
		if (scanBarContainer) {
			scanBarContainer.remove();
			scanBarContainer = null;
		}
	}

	// Cleanup resources
	function cleanup() {
		try {
			cleanupScanBar();
			showFriendsList = false;
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
