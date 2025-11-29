<script lang="ts">
	import { mount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { Observer } from '@/lib/utils/observer';
	import { observerFactory } from '@/lib/utils/observer';
	import {
		BTROBLOX_GROUPS_SELECTORS,
		COMPONENT_CLASSES,
		ENTITY_TYPES,
		PROFILE_GROUPS_SHOWCASE_SELECTORS,
		STATUS_SELECTORS,
		USER_ACTIONS
	} from '@/lib/types/constants';
	import { groupStatusService } from '@/lib/services/entity-status-service';
	import { sanitizeEntityId } from '@/lib/utils/sanitizer';
	import { logger } from '@/lib/utils/logger';
	import { waitForElement, waitForAllItems } from '@/lib/utils/element-waiter';
	import type { GroupStatus } from '@/lib/types/api';
	import { wrapGroupStatus } from '@/lib/utils/status-utils';
	import StatusIndicator from '../status/StatusIndicator.svelte';

	interface Props {
		onError?: (error: string) => void;
		onMount?: (cleanup: () => void) => void;
	}

	let { onError, onMount }: Props = $props();

	// Local state
	let slideshowObserver: Observer | null = null;
	let gridObserver: Observer | null = null;
	let btrobloxObserver: Observer | null = null;
	let containerWatcher: Observer | null = null;
	let viewSwitchObserver: MutationObserver | null = null;
	let groupStatuses = new SvelteMap<string, GroupStatus>();
	let mountedComponents = new SvelteMap<string, { destroy: () => void }>();
	let isProcessingGroups = false;
	let observersInitialized = false;

	// Type definitions for group details
	interface GroupDetails {
		groupId: string;
		element: Element;
		nameElement: Element;
	}

	// Initialize component
	$effect(() => {
		void initialize();
		onMount?.(cleanup);
		return cleanup;
	});

	// Initialize observers for groups showcase
	async function initialize() {
		try {
			await setupContainerWatcher();
		} catch (error) {
			onError?.(
				`Failed to initialize groups showcase: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Set up container watcher for groups showcase
	async function setupContainerWatcher() {
		containerWatcher = observerFactory.createContainerWatcher({
			name: 'groups-showcase-container-watcher',
			containerSelector: `${PROFILE_GROUPS_SHOWCASE_SELECTORS.CONTAINER}, ${BTROBLOX_GROUPS_SELECTORS.CONTAINER}`,
			onContainerAdded: () => {
				if (!observersInitialized) {
					void setupGroupsObservers();
				}
			}
		});

		await containerWatcher.start();

		// Handle containers that exist on page load
		const combinedSelector = `${PROFILE_GROUPS_SHOWCASE_SELECTORS.CONTAINER}, ${BTROBLOX_GROUPS_SELECTORS.CONTAINER}`;
		if (document.querySelector(combinedSelector)) {
			await setupGroupsObservers();
		}
	}

	// Set up observers for both slideshow and grid views
	async function setupGroupsObservers() {
		try {
			// Clean up existing observers
			[slideshowObserver, gridObserver, btrobloxObserver].forEach((observer) => {
				if (observer) {
					observer.stop();
					observer.cleanup();
				}
			});

			// Reset observers to null
			slideshowObserver = null;
			gridObserver = null;
			btrobloxObserver = null;

			// Detect whether BTRoblox extension is active
			const btrContainer = document.querySelector(BTROBLOX_GROUPS_SELECTORS.CONTAINER);
			const standardContainer = document.querySelector(PROFILE_GROUPS_SHOWCASE_SELECTORS.CONTAINER);

			if (btrContainer) {
				// Monitor BTRoblox group elements
				btrobloxObserver = await createBTRobloxObserver();
				observersInitialized = true;
			} else if (standardContainer) {
				// Detect which view is currently active
				let gridContainer = document.querySelector(
					PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID.CONTAINER
				);
				let slideshowContainer = document.querySelector(
					PROFILE_GROUPS_SHOWCASE_SELECTORS.SLIDESHOW.CONTAINER
				);

				let gridVisible = gridContainer && !gridContainer.classList.contains('ng-hide');
				let slideshowVisible =
					slideshowContainer && !slideshowContainer.classList.contains('ng-hide');

				// If switching to grid view but container doesn't exist yet, wait for Angular to create it
				if (!gridContainer && slideshowContainer?.classList.contains('ng-hide')) {
					const result = await waitForElement(PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID.CONTAINER, {
						maxRetries: 20,
						baseDelay: 50
					});

					if (result.success && result.element) {
						gridContainer = result.element;
						gridVisible = !gridContainer.classList.contains('ng-hide');
					}
				}

				// If switching to slideshow view but container doesn't exist yet, wait for Angular to create it
				if (!slideshowContainer && gridContainer?.classList.contains('ng-hide')) {
					const result = await waitForElement(
						PROFILE_GROUPS_SHOWCASE_SELECTORS.SLIDESHOW.CONTAINER,
						{
							maxRetries: 20,
							baseDelay: 50
						}
					);

					if (result.success && result.element) {
						slideshowContainer = result.element;
						slideshowVisible = !slideshowContainer.classList.contains('ng-hide');
					}
				}

				// Create observer for the active view
				if (gridVisible) {
					const readyItemSelector = `${PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID.ITEM}:has(${PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID.GROUP_LINK}[href*="/communities/"])`;
					const itemsResult = await waitForAllItems(
						PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID.ITEMS_CONTAINER,
						PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID.ITEM,
						readyItemSelector,
						{ maxRetries: 30, baseDelay: 100 }
					);

					if (itemsResult.success) {
						gridObserver = await createListObserver('grid', PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID);
					} else {
						logger.warn('No grid items with valid href found, skipping observer setup');
					}
				} else if (slideshowVisible) {
					const readyItemSelector = `${PROFILE_GROUPS_SHOWCASE_SELECTORS.SLIDESHOW.ITEM}:has(${PROFILE_GROUPS_SHOWCASE_SELECTORS.SLIDESHOW.GROUP_LINK}[href*="/communities/"])`;
					const itemsResult = await waitForAllItems(
						PROFILE_GROUPS_SHOWCASE_SELECTORS.SLIDESHOW.ITEMS_CONTAINER,
						PROFILE_GROUPS_SHOWCASE_SELECTORS.SLIDESHOW.ITEM,
						readyItemSelector,
						{ maxRetries: 30, baseDelay: 100 }
					);

					if (itemsResult.success) {
						slideshowObserver = await createListObserver(
							'slideshow',
							PROFILE_GROUPS_SHOWCASE_SELECTORS.SLIDESHOW
						);
					} else {
						logger.warn('No slideshow items with valid href found, skipping observer setup');
					}
				} else {
					logger.warn('No visible container found', {
						gridExists: !!gridContainer,
						slideshowExists: !!slideshowContainer
					});
				}

				// Set up view switch observer on first initialization
				if (!observersInitialized) {
					setupViewSwitchObserver();
				}

				observersInitialized = true;
			}
		} catch (error) {
			logger.error('Failed to setup groups observers:', error);
		}
	}

	// Create and start a list observer
	async function createListObserver(
		type: string,
		selectors:
			| typeof PROFILE_GROUPS_SHOWCASE_SELECTORS.SLIDESHOW
			| typeof PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID
	) {
		const observer = observerFactory.createListObserver({
			name: `profile-groups-${type}-observer`,
			containerSelector: selectors.ITEMS_CONTAINER,
			unprocessedItemSelector: selectors.ITEM_UNPROCESSED,
			processItems: handleNewGroups,
			processExistingItems: true,
			restartDelay: 1000
		});

		await observer.start();
		return observer;
	}

	// Monitor group cards in BTRoblox extension layout
	async function createBTRobloxObserver() {
		const observer = observerFactory.createListObserver({
			name: 'btroblox-groups-observer',
			containerSelector: BTROBLOX_GROUPS_SELECTORS.ITEMS_CONTAINER,
			unprocessedItemSelector: BTROBLOX_GROUPS_SELECTORS.ITEM_UNPROCESSED,
			processItems: handleNewGroups,
			processExistingItems: true,
			restartDelay: 1000
		});

		await observer.start();
		return observer;
	}

	// Set up observer to detect view switches
	function setupViewSwitchObserver() {
		viewSwitchObserver?.disconnect();

		const gridContainer = document.querySelector(PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID.CONTAINER);
		const slideshowContainer = document.querySelector(
			PROFILE_GROUPS_SHOWCASE_SELECTORS.SLIDESHOW.CONTAINER
		);

		if (!gridContainer && !slideshowContainer) return;

		viewSwitchObserver = new MutationObserver(() => {
			void setupGroupsObservers();
		});

		// Observe both containers for visibility changes
		if (gridContainer) {
			viewSwitchObserver.observe(gridContainer, {
				attributes: true,
				attributeFilter: ['class']
			});
		}

		if (slideshowContainer) {
			viewSwitchObserver.observe(slideshowContainer, {
				attributes: true,
				attributeFilter: ['class']
			});
		}
	}

	// Check if element already has status indicator
	function hasStatusIndicator(nameElement: Element): boolean {
		return !!nameElement.parentNode?.querySelector(`.${COMPONENT_CLASSES.STATUS_CONTAINER}`);
	}

	// Handle new groups detected
	async function handleNewGroups(items: Element[]) {
		// Prevent concurrent processing
		if (isProcessingGroups) {
			return;
		}

		isProcessingGroups = true;

		try {
			const groupsToProcess: GroupDetails[] = [];

			for (const item of items) {
				const groupDetails = extractGroupDetails(item);
				if (groupDetails && !hasStatusIndicator(groupDetails.nameElement)) {
					groupsToProcess.push(groupDetails);
				}
			}

			if (groupsToProcess.length > 0) {
				await processGroups(groupsToProcess);
			}
		} catch (error) {
			logger.error('GroupListManager: Failed to handle new groups:', error);
			onError?.(
				`Failed to process new groups: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		} finally {
			isProcessingGroups = false;
		}
	}

	// Extract group details from DOM element
	function extractGroupDetails(element: Element): GroupDetails | null {
		let groupLink: Element | null = null;
		let nameElement: Element | null = null;

		// Use BTRoblox or standard selectors based on container type
		if (element.matches(BTROBLOX_GROUPS_SELECTORS.ITEM)) {
			// BTRoblox extension layout
			groupLink = element.querySelector(BTROBLOX_GROUPS_SELECTORS.GROUP_LINK);
			nameElement = element.querySelector(BTROBLOX_GROUPS_SELECTORS.GROUP_NAME);
		} else {
			// Native Roblox layout
			const selectors = element.matches(PROFILE_GROUPS_SHOWCASE_SELECTORS.SLIDESHOW.ITEM)
				? PROFILE_GROUPS_SHOWCASE_SELECTORS.SLIDESHOW
				: PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID;

			groupLink = element.querySelector(selectors.GROUP_LINK);
			nameElement = element.querySelector(selectors.GROUP_NAME);
		}

		const href = groupLink?.getAttribute('href');

		if (!href || !nameElement) return null;

		const groupIdMatch = href.match(/\/communities\/(\d+)/);
		if (!groupIdMatch) return null;

		const groupId = sanitizeEntityId(groupIdMatch[1]);
		if (!groupId) return null;

		return {
			groupId,
			element,
			nameElement
		};
	}

	// Process groups with batch status fetching
	async function processGroups(groupDetails: GroupDetails[]) {
		try {
			// Show loading indicators
			for (const groupDetail of groupDetails) {
				const { groupId, element, nameElement } = groupDetail;
				element.classList.add(STATUS_SELECTORS.PROCESSED_CLASS);
				updateStatusIndicator(groupId, null, nameElement, element, true);
			}

			// Fetch statuses for groups we haven't cached yet
			const groupsToFetch = groupDetails.filter(({ groupId }) => !groupStatuses.has(groupId));

			if (groupsToFetch.length > 0) {
				const groupIds = groupsToFetch.map(({ groupId }) => groupId);
				const fetchedResults = await groupStatusService.getStatuses(groupIds);

				for (const [groupId, status] of fetchedResults.entries()) {
					if (status) {
						groupStatuses.set(groupId, status);
					}
				}
			}

			// Update indicators with fetched status
			for (const groupDetail of groupDetails) {
				const { groupId, element, nameElement } = groupDetail;
				const status = groupStatuses.get(groupId) ?? null;
				updateStatusIndicator(groupId, status, nameElement, element, false);
			}
		} catch (error) {
			onError?.(
				`Failed to process groups: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Update status indicator for a group
	function updateStatusIndicator(
		groupId: string,
		status: GroupStatus | null,
		nameElement: Element,
		element: Element | undefined,
		isLoading: boolean
	) {
		// Clean up existing component
		const existingComponent = mountedComponents.get(groupId);
		if (existingComponent) {
			existingComponent.destroy?.();
			mountedComponents.delete(groupId);
		}

		// Determine layout type
		const isBTRobloxView = element?.matches(BTROBLOX_GROUPS_SELECTORS.ITEM);
		const isGridView = element?.matches(PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID.ITEM);

		// Remove existing container
		const existingContainer =
			isBTRobloxView || isGridView
				? element?.querySelector(`.${COMPONENT_CLASSES.GROUP_STATUS_CONTAINER}`)
				: nameElement.parentNode?.querySelector(`.${COMPONENT_CLASSES.GROUP_STATUS_CONTAINER}`);
		existingContainer?.remove();

		// Create container element
		const container = document.createElement('span');
		container.className =
			COMPONENT_CLASSES.GROUP_STATUS_CONTAINER + ' ' + COMPONENT_CLASSES.STATUS_CONTAINER;

		if (isBTRobloxView || isGridView) {
			// Overlay positioning for compact card layouts
			const imageElement = element?.querySelector(
				isBTRobloxView
					? BTROBLOX_GROUPS_SELECTORS.IMAGE_CONTAINER
					: `${PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID.IMAGE_CONTAINER}, ${PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID.THUMBNAIL_CONTAINER}`
			) as HTMLElement | null;

			if (!imageElement) {
				logger.warn('Image container not found for group card', { groupId });
				return;
			}

			container.classList.add(COMPONENT_CLASSES.STATUS_POSITIONED_ABSOLUTE);

			if (
				imageElement.style.position !== 'relative' &&
				imageElement.style.position !== 'absolute'
			) {
				imageElement.style.position = 'relative';
			}

			imageElement.appendChild(container);
		} else {
			// Inline positioning for slideshow layout
			container.style.marginLeft = '8px';
			container.style.display = 'inline-flex';
			container.style.alignItems = 'center';
			nameElement.parentNode?.insertBefore(container, nameElement.nextSibling);
		}

		// Mount StatusIndicator component
		const component = mount(StatusIndicator, {
			target: container,
			props: {
				entityId: groupId,
				entityType: ENTITY_TYPES.GROUP,
				entityStatus: wrapGroupStatus(status, isLoading),
				skipAutoFetch: true,
				showText: !isGridView && !isBTRobloxView,
				onClick: handleStatusClick
			}
		});

		// Store component reference for cleanup
		mountedComponents.set(groupId, component as { destroy: () => void });
	}

	// Handle status indicator click
	function handleStatusClick(clickedGroupId: string) {
		logger.userAction(USER_ACTIONS.STATUS_CLICKED, { groupId: clickedGroupId });
	}

	// Clean up resources
	function cleanup() {
		// Stop observers
		[slideshowObserver, gridObserver, btrobloxObserver, containerWatcher].forEach((observer) => {
			observer?.stop();
			observer?.cleanup();
		});
		slideshowObserver = gridObserver = btrobloxObserver = containerWatcher = null;

		viewSwitchObserver?.disconnect();
		viewSwitchObserver = null;

		// Unmount components and clear cache
		mountedComponents.forEach((component) => component.destroy());
		mountedComponents.clear();
		groupStatuses.clear();
	}
</script>
