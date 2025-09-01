<script lang="ts">
    import {mount} from 'svelte';
    import {SvelteMap} from 'svelte/reactivity';
    import type {Observer} from '@/lib/utils/observer';
    import {observerFactory} from '@/lib/utils/observer';
    import {
        BTROBLOX_GROUPS_SELECTORS,
        COMPONENT_CLASSES,
        ENTITY_TYPES,
        PROFILE_GROUPS_SHOWCASE_SELECTORS,
        USER_ACTIONS
    } from '@/lib/types/constants';
    import {groupStatusService} from '@/lib/services/entity-status-service';
    import {sanitizeEntityId} from '@/lib/utils/sanitizer';
    import {logger} from '@/lib/utils/logger';
    import type {GroupStatus} from '@/lib/types/api';
    import StatusIndicator from '../status/StatusIndicator.svelte';

    interface Props {
        onError?: (error: string) => void;
        onMount?: (cleanup: () => void) => void;
    }

    let {
        onError,
        onMount
    }: Props = $props();

    // Local state
    let slideshowObserver: Observer | null = null;
    let gridObserver: Observer | null = null;
    let btrobloxObserver: Observer | null = null;
    let containerWatcher: Observer | null = null;
    let viewSwitchObserver: MutationObserver | null = null;
    let groupStatuses = new SvelteMap<string, GroupStatus>();
    let mountedComponents = new SvelteMap<string, { unmount?: () => void }>();
    let destroyed = $state(false);

    // Type definitions for group details
    interface GroupDetails {
        groupId: string;
        element: Element;
        nameElement: Element;
    }

    // Initialize component
    $effect(() => {
        if (destroyed) {
            return;
        }

        void initialize();
        onMount?.(cleanup);
        return cleanup;
    });

    // Initialize observers for groups showcase
    async function initialize() {
        if (destroyed) {
            return;
        }

        try {
            await setupContainerWatcher();
        } catch (error) {
            onError?.(`Failed to initialize groups showcase: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Set up container watcher for groups showcase
    async function setupContainerWatcher() {
        containerWatcher = observerFactory.createContainerWatcher({
            name: 'groups-showcase-container-watcher',
            containerSelector: `${PROFILE_GROUPS_SHOWCASE_SELECTORS.CONTAINER}, ${BTROBLOX_GROUPS_SELECTORS.CONTAINER}`,
            onContainerAdded: () => {
                void setupGroupsObservers();
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
            [slideshowObserver, gridObserver, btrobloxObserver].forEach(observer => {
                if (observer) {
                    observer.stop();
                    observer.cleanup();
                }
            });

            // Detect whether BTRoblox extension is active
            const btrContainer = document.querySelector(BTROBLOX_GROUPS_SELECTORS.CONTAINER);
            const standardContainer = document.querySelector(PROFILE_GROUPS_SHOWCASE_SELECTORS.CONTAINER);

            if (btrContainer) {
                // Monitor BTRoblox group elements
                btrobloxObserver = await createBTRobloxObserver();
            } else if (standardContainer) {
                // Monitor both slideshow and grid layouts
                slideshowObserver = await createListObserver('slideshow', PROFILE_GROUPS_SHOWCASE_SELECTORS.SLIDESHOW);
                gridObserver = await createListObserver('grid', PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID);

                setupViewSwitchObserver();
            }
        } catch (error) {
            logger.error('Failed to setup groups observers:', error);
        }
    }

    // Create and start a list observer
    async function createListObserver(type: string, selectors: typeof PROFILE_GROUPS_SHOWCASE_SELECTORS.SLIDESHOW | typeof PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID) {
        const observer = observerFactory.createListObserver({
            name: `profile-groups-${type}-observer`,
            containerSelector: selectors.ITEMS_CONTAINER,
            unprocessedItemSelector: selectors.ITEM_UNPROCESSED,
            processItems: handleNewGroups,
            processExistingItems: true,
            maxRetries: 3,
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
            maxRetries: 3,
            restartDelay: 1000
        });

        await observer.start();
        return observer;
    }
    
    // Set up observer to detect view switches
    function setupViewSwitchObserver() {
        viewSwitchObserver?.disconnect();

        const gridContainer = document.querySelector(PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID.CONTAINER);
        if (!gridContainer) return;

        viewSwitchObserver = new MutationObserver(() => {
            if (!gridContainer.classList.contains('ng-hide')) {
                setTimeout(() => {
                    const gridItems = document.querySelectorAll(PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID.ITEM);
                    const itemsToProcess = Array.from(gridItems).filter(item => {
                        const details = extractGroupDetails(item);
                        return details && !hasStatusIndicator(details.nameElement);
                    });
                    if (itemsToProcess.length > 0) {
                        void handleNewGroups(itemsToProcess);
                    }
                }, 100);
            }
        });

        viewSwitchObserver.observe(gridContainer, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    // Check if element already has status indicator
    function hasStatusIndicator(nameElement: Element): boolean {
        return !!nameElement.parentNode?.querySelector('.rtcr-status-container');
    }

    // Handle new groups detected
    async function handleNewGroups(items: Element[]) {
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
            onError?.(`Failed to process new groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            // Fetch statuses for groups we haven't cached yet
            const groupsToFetch = groupDetails.filter(({groupId}) => !groupStatuses.has(groupId));

            if (groupsToFetch.length > 0) {
                const groupIds = groupsToFetch.map(({groupId}) => groupId);
                const fetchedResults = await groupStatusService.getStatuses(groupIds);

                for (const [groupId, status] of fetchedResults.entries()) {
                    if (status) {
                        groupStatuses.set(groupId, status);
                    }
                }
            }

            // Mount status indicators
            for (const groupDetail of groupDetails) {
                const {groupId, element, nameElement} = groupDetail;
                const status = groupStatuses.get(groupId);

                if (status) {
                    element.classList.add('status-processed');
                    mountStatusIndicator(groupId, status, nameElement, element);
                }
            }
        } catch (error) {
            onError?.(`Failed to process groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Mount status indicator for a group
    function mountStatusIndicator(groupId: string, status: GroupStatus, nameElement: Element, element?: Element) {
        // Check and unmount existing component
        const existingComponent = mountedComponents.get(groupId);
        if (existingComponent) {
            existingComponent.unmount?.();
            mountedComponents.delete(groupId);
        }

        // Prevent duplicate status indicators
        if (hasStatusIndicator(nameElement)) return;

        // Configure text display for different layouts
        const isBTRobloxView = element?.matches(BTROBLOX_GROUPS_SELECTORS.ITEM);
        const isGridView = element?.matches(PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID.ITEM);

        // Wrapper element for status indicator component
        const container = document.createElement('span');
        container.className = 'rotector-group-status-container ' + COMPONENT_CLASSES.STATUS_CONTAINER;
        
        if (isBTRobloxView || isGridView) {
            // Overlay positioning for compact card layouts
            const imageElement = element?.querySelector(
                isBTRobloxView 
                    ? BTROBLOX_GROUPS_SELECTORS.IMAGE_CONTAINER
                    : `${PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID.IMAGE_CONTAINER}, ${PROFILE_GROUPS_SHOWCASE_SELECTORS.GRID.THUMBNAIL_CONTAINER}`
            ) as HTMLElement;
            
            container.classList.add(COMPONENT_CLASSES.STATUS_POSITIONED_ABSOLUTE);
            
            if (imageElement.style.position !== 'relative' && imageElement.style.position !== 'absolute') {
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
                status,
                loading: false,
                showText: !isGridView && !isBTRobloxView,
                onClick: handleStatusClick
            }
        });

        // Store component reference for cleanup
        mountedComponents.set(groupId, component);
    }

    // Handle status indicator click
    function handleStatusClick(clickedGroupId: string) {
        logger.userAction(USER_ACTIONS.STATUS_CLICKED, {groupId: clickedGroupId});
    }

    // Clean up resources
    function cleanup() {
        destroyed = true;

        // Stop observers
        [slideshowObserver, gridObserver, btrobloxObserver, containerWatcher].forEach(observer => {
            observer?.stop();
            observer?.cleanup();
        });
        slideshowObserver = gridObserver = btrobloxObserver = containerWatcher = null;

        viewSwitchObserver?.disconnect();
        viewSwitchObserver = null;

        // Unmount components and clear cache
        mountedComponents.forEach(component => component.unmount?.());
        mountedComponents.clear();
        groupStatuses.clear();
    }
</script>