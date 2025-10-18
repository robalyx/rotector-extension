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
		GROUPS_SELECTORS,
		PAGE_TYPES,
		SEARCH_SELECTORS,
		USER_ACTIONS
	} from '@/lib/types/constants';
	import { userStatusService } from '@/lib/services/entity-status-service';
	import { sanitizeEntityId } from '@/lib/utils/sanitizer';
	import { logger } from '@/lib/utils/logger';
	import type { PageType, UserStatus } from '@/lib/types/api';
	import StatusIndicator from '../status/StatusIndicator.svelte';
	import type { QueueModalManagerInstance } from '@/lib/types/components';
	import QueueModalManager from './QueueModalManager.svelte';

	interface Props {
		pageType: PageType;
		onUserProcessed?: (userId: string, status: UserStatus) => void;
		onError?: (error: string) => void;
		onMount?: (cleanup: () => void) => void;
	}

	let { pageType, onUserProcessed, onError, onMount }: Props = $props();

	// Local state
	let observer: Observer | null = null;
	let containerWatcher: Observer | null = null;
	let processedUsers = new SvelteSet<string>();
	let userStatuses = new SvelteMap<string, UserStatus>();
	let loadingUsers = new SvelteSet<string>();
	let mountedComponents = new SvelteMap<string, { destroy?: () => void }>();
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
		[PAGE_TYPES.MEMBERS]: {
			containerSelector: GROUPS_SELECTORS.CONTAINER,
			itemSelector: GROUPS_SELECTORS.TILE,
			profileLinkSelector: GROUPS_SELECTORS.PROFILE_LINK
		},
		[PAGE_TYPES.SEARCH_USER]: {
			containerSelector: SEARCH_SELECTORS.CONTAINER,
			itemSelector: SEARCH_SELECTORS.CARD.CONTAINER,
			profileLinkSelector: SEARCH_SELECTORS.PROFILE_LINK
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
		}, 5000);

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
				await initializeGroupsPageObserver();
			} else if (pageType === PAGE_TYPES.SEARCH_USER) {
				await initializeSearchPageObserver();
			} else {
				const config = createObserverConfig();

				observer = observerFactory.createListObserver(config);
				await observer.start();
			}

			logger.debug(`UserListManager observer started for ${pageType}`);

			await warmCacheForVisibleUsers();
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
				logger.debug(`${pageConfig.pageName} container detected/replaced, processing new items`);

				// Process all items in the new container immediately
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

	// Initialize observer for groups page
	async function initializeGroupsPageObserver() {
		await initializePaginatedPageObserver({
			pageName: 'Groups',
			containerSelector: GROUPS_SELECTORS.CONTAINER,
			itemSelector: GROUPS_SELECTORS.TILE,
			observerName: 'groups-list-observer'
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

	// Get container selector based on page type
	function getContainerSelector(): string {
		return getPageConfig().containerSelector;
	}

	// Get user item selector based on page type
	function getUserItemSelector(): string {
		return getPageConfig().itemSelector;
	}

	// Process new users found by the observer
	async function handleNewUsers(items: Element[]) {
		try {
			const userElements = items.filter((item) => !isProcessed(item));
			if (userElements.length === 0) return;

			logger.debug(`Processing ${userElements.length} new users for ${pageType}`);

			// Extract user details
			const allUserDetails = userElements
				.map(extractUserDetails)
				.filter((user): user is UserDetails => user !== null);

			if (allUserDetails.length === 0) return;

			// Separate users into new and returning
			const newUsers: UserDetails[] = [];
			const returningUsers: UserDetails[] = [];

			allUserDetails.forEach((user) => {
				if (processedUsers.has(user.userId)) {
					// User was processed before but DOM element is new
					returningUsers.push(user);
				} else {
					// Completely new user
					newUsers.push(user);
				}
			});

			// Mark all as processed (DOM-wise)
			allUserDetails.forEach((user) => {
				markAsProcessed(user.element);
			});

			// Process new users
			if (newUsers.length > 0) {
				newUsers.forEach((user) => {
					processedUsers.add(user.userId);
				});

				// Mount status indicators immediately with loading state
				newUsers.forEach((user) => {
					mountStatusIndicator(user, true);
				});

				// Load user statuses in batches
				await loadUserStatuses(newUsers);

				// Remount status indicators with actual data
				newUsers.forEach((user) => {
					if (userStatuses.has(user.userId)) {
						mountStatusIndicator(user, false);
					}
				});
			}

			// Re-mount status indicators for returning users
			returningUsers.forEach((user) => {
				if (userStatuses.has(user.userId)) {
					mountStatusIndicator(user, false);
				}
			});
		} catch (error) {
			logger.error('Failed to process new users:', error);
			onError?.('Failed to process user list');
		}
	}

	// Extract user details from DOM element
	function extractUserDetails(element: Element): UserDetails | null {
		try {
			let profileLink: Element | null = null;

			// Get the appropriate profile link selector based on page type
			profileLink = element.querySelector(getPageConfig().profileLinkSelector);

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

	// Check if element is already processed
	function isProcessed(element: Element): boolean {
		return element.hasAttribute('data-rotector-processed');
	}

	// Mark element as processed
	function markAsProcessed(element: Element): void {
		element.setAttribute('data-rotector-processed', 'true');
	}

	// Load user statuses from API with caching
	async function loadUserStatuses(users: UserDetails[]) {
		try {
			const userIds = users.map((u) => u.userId);

			// Mark as loading
			userIds.forEach((id) => loadingUsers.add(id));

			// Use cached batch request
			const statusMap = await userStatusService.getStatuses(userIds);

			// Store statuses
			statusMap.forEach((status, userId) => {
				if (status) {
					userStatuses.set(userId, status);
				}
				loadingUsers.delete(userId);

				// Notify parent
				if (status) {
					onUserProcessed?.(userId, status);
				}
			});

			logger.debug(`Loaded ${statusMap.size} user statuses for ${pageType}`);
		} catch (error) {
			logger.error('Failed to load user statuses:', error);

			// Clear loading state
			users.forEach((u) => loadingUsers.delete(u.userId));

			onError?.('Failed to load user status information');
		}
	}

	// Mount status indicator for a user
	function mountStatusIndicator(user: UserDetails, isLoading = false) {
		try {
			const status = userStatuses.get(user.userId);

			if (!isLoading && !status) {
				logger.warn(`No status found for user ${user.userId} - skipping mount`);
				return;
			}

			const existingComponent = mountedComponents.get(user.userId);
			if (existingComponent) {
				existingComponent.destroy?.();
				mountedComponents.delete(user.userId);
			}

			if (!(user.element instanceof HTMLElement)) {
				logger.warn('User element is not an HTMLElement, skipping positioning');
				return;
			}

			const tileElement = user.element;

			const targetSelectors: Record<string, string> = {
				[PAGE_TYPES.FRIENDS_LIST]: FRIENDS_SELECTORS.CARD.FULLBODY,
				[PAGE_TYPES.SEARCH_USER]: SEARCH_SELECTORS.CARD.FULLBODY,
				[PAGE_TYPES.FRIENDS_CAROUSEL]: FRIENDS_CAROUSEL_SELECTORS.TILE_CONTENT,
				[PAGE_TYPES.MEMBERS]: '',
				[PAGE_TYPES.HOME]: '',
				[PAGE_TYPES.PROFILE]: '',
				[PAGE_TYPES.REPORT]: ''
			};

			const targetSelector = targetSelectors[pageType];
			if (targetSelector === undefined) {
				throw new Error(`No target selector defined for page type: ${pageType}`);
			}

			const targetElement = targetSelector
				? (tileElement.querySelector(targetSelector) as HTMLElement) || tileElement
				: tileElement;

			let container = targetElement.querySelector(
				`.${COMPONENT_CLASSES.STATUS_CONTAINER}`
			) as HTMLElement;
			if (!container) {
				container = document.createElement('div');
				container.className = COMPONENT_CLASSES.STATUS_CONTAINER;

				const needsAbsolutePosition =
					pageType === PAGE_TYPES.FRIENDS_CAROUSEL ||
					pageType === PAGE_TYPES.MEMBERS ||
					pageType === PAGE_TYPES.FRIENDS_LIST ||
					pageType === PAGE_TYPES.SEARCH_USER;

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
					status: isLoading ? null : status,
					loading: isLoading,
					showText: false,
					skipAutoFetch: true,
					onClick: handleStatusClick,
					onQueue: handleQueueUser
				}
			});

			mountedComponents.set(user.userId, component);

			logger.debug(`Status indicator mounted for user ${user.userId} on ${pageType}`, {
				isLoading,
				statusType: status?.flagType,
				targetElement: targetSelector ? 'fullbody' : 'tile'
			});
		} catch (error) {
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
			const selector = `[data-rotector-processed] [href*="/users/${userId}"]`;
			const element = document.querySelector(selector)?.closest('[data-rotector-processed]');

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
						component.destroy?.();
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
			const newStatus = await userStatusService.getStatus(userId);
			if (newStatus) {
				userStatuses.set(userId, newStatus);
			}

			// Re-mount status indicator with updated status
			const userElement = document
				.querySelector(`[data-rotector-processed] [href*="/users/${userId}"]`)
				?.closest('[data-rotector-processed]');
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

	// Warm the cache with visible users on page load
	async function warmCacheForVisibleUsers() {
		try {
			const selector = getUserItemSelector();
			const container = document.querySelector(getContainerSelector());
			if (!container) return;

			const visibleUsers = container.querySelectorAll(selector);
			const userIds: string[] = [];

			visibleUsers.forEach((element) => {
				const user = extractUserDetails(element);
				if (user && !processedUsers.has(user.userId)) {
					userIds.push(user.userId);
				}
			});

			if (userIds.length > 0) {
				logger.debug('Warming cache for visible users', { count: userIds.length });
				await userStatusService.warmCache(userIds);
			}
		} catch (error) {
			logger.error('Failed to warm cache:', error);
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

		// Cleanup mounted components
		for (const component of mountedComponents.values()) {
			try {
				component.destroy?.();
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
