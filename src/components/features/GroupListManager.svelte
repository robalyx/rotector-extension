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
	import { restrictedAccessStore } from '@/lib/stores/restricted-access';
	import { sanitizeEntityId } from '@/lib/utils/sanitizer';
	import { logger } from '@/lib/utils/logger';
	import type { GroupStatus } from '@/lib/types/api';
	import { wrapGroupStatus } from '@/lib/utils/status-utils';
	import StatusIndicator from '../status/StatusIndicator.svelte';

	interface Props {
		onError?: (error: string) => void;
		onMount?: (cleanup: () => void) => void;
	}

	interface GroupDetails {
		groupId: string;
		element: Element;
		nameElement: Element;
	}

	let { onError, onMount }: Props = $props();

	// Local state
	let btrobloxObserver: Observer | null = null;
	let carouselObserver: Observer | null = null;
	let containerWatcher: Observer | null = null;
	let groupStatuses = new SvelteMap<string, GroupStatus>();
	let mountedComponents = new SvelteMap<string, { unmount?: () => void }>();
	let destroyed = $state(false);

	// Initialize observer and cleanup on unmount
	$effect(() => {
		if (destroyed) return;

		onMount?.(cleanup);
		void initializeObserver();

		return cleanup;
	});

	function stopObserver(observer: Observer | null): void {
		if (!observer) return;
		observer.stop();
		observer.cleanup();
	}

	// Detect layout type and initialize appropriate observer
	async function initializeObserver(): Promise<void> {
		if (destroyed) return;

		try {
			const btrContainer = document.querySelector(BTROBLOX_GROUPS_SELECTORS.CONTAINER);
			if (btrContainer) {
				await initializeBTRobloxObserver();
				return;
			}

			await initializeCarouselObserver();
		} catch (error) {
			onError?.(
				`Failed to initialize groups showcase: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Initialize observer for BTRoblox layout
	async function initializeBTRobloxObserver(): Promise<void> {
		btrobloxObserver = observerFactory.createListObserver({
			name: 'btroblox-groups-observer',
			containerSelector: BTROBLOX_GROUPS_SELECTORS.ITEMS_CONTAINER,
			unprocessedItemSelector: BTROBLOX_GROUPS_SELECTORS.ITEM_UNPROCESSED,
			processItems: handleNewGroups,
			processExistingItems: true,
			restartDelay: 1000
		});

		await btrobloxObserver.start();
		logger.debug('BTRoblox groups observer initialized');
	}

	function createCarouselObserver(processExistingItems: boolean): Observer {
		return observerFactory.createListObserver({
			name: 'profile-groups-carousel-observer',
			containerSelector: PROFILE_GROUPS_SHOWCASE_SELECTORS.ITEMS_CONTAINER,
			unprocessedItemSelector: PROFILE_GROUPS_SHOWCASE_SELECTORS.ITEM_UNPROCESSED,
			processItems: handleNewGroups,
			processExistingItems,
			restartDelay: 1000
		});
	}

	// Initialize observer for carousel layout
	async function initializeCarouselObserver(): Promise<void> {
		const carouselItemSelector = `${PROFILE_GROUPS_SHOWCASE_SELECTORS.SECTION} ${PROFILE_GROUPS_SHOWCASE_SELECTORS.ITEM}`;

		containerWatcher = observerFactory.createContainerWatcher({
			name: 'groups-showcase-container-watcher',
			containerSelector: carouselItemSelector,
			onContainerAdded: (container: Element) => {
				if (destroyed) return;

				const itemsContainer = container.parentElement;
				if (!itemsContainer) return;

				const items = Array.from(
					itemsContainer.querySelectorAll(PROFILE_GROUPS_SHOWCASE_SELECTORS.ITEM)
				);
				if (items.length > 0) {
					void handleNewGroups(items);
				}

				stopObserver(carouselObserver);
				itemsContainer.setAttribute('data-rotector-carousel-container', '');
				carouselObserver = createCarouselObserver(false);
				void carouselObserver.start();
			}
		});

		await containerWatcher.start();

		const groupsSection = document.querySelector(PROFILE_GROUPS_SHOWCASE_SELECTORS.SECTION);
		const existingItem = groupsSection?.querySelector(PROFILE_GROUPS_SHOWCASE_SELECTORS.ITEM);
		const itemsContainer = existingItem?.parentElement;

		if (itemsContainer) {
			itemsContainer.setAttribute('data-rotector-carousel-container', '');
			carouselObserver = createCarouselObserver(true);
			await carouselObserver.start();
			logger.debug('Carousel groups observer initialized');
		}
	}

	// Handle new groups detected by observer
	async function handleNewGroups(items: Element[]): Promise<void> {
		if (destroyed) return;

		const groupsToProcess = items
			.map(extractGroupDetails)
			.filter((details): details is GroupDetails => {
				if (details === null) return false;
				const hasIndicator = !!details.nameElement.parentNode?.querySelector(
					`.${COMPONENT_CLASSES.STATUS_CONTAINER}`
				);
				return !hasIndicator;
			});

		if (groupsToProcess.length === 0) return;

		try {
			await processGroups(groupsToProcess);
		} catch (error) {
			logger.error('GroupListManager: Failed to handle new groups:', error);
			onError?.(
				`Failed to process new groups: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Extract group details from DOM element
	function extractGroupDetails(element: Element): GroupDetails | null {
		const isBTRoblox = element.matches(BTROBLOX_GROUPS_SELECTORS.ITEM);

		let groupLink: Element | null;
		let nameElement: Element | null;

		if (isBTRoblox) {
			groupLink = element.querySelector(BTROBLOX_GROUPS_SELECTORS.GROUP_LINK);
			nameElement = element.querySelector(BTROBLOX_GROUPS_SELECTORS.GROUP_NAME);
		} else {
			groupLink =
				Array.from(element.querySelectorAll('a')).find((link) => {
					const href = link.getAttribute('href');
					return href?.includes('/communities/') || href?.includes('/groups/');
				}) ?? null;
			nameElement = element.querySelector(PROFILE_GROUPS_SHOWCASE_SELECTORS.GROUP_NAME);
		}

		const href = groupLink?.getAttribute('href');
		if (!href || !nameElement) return null;

		const groupIdMatch = href.match(/\/(?:communities|groups)\/(\d+)/);
		if (!groupIdMatch) return null;

		const groupId = sanitizeEntityId(groupIdMatch[1]);
		if (!groupId) return null;

		return { groupId, element, nameElement };
	}

	// Process groups with batch status fetching
	async function processGroups(groupDetails: GroupDetails[]): Promise<void> {
		try {
			if ($restrictedAccessStore.isRestricted) {
				for (const { groupId, element } of groupDetails) {
					element.classList.add(STATUS_SELECTORS.PROCESSED_CLASS);
					updateStatusIndicator(groupId, null, element, false, 'restricted_access');
				}
				return;
			}

			for (const { groupId, element } of groupDetails) {
				element.classList.add(STATUS_SELECTORS.PROCESSED_CLASS);
				updateStatusIndicator(groupId, null, element, true);
			}

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

			for (const { groupId, element } of groupDetails) {
				const status = groupStatuses.get(groupId) ?? null;
				updateStatusIndicator(groupId, status, element, false);
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
		element: Element | undefined,
		isLoading: boolean,
		error?: string
	): void {
		const existingComponent = mountedComponents.get(groupId);
		if (existingComponent) {
			existingComponent.unmount?.();
			mountedComponents.delete(groupId);
		}

		element?.querySelector(`.${COMPONENT_CLASSES.GROUP_STATUS_CONTAINER}`)?.remove();

		const isBTRobloxView = element?.matches(BTROBLOX_GROUPS_SELECTORS.ITEM);
		const imageSelector = isBTRobloxView
			? BTROBLOX_GROUPS_SELECTORS.IMAGE_CONTAINER
			: PROFILE_GROUPS_SHOWCASE_SELECTORS.IMAGE_CONTAINER;

		const imageElement = element?.querySelector(imageSelector) as HTMLElement | null;
		if (!imageElement) {
			logger.warn('Image container not found for group card', { groupId });
			return;
		}

		const container = document.createElement('span');
		container.className = `${COMPONENT_CLASSES.GROUP_STATUS_CONTAINER} ${COMPONENT_CLASSES.STATUS_CONTAINER} ${COMPONENT_CLASSES.STATUS_POSITIONED_ABSOLUTE}`;

		if (imageElement.style.position !== 'relative' && imageElement.style.position !== 'absolute') {
			imageElement.style.position = 'relative';
		}

		imageElement.appendChild(container);

		const component = mount(StatusIndicator, {
			target: container,
			props: {
				entityId: groupId,
				entityType: ENTITY_TYPES.GROUP,
				entityStatus: wrapGroupStatus(status, isLoading, error),
				skipAutoFetch: true,
				showText: false,
				onClick: handleStatusClick
			}
		});

		mountedComponents.set(groupId, component as { unmount?: () => void });
	}

	function handleStatusClick(clickedGroupId: string): void {
		logger.userAction(USER_ACTIONS.STATUS_CLICKED, { groupId: clickedGroupId });
	}

	// Clean up resources
	function cleanup(): void {
		destroyed = true;

		stopObserver(btrobloxObserver);
		stopObserver(carouselObserver);
		stopObserver(containerWatcher);
		btrobloxObserver = null;
		carouselObserver = null;
		containerWatcher = null;

		for (const component of mountedComponents.values()) {
			component.unmount?.();
		}
		mountedComponents.clear();
		groupStatuses.clear();
	}
</script>
