<script lang="ts">
	import { mount, unmount } from 'svelte';
	import { waitForElement } from '@/lib/utils/dom/element-waiter';
	import { COMPONENT_CLASSES, PAGE_TYPES } from '@/lib/types/constants';
	import { FRIENDS_SELECTORS } from '@/lib/controllers/selectors/friends';
	import { getLoggedInUserId } from '@/lib/utils/client-id';
	import { normalizePathname } from '@/lib/utils/dom/page-detection';
	import { extractIdFromUrl } from '@/lib/utils/dom/sanitizer';
	import UserListManager from '../lists/UserListManager.svelte';
	import FriendsScanBar from './FriendsScanBar.svelte';

	interface Props {
		onMount?: (cleanup: () => void) => void;
	}

	let { onMount }: Props = $props();

	let showFriendsList = $state(false);
	let scanBarContainer: HTMLElement | null = null;
	let scanBarCleanup: (() => void) | null = null;

	$effect(() => {
		void waitForElement(FRIENDS_SELECTORS.CONTAINER).then((r) => {
			if (r.success) showFriendsList = true;
		});
		void setupScanBar();
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

	function getUserIdFromUrl(): string | null {
		const pathname = normalizePathname(window.location.pathname);
		const userId = extractIdFromUrl(pathname, /\/users\/(\d+)\/friends/);
		if (userId) return userId;
		if (pathname === '/users/friends' || pathname === '/users/friends/') {
			return getLoggedInUserId();
		}
		return null;
	}

	function isFriendsTab(): boolean {
		const tab = window.location.hash.match(/^#!?\/?([^/#?&]*)/)?.[1] ?? '';
		return tab === '' || tab === 'friends';
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

	function cleanup() {
		cleanupScanBar();
		showFriendsList = false;
	}
</script>

{#if showFriendsList}
	<UserListManager pageType={PAGE_TYPES.FRIENDS_LIST} />
{/if}
