<script lang="ts">
	import { mount, onMount as svelteOnMount } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { Observer } from '@/lib/utils/dom/observer';
	import { observerFactory } from '@/lib/utils/dom/observer';
	import { MountedComponentRegistry } from '@/lib/utils/dom/mounted-component-registry';
	import { waitForElement } from '@/lib/utils/dom/element-waiter';
	import {
		COMPONENT_CLASSES,
		ENTITY_TYPES,
		LOOKUP_CONTEXT,
		PAGE_TYPES,
		STATUS_SELECTORS,
		USER_ACTIONS
	} from '@/lib/types/constants';
	import {
		FRIENDS_CAROUSEL_SELECTORS,
		FRIENDS_SELECTORS
	} from '@/lib/controllers/selectors/friends';
	import {
		GROUP_CONFIGURE_SELECTORS,
		GROUPS_MODAL_SELECTORS
	} from '@/lib/controllers/selectors/groups';
	import { SEARCH_SELECTORS } from '@/lib/controllers/selectors/search';
	import { asApiError } from '@/lib/utils/api/api-error';
	import { createAbortableBatch } from '@/lib/utils/api/abortable-batch';
	import { extractIdFromUrl } from '@/lib/utils/dom/sanitizer';
	import { logger } from '@/lib/utils/logging/logger';
	import { startTrace } from '@/lib/utils/logging/perf-tracer';
	import { TRACE_CATEGORIES } from '@/lib/types/performance';
	import { getLoggedInUserId } from '@/lib/utils/client-id';
	import type { PageType } from '@/lib/types/api';
	import type { UserStatus } from '@/lib/types/api';
	import type { CombinedStatus } from '@/lib/types/custom-api';
	import { queryMultipleUsers } from '@/lib/services/rotector/unified-query';
	import {
		markUserElementForBlur,
		resetElementBlur,
		revealUserElement
	} from '@/lib/services/blur/service';
	import { isFlagged, createErrorCombinedStatus } from '@/lib/utils/status/status-utils';
	import { restrictedAccessStore } from '@/lib/stores/restricted-access';
	import StatusIndicator from '../../status/StatusIndicator.svelte';
	import type { QueueModalManagerInstance } from '../queue/queue-modal-manager';
	import QueueModalManager from '../queue/QueueModalManager.svelte';

	interface Props {
		pageType: PageType;
		profileOwnerId?: string;
		onUserProcessed?: (userId: string, status: CombinedStatus<UserStatus>) => void;
		onMount?: (cleanup: () => void) => void;
	}

	let { pageType, profileOwnerId, onUserProcessed, onMount }: Props = $props();

	let observer: Observer | null = null;
	let containerWatcher: Observer | null = null;
	let modalObserver: Observer | null = null;
	let modalContainerWatcher: Observer | null = null;
	let modalCloseObserver: MutationObserver | null = null;
	let processedUsers = new SvelteSet<string>();
	let userStatuses = new SvelteMap<string, CombinedStatus<UserStatus>>();
	const mountedComponents = new MountedComponentRegistry<string>();
	let destroyed = $state(false);
	const batch = createAbortableBatch();

	let queueModalManager: QueueModalManagerInstance;

	interface UserDetails {
		userId: string;
		element: Element;
		profileLink: Element;
	}

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
		[PAGE_TYPES.HOME]: FRIENDS_CAROUSEL_CONFIG
	};

	function getPageConfig() {
		if (!(pageType in PAGE_CONFIGS)) {
			throw new Error(`UserListManager does not support page type: ${pageType}`);
		}
		return PAGE_CONFIGS[pageType as keyof typeof PAGE_CONFIGS];
	}

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
			pageType === PAGE_TYPES.FRIENDS_CAROUSEL || pageType === PAGE_TYPES.HOME;

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

	svelteOnMount(() => {
		onMount?.(cleanup);

		void initializeObserver();

		const cleanupInterval = setInterval(() => {
			cleanupOrphanedComponents();
		}, 10000);

		return () => {
			clearInterval(cleanupInterval);
			cleanup();
		};
	});

	async function initializeObserver() {
		if (destroyed) return;

		try {
			if (pageType === PAGE_TYPES.FRIENDS_LIST) {
				await initializePaginatedPageObserver({
					pageName: 'Friends',
					containerSelector: FRIENDS_SELECTORS.CONTAINER,
					itemSelector: FRIENDS_SELECTORS.CARD.CONTAINER,
					observerName: 'friends-list-observer'
				});
			} else if (pageType === PAGE_TYPES.MEMBERS) {
				await initializeGroupsModalObserver();
			} else if (pageType === PAGE_TYPES.SEARCH_USER) {
				await initializePaginatedPageObserver({
					pageName: 'Search',
					containerSelector: SEARCH_SELECTORS.CONTAINER,
					itemSelector: SEARCH_SELECTORS.CARD.CONTAINER,
					observerName: 'search-list-observer'
				});
			} else if (pageType === PAGE_TYPES.GROUP_CONFIGURE_MEMBERS) {
				await initializePaginatedPageObserver({
					pageName: 'GroupConfigure',
					containerSelector: GROUP_CONFIGURE_SELECTORS.CONTAINER,
					itemSelector: GROUP_CONFIGURE_SELECTORS.CARD.CONTAINER,
					observerName: 'group-configure-list-observer'
				});
			} else {
				const config = createObserverConfig();

				observer = observerFactory.createListObserver(config);
				await observer.start();
			}

			logger.debug(`UserListManager observer started for ${pageType}`);
		} catch (error) {
			logger.error('Failed to initialize UserListManager observer:', error);
		}
	}

	// Watches the paginated container so the list observer is rebuilt and orphans cleared whenever Roblox swaps the underlying container
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
				observer?.stop();

				const config = createObserverConfig({
					name: pageConfig.observerName,
					processExistingItems: false,
					restartDelay: 500
				});

				observer = observerFactory.createListObserver(config);
				void observer.start();

				cleanupOrphanedComponents();
			}
		});

		await containerWatcher.start();

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

	// Tears down any prior modal observer and waits for the virtual list before attaching, bailing if the modal closes mid-wait
	async function setupModalListObserver(modal: Element) {
		logger.debug('Setting up modal list observer');

		if (modalObserver) {
			modalObserver.stop();
			modalObserver = null;
		}

		// Wait for virtual list container
		const { success } = await waitForElement(GROUPS_MODAL_SELECTORS.VLIST);
		if (!success || destroyed || !document.contains(modal)) return;

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

	function cleanupActiveModal() {
		modalObserver?.stop();
		modalObserver = null;

		modalCloseObserver?.disconnect();
		modalCloseObserver = null;
	}

	function cleanupModalObserver() {
		cleanupActiveModal();
		modalContainerWatcher?.stop();
		modalContainerWatcher = null;
	}

	// Detects DOM elements that Roblox reused for a different user during pagination, resets their blur, and remounts indicators
	async function handleNewUsers(items: Element[]) {
		const endTrace = startTrace(TRACE_CATEGORIES.DOM, 'handleNewUsers', {
			itemCount: items.length,
			pageType
		});
		try {
			const unprocessedElements: Element[] = [];
			const reusedElements: { element: Element; oldUserId: string; newUserId: string }[] = [];

			for (const item of items) {
				const storedUserId = item.hasAttribute(STATUS_SELECTORS.DATA_PROCESSED)
					? item.getAttribute(STATUS_SELECTORS.DATA_USER_ID)
					: null;

				if (storedUserId === null) {
					// Brand new element we haven't seen before
					unprocessedElements.push(item);
				} else {
					// We've seen this element before so check if Roblox changed the user inside it
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

			if (reusedElements.length > 0) {
				logger.debug(
					`Detected ${String(reusedElements.length)} reused DOM elements for ${pageType}`,
					reusedElements.map((r) => ({ old: r.oldUserId, new: r.newUserId }))
				);

				for (const { element, oldUserId } of reusedElements) {
					resetElementBlur(element);
					mountedComponents.removeOne(oldUserId);
				}
			}

			if (unprocessedElements.length === 0) return;

			logger.debug(`Processing ${String(unprocessedElements.length)} new users for ${pageType}`);

			const allUserDetails = unprocessedElements
				.map(extractUserDetails)
				.filter((user): user is UserDetails => user !== null);

			if (allUserDetails.length === 0) return;

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

			allUserDetails.forEach((user) => {
				user.element.setAttribute(STATUS_SELECTORS.DATA_PROCESSED, 'true');
				user.element.setAttribute(STATUS_SELECTORS.DATA_USER_ID, user.userId);
			});

			if (newUsers.length > 0) {
				const { isRestricted } = $restrictedAccessStore;
				const showRestricted = isRestricted && !isOwnFriendsLookup();

				newUsers.forEach((user) => processedUsers.add(user.userId));

				if (showRestricted) {
					const restrictedStatus = createErrorCombinedStatus<UserStatus>('restricted_access');
					newUsers.forEach((user) => {
						userStatuses.set(user.userId, restrictedStatus);
						mountStatusIndicator(user, false);
					});
				} else {
					newUsers.forEach((user) => {
						markUserElementForBlur(user.element, user.userId, pageType);
					});

					newUsers.forEach((user) => {
						mountStatusIndicator(user, true);
					});

					await loadUserStatuses(newUsers);

					newUsers.forEach((user) => {
						if (user.element.getAttribute(STATUS_SELECTORS.DATA_USER_ID) !== user.userId) return;

						const status = userStatuses.get(user.userId);
						if (!status) return;

						revealUserElement(user.element, status);
						if (isFlagged(status)) {
							user.element.setAttribute(STATUS_SELECTORS.DATA_FLAGGED, 'true');
						}
					});
				}
			}

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
		} finally {
			endTrace();
		}
	}

	function extractUserDetails(element: Element): UserDetails | null {
		try {
			let profileLink: Element | null = null;

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

			const userId = extractIdFromUrl(href, /\/users\/(\d+)/);
			if (!userId) return null;

			return {
				userId,
				element,
				profileLink
			};
		} catch (error) {
			logger.error('Failed to extract user details:', error);
			return null;
		}
	}

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
			const userIdFromUrl = extractIdFromUrl(pathname, /\/users\/(\d+)\/friends/);
			return userIdFromUrl === loggedInUserId;
		}

		// Profile carousel: check if viewing own profile
		if (pageType === PAGE_TYPES.FRIENDS_CAROUSEL) {
			return profileOwnerId === loggedInUserId;
		}

		return false;
	}

	async function loadUserStatuses(users: UserDetails[]) {
		const endTrace = startTrace(TRACE_CATEGORIES.API, 'loadUserStatuses', {
			userCount: users.length,
			pageType
		});
		try {
			const userIds = users.map((u) => u.userId);

			const lookupContext = isOwnFriendsLookup() ? LOOKUP_CONTEXT.FRIENDS : undefined;
			const customApiResults = await queryMultipleUsers(userIds, {
				lookupContext,
				signal: batch.nextSignal(),
				onUpdate: (userId, combinedStatus) => {
					userStatuses.set(userId, combinedStatus);
				}
			});

			customApiResults.forEach((combinedStatus, userId) => {
				onUserProcessed?.(userId, combinedStatus);
			});

			logger.debug(`Loaded ${String(customApiResults.size)} user statuses for ${pageType}`);
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			logger.error('Failed to load user statuses:', error);
		} finally {
			endTrace();
		}
	}

	// Resolves the per-page-type target selector and mounts the indicator, promoting the target to relative positioning when needed
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

			if (!(user.element instanceof HTMLElement)) {
				logger.warn('User element is not an HTMLElement, skipping positioning');
				return;
			}

			const tileElement = user.element;

			const isModalItem = tileElement.closest(GROUPS_MODAL_SELECTORS.MODAL) !== null;

			let targetSelector: string;
			let showText = false;

			if (isModalItem) {
				targetSelector = GROUPS_MODAL_SELECTORS.TEXT_CONTAINER;
				showText = true;
			} else if (pageType === PAGE_TYPES.GROUP_CONFIGURE_MEMBERS) {
				targetSelector = GROUP_CONFIGURE_SELECTORS.CARD.TEXT_CONTAINER;
				showText = true;
			} else {
				const targetSelectors: Record<string, string> = {
					[PAGE_TYPES.FRIENDS_LIST]: FRIENDS_SELECTORS.CARD.FULLBODY,
					[PAGE_TYPES.SEARCH_USER]: SEARCH_SELECTORS.CARD.FULLBODY,
					[PAGE_TYPES.FRIENDS_CAROUSEL]: FRIENDS_CAROUSEL_SELECTORS.TILE_CONTENT,
					[PAGE_TYPES.HOME]: FRIENDS_CAROUSEL_SELECTORS.TILE_CONTENT
				};

				const found = targetSelectors[pageType];
				if (found === undefined) {
					throw new Error(`No target selector defined for page type: ${pageType}`);
				}
				targetSelector = found;
			}

			const targetElement = tileElement.querySelector<HTMLElement>(targetSelector);
			if (!targetElement) {
				throw new Error(`Target element not found for selector: ${targetSelector}`);
			}

			let container = targetElement.querySelector<HTMLElement>(
				`.${COMPONENT_CLASSES.STATUS_CONTAINER}`
			);
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
					get entityStatus() {
						return userStatuses.get(user.userId) ?? null;
					},
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
			endTrace({ success: false, error: asApiError(error).message });
			logger.error('Failed to mount status indicator:', error, {
				userId: user.userId,
				pageType,
				hasStatus: !!userStatuses.get(user.userId)
			});
		}
	}

	function handleStatusClick(userId: string) {
		logger.userAction(`${pageType}_${USER_ACTIONS.STATUS_CLICKED}`, { userId });
	}

	function cleanupOrphanedComponents() {
		// Snapshot all currently-processed elements once and collect their user IDs
		// Diffing against mountedComponents keys is O(n) instead of N querySelectorAll
		// scans of the whole document
		const liveUserIds = new SvelteSet<string>();
		document.querySelectorAll(`[${STATUS_SELECTORS.DATA_PROCESSED}]`).forEach((el) => {
			const id = el.getAttribute(STATUS_SELECTORS.DATA_USER_ID);
			if (id) liveUserIds.add(id);
		});

		const removed = mountedComponents.removeOrphans(liveUserIds);
		if (removed.length > 0) {
			logger.debug(`Cleaning up ${String(removed.length)} orphaned components for ${pageType}`);
		}
	}

	function handleQueueUser(userId: string) {
		logger.userAction(`${pageType}_queue_requested`, { userId });
		queueModalManager.showQueue(userId);
	}

	// Re-queries the user after a queue submission so the live indicator props reflect the new state
	async function handleStatusRefresh(userId: string) {
		try {
			await queryMultipleUsers([userId], {
				onUpdate: (updatedUserId, combinedStatus) => {
					if (updatedUserId === userId) {
						userStatuses.set(userId, combinedStatus);
					}
				}
			});
		} catch (error) {
			logger.error('Failed to refresh status after queue operation:', error);
		}
	}

	function cleanup() {
		destroyed = true;

		observer?.stop();
		containerWatcher?.stop();

		cleanupModalObserver();

		mountedComponents.destroyAll();
		processedUsers.clear();
		userStatuses.clear();

		logger.debug(`UserListManager cleanup completed for ${pageType}`);
	}
</script>

<QueueModalManager bind:this={queueModalManager} onStatusRefresh={handleStatusRefresh} />
