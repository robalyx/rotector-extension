<script lang="ts">
	import { mount, unmount } from 'svelte';
	import { logger } from '@/lib/utils/logger';
	import { waitForElement } from '@/lib/utils/element-waiter';
	import { COMPONENT_CLASSES, FRIENDS_SELECTORS, PAGE_TYPES } from '@/lib/types/constants';
	import { getLoggedInUserId } from '@/lib/utils/client-id';
	import { normalizePathname } from '@/lib/utils/page-detection';
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
		const userId = pathname.match(/\/users\/(\d+)\/friends/)?.[1];
		if (userId) return userId;
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

		// Create container and mount scan bar
		const container = document.createElement('span');
		container.className = COMPONENT_CLASSES.FRIENDS_SCAN;

		// Roseal extension splits the header into .friends-left and .friends-right
		// sections, moving .friends-filter out of the direct header children
		const friendsLeft = header.querySelector('.friends-left');
		if (friendsLeft) {
			friendsLeft.appendChild(container);
		} else {
			const filter = header.querySelector('.friends-filter');
			if (!filter?.parentNode) return;
			filter.parentNode.insertBefore(container, filter);
		}
		scanBarContainer = container;

		const component = mount(FriendsScanBar, {
			target: container,
			props: { userId }
		});

		scanBarCleanup = () => {
			void unmount(component);
		};
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
	<UserListManager onError={handleError} pageType={PAGE_TYPES.FRIENDS_LIST} />
{/if}
