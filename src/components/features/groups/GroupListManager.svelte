<script lang="ts">
	import { mount, onMount as svelteOnMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { Observer } from '@/lib/utils/dom/observer';
	import { observerFactory } from '@/lib/utils/dom/observer';
	import { MountedComponentRegistry } from '@/lib/utils/dom/mounted-component-registry';
	import {
		COMPONENT_CLASSES,
		ENTITY_TYPES,
		LOOKUP_CONTEXT,
		STATUS_SELECTORS,
		USER_ACTIONS
	} from '@/lib/types/constants';
	import {
		BTROBLOX_GROUPS_SELECTORS,
		PROFILE_GROUPS_SHOWCASE_SELECTORS
	} from '@/lib/controllers/selectors/profile';
	import { groupStatusService } from '@/lib/services/rotector/entity-status';
	import { restrictedAccessStore } from '@/lib/stores/restricted-access';
	import { createAbortableBatch } from '@/lib/utils/api/abortable-batch';
	import { sanitizeEntityId } from '@/lib/utils/dom/sanitizer';
	import { logger } from '@/lib/utils/logging/logger';
	import { getLoggedInUserId } from '@/lib/utils/client-id';
	import type { GroupStatus } from '@/lib/types/api';
	import { wrapGroupStatus } from '@/lib/utils/status/status-utils';
	import StatusIndicator from '../../status/StatusIndicator.svelte';

	interface Props {
		profileOwnerId?: string;
		onMount?: (cleanup: () => void) => void;
	}

	interface GroupDetails {
		groupId: string;
		element: Element;
		nameElement: Element;
	}

	let { profileOwnerId, onMount }: Props = $props();

	let btrobloxObserver: Observer | null = null;
	let carouselObserver: Observer | null = null;
	let containerWatcher: Observer | null = null;
	let groupStatuses = new SvelteMap<string, GroupStatus>();
	const mountedComponents = new MountedComponentRegistry<string>();
	let destroyed = $state(false);
	const batch = createAbortableBatch();

	svelteOnMount(() => {
		onMount?.(cleanup);
		void initializeObserver();

		return cleanup;
	});

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
			logger.error('GroupListManager: Failed to initialize groups showcase:', error);
		}
	}

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

	// Watches for the carousel item container appearing so a list observer can be rebound when Roblox re-renders the showcase
	async function initializeCarouselObserver(): Promise<void> {
		const carouselItemSelector = `${PROFILE_GROUPS_SHOWCASE_SELECTORS.SECTION} ${PROFILE_GROUPS_SHOWCASE_SELECTORS.ITEM}`;

		containerWatcher = observerFactory.createContainerWatcher({
			name: 'groups-showcase-container-watcher',
			containerSelector: carouselItemSelector,
			onContainerAdded: (container: Element) => {
				if (destroyed) return;

				const itemsContainer = container.parentElement;
				if (!itemsContainer) return;

				const items = [...itemsContainer.querySelectorAll(PROFILE_GROUPS_SHOWCASE_SELECTORS.ITEM)];
				if (items.length > 0) {
					void handleNewGroups(items);
				}

				carouselObserver?.stop();
				itemsContainer.dataset['rotectorCarouselContainer'] = '';
				carouselObserver = createCarouselObserver(false);
				void carouselObserver.start();
			}
		});

		await containerWatcher.start();

		const groupsSection = document.querySelector(PROFILE_GROUPS_SHOWCASE_SELECTORS.SECTION);
		const existingItem = groupsSection?.querySelector(PROFILE_GROUPS_SHOWCASE_SELECTORS.ITEM);
		const itemsContainer = existingItem?.parentElement;

		if (itemsContainer) {
			itemsContainer.dataset['rotectorCarouselContainer'] = '';
			carouselObserver = createCarouselObserver(true);
			await carouselObserver.start();
			logger.debug('Carousel groups observer initialized');
		}
	}

	// Filters out items that already carry an indicator so re-observation never double-mounts the badge
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
		}
	}

	function extractGroupDetails(element: Element): GroupDetails | null {
		const isBTRoblox = element.matches(BTROBLOX_GROUPS_SELECTORS.ITEM);

		let groupLink: Element | null;
		let nameElement: Element | null;

		if (isBTRoblox) {
			groupLink = element.querySelector(BTROBLOX_GROUPS_SELECTORS.GROUP_LINK);
			nameElement = element.querySelector(BTROBLOX_GROUPS_SELECTORS.GROUP_NAME);
		} else {
			groupLink =
				[...element.querySelectorAll('a')].find((link) => {
					const href = link.getAttribute('href');
					return href?.includes('/communities/') || href?.includes('/groups/');
				}) ?? null;
			nameElement = element.querySelector(PROFILE_GROUPS_SHOWCASE_SELECTORS.GROUP_NAME);
		}

		const href = groupLink?.getAttribute('href');
		if (!href || !nameElement) return null;

		const rawGroupId = href.match(/\/(?:communities|groups)\/(\d+)/)?.[1];
		if (!rawGroupId) return null;

		const groupId = sanitizeEntityId(rawGroupId);
		if (!groupId) return null;

		return { groupId, element, nameElement };
	}

	async function processGroups(groupDetails: GroupDetails[]): Promise<void> {
		try {
			const { isRestricted } = $restrictedAccessStore;
			const isOwnProfile = profileOwnerId != null && profileOwnerId === getLoggedInUserId();
			const showRestricted = isRestricted && !isOwnProfile;

			for (const { groupId, element } of groupDetails) {
				element.classList.add(STATUS_SELECTORS.PROCESSED_CLASS);
				if (showRestricted) {
					updateStatusIndicator(groupId, null, element, false, 'restricted_access');
				} else {
					updateStatusIndicator(groupId, null, element, true);
				}
			}

			if (showRestricted) return;

			const groupsToFetch = groupDetails.filter(({ groupId }) => !groupStatuses.has(groupId));
			if (groupsToFetch.length > 0) {
				const groupIds = groupsToFetch.map(({ groupId }) => groupId);
				const fetchedResults = await groupStatusService.getStatuses(groupIds, {
					lookupContext: LOOKUP_CONTEXT.GROUPS,
					signal: batch.nextSignal()
				});

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
			if (error instanceof DOMException && error.name === 'AbortError') return;
			logger.error('GroupListManager: Failed to process groups:', error);
		}
	}

	function updateStatusIndicator(
		groupId: string,
		status: GroupStatus | null,
		element: Element | undefined,
		isLoading: boolean,
		error?: string
	): void {
		element?.querySelector(`.${COMPONENT_CLASSES.GROUP_STATUS_CONTAINER}`)?.remove();

		const isBTRobloxView = element?.matches(BTROBLOX_GROUPS_SELECTORS.ITEM);
		const imageSelector = isBTRobloxView
			? BTROBLOX_GROUPS_SELECTORS.IMAGE_CONTAINER
			: PROFILE_GROUPS_SHOWCASE_SELECTORS.IMAGE_CONTAINER;

		const imageElement = element?.querySelector<HTMLElement>(imageSelector) ?? null;
		if (!imageElement) {
			logger.warn('Image container not found for group card', { groupId });
			return;
		}

		const container = document.createElement('span');
		container.className = `${COMPONENT_CLASSES.GROUP_STATUS_CONTAINER} ${COMPONENT_CLASSES.STATUS_CONTAINER} ${COMPONENT_CLASSES.STATUS_POSITIONED_ABSOLUTE}`;

		if (imageElement.style.position !== 'relative' && imageElement.style.position !== 'absolute') {
			imageElement.style.position = 'relative';
		}

		imageElement.append(container);

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

		mountedComponents.set(groupId, component);
	}

	function handleStatusClick(clickedGroupId: string): void {
		logger.userAction(USER_ACTIONS.STATUS_CLICKED, { groupId: clickedGroupId });
	}

	function cleanup(): void {
		destroyed = true;

		btrobloxObserver?.stop();
		carouselObserver?.stop();
		containerWatcher?.stop();

		mountedComponents.destroyAll();
		groupStatuses.clear();
	}
</script>
