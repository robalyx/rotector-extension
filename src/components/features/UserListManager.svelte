<script lang="ts">
	import { mount } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { Observer } from '@/lib/utils/observer';
	import { observerFactory } from '@/lib/utils/observer';
	import {
		COMPONENT_CLASSES,
		ENTITY_TYPES,
		FRIENDS_CAROUSEL_SELECTORS,
		FRIENDS_SELECTORS,
		GROUP_CONFIGURE_SELECTORS,
		GROUPS_MODAL_SELECTORS,
		LOOKUP_CONTEXT,
		PAGE_TYPES,
		SEARCH_SELECTORS,
		STATUS_SELECTORS,
		USER_ACTIONS
	} from '@/lib/types/constants';
	import { sanitizeEntityId } from '@/lib/utils/sanitizer';
	import { logger } from '@/lib/utils/logger';
	import { startTrace, TRACE_CATEGORIES } from '@/lib/utils/perf-tracer';
	import { getLoggedInUserId } from '@/lib/utils/client-id';
	import type { PageType } from '@/lib/types/api';
	import type { CombinedStatus } from '@/lib/types/custom-api';
	import { queryMultipleUsers, queryUser } from '@/lib/services/unified-query-service';
	import {
		markUserElementForBlur,
		resetElementBlur,
		revealUserElement
	} from '@/lib/services/blur-service';
	import { isFlagged } from '@/lib/utils/status-utils';
	import StatusIndicator from '../status/StatusIndicator.svelte';
	import type { QueueModalManagerInstance } from '@/lib/types/components';
	import QueueModalManager from './QueueModalManager.svelte';

	interface Props {
		pageType: PageType;
		profileOwnerId?: string;
		onUserProcessed?: (userId: string, status: CombinedStatus) => void;
		onError?: (error: string) => void;
		onMount?: (cleanup: () => void) => void;
	}

	let { pageType, profileOwnerId, onUserProcessed, onError, onMount }: Props = $props();

	// Local state
	let observer: Observer | null = null;
	let containerWatcher: Observer | null = null;
	let modalObserver: Observer | null = null;
	let modalContainerWatcher: Observer | null = null;
	let modalCloseObserver: MutationObserver | null = null;
	let vlistWaitObserver: MutationObserver | null = null;
	let processedUsers = new SvelteSet<string>();
	let userStatuses = new SvelteMap<string, CombinedStatus>();
	let loadingUsers = new SvelteSet<string>();
	let mountedComponents = new SvelteMap<string, { unmount?: () => void }>();
	let destroyed = $state(false);

	// Queue modal manager reference
	let queueModalManager: QueueModalManagerInstance;

	// Type definitions for user details
	interface UserDetails {
		userId: string;
		element: Element;
		profileLink: Element;
	}

	// Page configuration objects
	const FRIENDS_CAROUSEL_CONFIG = {
		containerSelector: FRIENDS_CAROUSEL_SELECTORS.CONTAINER,
		itemSelector: FRIENDS_CAROUSEL_SELECTORS.TILE,
		profileLinkSelector: FRIENDS_CAROUSEL_SELECTORS.PROFILE_LINK
	};

	const PAGE_CONFIGS = {
		[PAGE_TYPES.FRIENDS_LIST]: {
			containerSelector: FRIENDS_SELECTORS.CONTAINER,
			itemSelector: FRIENDS_SELECTORS.CARD.CONTAINER,
			profileLinkSelector: FRIENDS_SELECTORS.PROFILE_LINK
		},
		[PAGE_TYPES.SEARCH_USER]: {
			containerSelector: SEARCH_SELECTORS.CONTAINER,
			itemSelector: SEARCH_SELECTORS.CARD.CONTAINER,
			profileLinkSelector: SEARCH_SELECTORS.PROFILE_LINK
		},
		[PAGE_TYPES.GROUP_CONFIGURE_MEMBERS]: {
			containerSelector: GROUP_CONFIGURE_SELECTORS.CONTAINER,
			itemSelector: GROUP_CONFIGURE_SELECTORS.CARD.CONTAINER,
			profileLinkSelector: GROUP_CONFIGURE_SELECTORS.PROFILE_LINK
		},
		[PAGE_TYPES.FRIENDS_CAROUSEL]: FRIENDS_CAROUSEL_CONFIG,
		[PAGE_TYPES.HOME]: FRIENDS_CAROUSEL_CONFIG,
		[PAGE_TYPES.PROFILE]: FRIENDS_CAROUSEL_CONFIG
	};

	// Get page configuration with validation
	function getPageConfig() {
		const config = PAGE_CONFIGS[pageType as keyof typeof PAGE_CONFIGS];
		if (!config) {
			throw new Error(`UserListManager does not support page type: ${pageType}`);
		}
		return config;
	}

	// Creates standardized observer configuration for the current page type
	function createObserverConfig(
		options: {
			name?: string;
			processExistingItems?: boolean;
			restartDelay?: number;
		} = {}
	) {
		const config = getPageConfig();

		// Enable post-resize processing for carousel page types where resize events
		// can cause new tiles to appear that need to be processed
		const isCarouselPageType =
			pageType === PAGE_TYPES.FRIENDS_CAROUSEL ||
			pageType === PAGE_TYPES.HOME ||
			pageType === PAGE_TYPES.PROFILE;

		return {
			name: options.name || `user-list-${pageType}`,
			containerSelector: config.containerSelector,
			unprocessedItemSelector: config.itemSelector,
			processItems: handleNewUsers,
			processExistingItems: options.processExistingItems ?? true,
			enablePostResizeProcessing: isCarouselPageType,
			...(options.restartDelay && { restartDelay: options.restartDelay })
		};
	}

	// Initialize observer and start processing, cleanup on unmount
	$effect(() => {
		if (destroyed) {
			return;
		}

		// Provide cleanup function to parent
		onMount?.(cleanup);

		void initializeObserver();

		// Start periodic cleanup for orphaned components
		const cleanupInterval = setInterval(() => {
			cleanupOrphanedComponents();
		}, 10000);

		return () => {
			clearInterval(cleanupInterval);
			cleanup();
		};
	});

	// Initialize the observer for this page type
	async function initializeObserver() {
		if (destroyed) {
			return;
		}

		try {
			if (pageType === PAGE_TYPES.FRIENDS_LIST) {
				await initializeFriendsPageObserver();
			} else if (pageType === PAGE_TYPES.MEMBERS) {
				await initializeGroupsModalObserver();
			} else if (pageType === PAGE_TYPES.SEARCH_USER) {
				await initializeSearchPageObserver();
			} else if (pageType === PAGE_TYPES.GROUP_CONFIGURE_MEMBERS) {
				await initializeGroupConfigureObserver();
			} else {
				const config = createObserverConfig();

				observer = observerFactory.createListObserver(config);
				await observer.start();
			}

			logger.debug(`UserListManager observer started for ${pageType}`);
		} catch (error) {
			logger.error('Failed to initialize UserListManager observer:', error);
			onError?.('Failed to initialize user list processing');
		}
	}

	// Initialize observer for paginated pages
	async function initializePaginatedPageObserver(pageConfig: {
		pageName: string;
		containerSelector: string;
		itemSelector: string;
		observerName: string;
	}) {
		containerWatcher = observerFactory.createContainerWatcher({
			name: `${pageConfig.pageName}-container-watcher`,
			containerSelector: pageConfig.containerSelector,
			onContainerAdded: (container: Element) => {
				// Process all items in the new container
				const items = Array.from(container.querySelectorAll(pageConfig.itemSelector));
				if (items.length > 0) {
					void handleNewUsers(items);
				}

				// Restart the list observer on the new container
				if (observer) {
					observer.stop();
					observer.cleanup();
				}

				// Create new list observer for the new container
				const config = createObserverConfig({
					name: pageConfig.observerName,
					processExistingItems: false,
					restartDelay: 500
				});

				observer = observerFactory.createListObserver(config);
				void observer.start();

				// Clean up orphaned components from the previous container
				cleanupOrphanedComponents();
			}
		});

		// Start the container watcher
		await containerWatcher.start();

		// Create initial list observer if container already exists
		const existingContainer = document.querySelector(pageConfig.containerSelector);
		if (existingContainer) {
			const config = createObserverConfig({
				name: pageConfig.observerName,
				restartDelay: 500
			});

			observer = observerFactory.createListObserver(config);
			await observer.start();
		}
	}

	// Initialize observer for friends page
	async function initializeFriendsPageObserver() {
		await initializePaginatedPageObserver({
			pageName: 'Friends',
			containerSelector: FRIENDS_SELECTORS.CONTAINER,
			itemSelector: FRIENDS_SELECTORS.CARD.CONTAINER,
			observerName: 'friends-list-observer'
		});
	}

	// Initialize observer for search page
	async function initializeSearchPageObserver() {
		await initializePaginatedPageObserver({
			pageName: 'Search',
			containerSelector: SEARCH_SELECTORS.CONTAINER,
			itemSelector: SEARCH_SELECTORS.CARD.CONTAINER,
			observerName: 'search-list-observer'
		});
	}

	// Initialize observer for group configure members page
	async function initializeGroupConfigureObserver() {
		await initializePaginatedPageObserver({
			pageName: 'GroupConfigure',
			containerSelector: GROUP_CONFIGURE_SELECTORS.CONTAINER,
			itemSelector: GROUP_CONFIGURE_SELECTORS.CARD.CONTAINER,
			observerName: 'group-configure-list-observer'
		});
	}

	// Initialize observer for modal-based member list
	async function initializeGroupsModalObserver() {
		logger.debug('Initializing groups modal observer');

		modalContainerWatcher = observerFactory.createContainerWatcher({
			name: 'groups-modal-watcher',
			containerSelector: GROUPS_MODAL_SELECTORS.MODAL,
			onContainerAdded: (modal: Element) => {
				logger.debug('Groups modal opened via watcher, setting up observer');
				void setupModalListObserver(modal);
			}
		});

		await modalContainerWatcher.start();
		logger.debug('Groups modal container watcher started');

		const existingModal = document.querySelector(GROUPS_MODAL_SELECTORS.MODAL);
		if (existingModal) {
			logger.debug('Existing modal found on init');
			void setupModalListObserver(existingModal);
		}
	}

	// Set up list observer for items in modal
	async function setupModalListObserver(modal: Element) {
		logger.debug('Setting up modal list observer');

		// Clean up existing modal observer
		if (modalObserver) {
			modalObserver.stop();
			modalObserver.cleanup();
			modalObserver = null;
		}

		// Wait for virtual list container if not present
		const vlist = modal.querySelector(GROUPS_MODAL_SELECTORS.VLIST);
		logger.debug('Modal vlist search result', {
			found: !!vlist,
			selector: GROUPS_MODAL_SELECTORS.VLIST
		});

		if (!vlist) {
			logger.debug('Waiting for vlist to appear in modal');
			if (vlistWaitObserver) {
				vlistWaitObserver.disconnect();
				vlistWaitObserver = null;
			}
			vlistWaitObserver = new MutationObserver((_, obs) => {
				if (destroyed) {
					obs.disconnect();
					return;
				}
				const foundVlist = modal.querySelector(GROUPS_MODAL_SELECTORS.VLIST);
				if (foundVlist) {
					logger.debug('Vlist appeared in modal');
					obs.disconnect();
					vlistWaitObserver = null;
					void createModalListObserver(modal);
				}
			});
			vlistWaitObserver.observe(modal, { childList: true, subtree: true });
			return;
		}

		await createModalListObserver(modal);
	}

	async function createModalListObserver(modal: Element) {
		logger.debug('Creating modal list observer');

		modalObserver = observerFactory.createListObserver({
			name: 'groups-modal-list-observer',
			containerSelector: GROUPS_MODAL_SELECTORS.VLIST,
			unprocessedItemSelector: GROUPS_MODAL_SELECTORS.ITEM,
			processItems: handleNewUsers,
			processExistingItems: true,
			restartDelay: 500
		});

		await modalObserver.start();

		setupModalCloseWatcher(modal);

		logger.debug('Groups modal list observer started');
	}

	// Watch for modal removal from DOM
	function setupModalCloseWatcher(modal: Element) {
		if (modalCloseObserver) {
			modalCloseObserver.disconnect();
			modalCloseObserver = null;
		}

		modalCloseObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.removedNodes)) {
					if (node === modal || (node instanceof Element && node.contains(modal))) {
						logger.debug('Groups modal closed, cleaning up observer');
						cleanupActiveModal();
						return;
					}
				}
			}
		});

		modalCloseObserver.observe(document.body, { childList: true, subtree: true });
	}

	// Clean up active modal session observers
	function cleanupActiveModal() {
		if (modalObserver) {
			modalObserver.stop();
			modalObserver.cleanup();
			modalObserver = null;
		}

		if (modalCloseObserver) {
			modalCloseObserver.disconnect();
			modalCloseObserver = null;
		}

		if (vlistWaitObserver) {
			vlistWaitObserver.disconnect();
			vlistWaitObserver = null;
		}
	}

	// Clean up all modal observers including container watcher
	function cleanupModalObserver() {
		cleanupActiveModal();

		if (modalContainerWatcher) {
			modalContainerWatcher.stop();
			modalContainerWatcher.cleanup();
			modalContainerWatcher = null;
		}
	}

	// Process new users found by the observer
	async function handleNewUsers(items: Element[]) {
		const endTrace = startTrace(TRACE_CATEGORIES.DOM, 'handleNewUsers', {
			itemCount: items.length,
			pageType
		});
		try {
			// Figure out which elements are new vs which ones Roblox is reusing
			const unprocessedElements: Element[] = [];
			const reusedElements: { element: Element; oldUserId: string; newUserId: string }[] = [];

			for (const item of items) {
				const storedUserId = isProcessed(item);

				if (storedUserId === null) {
					// Brand new element we haven't seen before
					unprocessedElements.push(item);
				} else {
					// We've seen this element before - check if Roblox changed the user inside it
					const currentUserDetails = extractUserDetails(item);
					if (currentUserDetails && currentUserDetails.userId !== storedUserId) {
						// Yep, Roblox reused this element for a different user (happens during pagination)
						reusedElements.push({
							element: item,
							oldUserId: storedUserId,
							newUserId: currentUserDetails.userId
						});
						unprocessedElements.push(item);
					}
				}
			}

			// Clean up the old status indicators from reused elements
			if (reusedElements.length > 0) {
				logger.debug(
					`Detected ${reusedElements.length} reused DOM elements for ${pageType}`,
					reusedElements.map((r) => ({ old: r.oldUserId, new: r.newUserId }))
				);

				for (const { element, oldUserId } of reusedElements) {
					resetElementBlur(element);

					const oldComponent = mountedComponents.get(oldUserId);
					if (oldComponent) {
						try {
							oldComponent.unmount?.();
						} catch (error) {
							logger.error('Failed to unmount old component for reused element:', error);
						}
						mountedComponents.delete(oldUserId);
					}
				}
			}

			// Nothing new to process
			if (unprocessedElements.length === 0) return;

			logger.debug(`Processing ${unprocessedElements.length} new users for ${pageType}`);

			// Extract user details
			const allUserDetails = unprocessedElements
				.map(extractUserDetails)
				.filter((user): user is UserDetails => user !== null);

			if (allUserDetails.length === 0) return;

			// Separate users into new and returning
			const newUsers: UserDetails[] = [];
			const returningUsers: UserDetails[] = [];

			allUserDetails.forEach((user) => {
				if (processedUsers.has(user.userId)) {
					// We've seen this user before, just need to re-mount their indicator
					returningUsers.push(user);
				} else {
					// First time seeing this user, need to fetch their data
					newUsers.push(user);
				}
			});

			// Mark elements as processed and store which user they contain
			allUserDetails.forEach((user) => {
				markAsProcessed(user.element, user.userId);
			});

			// Process new users
			if (newUsers.length > 0) {
				newUsers.forEach((user) => {
					processedUsers.add(user.userId);
				});

				// Mark elements for blur tracking
				newUsers.forEach((user) => {
					markUserElementForBlur(user.element, user.userId, pageType);
				});

				// Mount status indicators with loading state
				newUsers.forEach((user) => {
					mountStatusIndicator(user, true);
				});

				// Load user statuses in batches
				await loadUserStatuses(newUsers);

				// Reveal safe content, mark flagged users, and remount status indicators
				newUsers.forEach((user) => {
					const status = userStatuses.get(user.userId);
					if (status) {
						revealUserElement(user.element, status);
						if (isFlagged(status)) {
							user.element.setAttribute(STATUS_SELECTORS.DATA_FLAGGED, 'true');
						}
					}
					mountStatusIndicator(user, false);
				});
			}

			// Process returning users
			returningUsers.forEach((user) => {
				const status = userStatuses.get(user.userId);
				markUserElementForBlur(user.element, user.userId, pageType);
				if (status) {
					revealUserElement(user.element, status);
					if (isFlagged(status)) {
						user.element.setAttribute(STATUS_SELECTORS.DATA_FLAGGED, 'true');
					}
				}
				mountStatusIndicator(user, false);
			});
		} catch (error) {
			logger.error('Failed to process new users:', error);
			onError?.('Failed to process user list');
		} finally {
			endTrace();
		}
	}

	// Extract user details from DOM element
	function extractUserDetails(element: Element): UserDetails | null {
		try {
			let profileLink: Element | null = null;

			// Check if this is a modal item
			const isModalItem = element.closest(GROUPS_MODAL_SELECTORS.MODAL) !== null;

			if (isModalItem) {
				profileLink = element.querySelector(GROUPS_MODAL_SELECTORS.PROFILE_LINK);
			} else {
				profileLink = element.querySelector(getPageConfig().profileLinkSelector);
			}

			if (!profileLink) {
				return null;
			}

			const href = profileLink.getAttribute('href');
			if (!href) return null;

			const userIdMatch = href.match(/\/users\/(\d+)/);
			if (!userIdMatch) return null;

			const userId = sanitizeEntityId(userIdMatch[1]);
			if (!userId) return null;

			return {
				userId: userId.toString(),
				element,
				profileLink
			};
		} catch (error) {
			logger.error('Failed to extract user details:', error);
			return null;
		}
	}

	// Check if element has been processed before
	// Returns the user ID that was stored on the element, or null if never processed
	function isProcessed(element: Element): string | null {
		if (!element.hasAttribute(STATUS_SELECTORS.DATA_PROCESSED)) {
			return null;
		}
		return element.getAttribute(STATUS_SELECTORS.DATA_USER_ID);
	}

	// Mark element as processed and remember which user ID it contains
	function markAsProcessed(element: Element, userId: string): void {
		element.setAttribute(STATUS_SELECTORS.DATA_PROCESSED, 'true');
		element.setAttribute(STATUS_SELECTORS.DATA_USER_ID, userId);
	}

	// Determine if current lookup is for user's own friends
	function isOwnFriendsLookup(): boolean {
		const loggedInUserId = getLoggedInUserId();
		if (!loggedInUserId) return false;

		// Home page always shows own friends
		if (pageType === PAGE_TYPES.HOME) return true;

		// Friends list page: check URL
		if (pageType === PAGE_TYPES.FRIENDS_LIST) {
			const pathname = window.location.pathname;
			// /users/friends = own friends list (no user ID in URL)
			// /users/{userId}/friends = specific user's friends list
			if (pathname === '/users/friends' || pathname === '/users/friends/') {
				return true;
			}
			const match = pathname.match(/\/users\/(\d+)\/friends/);
			return match?.[1] === loggedInUserId;
		}

		// Profile carousel: check if viewing own profile
		if (pageType === PAGE_TYPES.FRIENDS_CAROUSEL || pageType === PAGE_TYPES.PROFILE) {
			return profileOwnerId === loggedInUserId;
		}

		return false;
	}

	// Load user statuses from API with caching
	async function loadUserStatuses(users: UserDetails[]) {
		const endTrace = startTrace(TRACE_CATEGORIES.API, 'loadUserStatuses', {
			userCount: users.length,
			pageType
		});
		try {
			const userIds = users.map((u) => u.userId);

			// Mark as loading
			userIds.forEach((id) => loadingUsers.add(id));

			// Query all APIs
			const lookupContext = isOwnFriendsLookup() ? LOOKUP_CONTEXT.FRIENDS : undefined;
			const customApiResults = await queryMultipleUsers(userIds, lookupContext);

			// Store combined statuses
			customApiResults.forEach((combinedStatus, userId) => {
				userStatuses.set(userId, combinedStatus);
				loadingUsers.delete(userId);

				onUserProcessed?.(userId, combinedStatus);
			});

			logger.debug(`Loaded ${customApiResults.size} user statuses for ${pageType}`);
		} catch (error) {
			logger.error('Failed to load user statuses:', error);

			// Clear loading state
			users.forEach((u) => loadingUsers.delete(u.userId));

			onError?.('Failed to load user status information');
		} finally {
			endTrace();
		}
	}

	// Mount status indicator for a user
	function mountStatusIndicator(user: UserDetails, isLoading = false) {
		const endTrace = startTrace(TRACE_CATEGORIES.COMPONENT, 'mountStatusIndicator', {
			userId: user.userId,
			isLoading,
			pageType
		});
		try {
			const status = userStatuses.get(user.userId);

			if (!isLoading && !status) {
				logger.warn(`No status found for user ${user.userId} - skipping mount`);
				return;
			}

			const existingComponent = mountedComponents.get(user.userId);
			if (existingComponent) {
				existingComponent.unmount?.();
				mountedComponents.delete(user.userId);
			}

			if (!(user.element instanceof HTMLElement)) {
				logger.warn('User element is not an HTMLElement, skipping positioning');
				return;
			}

			const tileElement = user.element;

			// Check if this is a modal item
			const isModalItem = tileElement.closest(GROUPS_MODAL_SELECTORS.MODAL) !== null;

			let targetElement: HTMLElement;
			let showText = false;

			if (isModalItem) {
				targetElement = tileElement.querySelector(
					GROUPS_MODAL_SELECTORS.TEXT_CONTAINER
				) as HTMLElement;
				showText = true;
			} else if (pageType === PAGE_TYPES.GROUP_CONFIGURE_MEMBERS) {
				targetElement = tileElement.querySelector(
					GROUP_CONFIGURE_SELECTORS.CARD.CAPTION_INNER
				) as HTMLElement;
				showText = true;
			} else {
				const targetSelectors: Record<string, string> = {
					[PAGE_TYPES.FRIENDS_LIST]: FRIENDS_SELECTORS.CARD.FULLBODY,
					[PAGE_TYPES.SEARCH_USER]: SEARCH_SELECTORS.CARD.FULLBODY,
					[PAGE_TYPES.FRIENDS_CAROUSEL]: FRIENDS_CAROUSEL_SELECTORS.TILE_CONTENT,
					[PAGE_TYPES.HOME]: FRIENDS_CAROUSEL_SELECTORS.TILE_CONTENT,
					[PAGE_TYPES.PROFILE]: '',
					[PAGE_TYPES.REPORT]: ''
				};

				const targetSelector = targetSelectors[pageType];
				if (targetSelector === undefined) {
					throw new Error(`No target selector defined for page type: ${pageType}`);
				}

				targetElement = targetSelector
					? (tileElement.querySelector(targetSelector) as HTMLElement)
					: tileElement;
			}

			let container = targetElement.querySelector(
				`.${COMPONENT_CLASSES.STATUS_CONTAINER}`
			) as HTMLElement;
			if (!container) {
				container = document.createElement('div');
				container.className = COMPONENT_CLASSES.STATUS_CONTAINER;

				const needsAbsolutePosition =
					!isModalItem &&
					(pageType === PAGE_TYPES.FRIENDS_CAROUSEL ||
						pageType === PAGE_TYPES.HOME ||
						pageType === PAGE_TYPES.FRIENDS_LIST ||
						pageType === PAGE_TYPES.SEARCH_USER);

				if (needsAbsolutePosition) {
					container.classList.add(COMPONENT_CLASSES.STATUS_POSITIONED_ABSOLUTE);
					if (
						targetElement.style.position !== 'relative' &&
						targetElement.style.position !== 'absolute'
					) {
						targetElement.style.position = 'relative';
					}
				}

				targetElement.appendChild(container);
			}

			container.innerHTML = '';
			const component = mount(StatusIndicator, {
				target: container,
				props: {
					entityId: user.userId,
					entityType: ENTITY_TYPES.USER,
					entityStatus: isLoading ? null : status,
					showText,
					skipAutoFetch: true,
					onClick: handleStatusClick,
					onQueue: handleQueueUser
				}
			});

			mountedComponents.set(user.userId, component);

			logger.debug(`Status indicator mounted for user ${user.userId} on ${pageType}`, {
				isLoading,
				isModalItem
			});
			endTrace();
		} catch (error) {
			endTrace({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
			logger.error('Failed to mount status indicator:', error, {
				userId: user.userId,
				pageType,
				hasStatus: !!userStatuses.get(user.userId)
			});
		}
	}

	// Handle status indicator click
	function handleStatusClick(userId: string) {
		logger.userAction(`${pageType}_${USER_ACTIONS.STATUS_CLICKED}`, { userId });
	}

	// Clean up components for DOM elements that have been removed
	function cleanupOrphanedComponents() {
		const orphanedUserIds = new SvelteSet<string>();

		// Check each mounted component to see if its DOM element still exists
		for (const [userId] of mountedComponents.entries()) {
			// Try to find the user's element in the current DOM
			const selector = `[${STATUS_SELECTORS.DATA_PROCESSED}] [href*="/users/${userId}"]`;
			const element = document
				.querySelector(selector)
				?.closest(`[${STATUS_SELECTORS.DATA_PROCESSED}]`);

			if (!element || !document.contains(element)) {
				// Element no longer exists in DOM, mark for cleanup
				orphanedUserIds.add(userId);
			}
		}

		// Clean up orphaned components
		if (orphanedUserIds.size > 0) {
			logger.debug(`Cleaning up ${orphanedUserIds.size} orphaned components for ${pageType}`);

			orphanedUserIds.forEach((userId) => {
				const component = mountedComponents.get(userId);
				if (component) {
					try {
						component.unmount?.();
					} catch (error) {
						logger.error('Failed to unmount orphaned component:', error);
					}
					mountedComponents.delete(userId);
				}
			});
		}
	}

	// Handle queue user action
	function handleQueueUser(userId: string) {
		logger.userAction(`${pageType}_queue_requested`, { userId });
		queueModalManager?.showQueue(userId);
	}

	// Handle status refresh after successful queue operation
	async function handleStatusRefresh(userId: string) {
		try {
			// Refresh user status
			const newStatus = await queryUser(userId);
			userStatuses.set(userId, newStatus);

			// Re-mount status indicator with updated status
			const userElement = document
				.querySelector(`[${STATUS_SELECTORS.DATA_PROCESSED}] [href*="/users/${userId}"]`)
				?.closest(`[${STATUS_SELECTORS.DATA_PROCESSED}]`);
			if (userElement) {
				// Find and update existing status indicator
				const statusContainer = userElement.querySelector(`.${COMPONENT_CLASSES.STATUS_CONTAINER}`);
				if (statusContainer) {
					statusContainer.remove();
					const user = extractUserDetails(userElement);
					if (user) {
						mountStatusIndicator(user);
					}
				}
			}
		} catch (error) {
			logger.error('Failed to refresh status after queue operation:', error);
		}
	}

	// Cleanup resources
	function cleanup() {
		destroyed = true;

		if (observer) {
			observer.stop();
			observer.cleanup();
			observer = null;
		}

		if (containerWatcher) {
			containerWatcher.stop();
			containerWatcher.cleanup();
			containerWatcher = null;
		}

		// Cleanup modal observers
		cleanupModalObserver();

		// Cleanup mounted components
		for (const component of mountedComponents.values()) {
			try {
				component.unmount?.();
			} catch (error) {
				logger.error('Failed to unmount component:', error);
			}
		}

		processedUsers.clear();
		userStatuses.clear();
		loadingUsers.clear();
		mountedComponents.clear();

		logger.debug(`UserListManager cleanup completed for ${pageType}`);
	}
</script>

<!-- Queue Modal Manager -->
<QueueModalManager bind:this={queueModalManager} onStatusRefresh={handleStatusRefresh} />
