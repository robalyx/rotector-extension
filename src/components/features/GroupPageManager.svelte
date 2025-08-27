<script lang="ts">
    import {get} from 'svelte/store';
    import {mount} from 'svelte';
    import {settings} from '@/lib/stores/settings';
    import {logger} from '@/lib/utils/logger';
    import {waitForElement} from '@/lib/utils/element-waiter';
    import {ENTITY_TYPES, GROUP_HEADER_SELECTORS, GROUPS_SELECTORS} from '@/lib/types/constants';
    import {SETTINGS_KEYS} from '@/lib/types/settings';
    import type {GroupStatus, PageType, UserStatus} from '@/lib/types/api';
    import StatusIndicator from '../status/StatusIndicator.svelte';
    import UserListManager from './UserListManager.svelte';

    interface Props {
        groupId: string | null;
        groupStatus: GroupStatus | null;
        pageType: PageType;
        onMount?: (cleanup: () => void) => void;
    }

    let {groupId, groupStatus, pageType, onMount}: Props = $props();

    let showGroups = $state(false);
    let showTooltips = $derived(get(settings)[SETTINGS_KEYS.GROUPS_TOOLTIPS_ENABLED]);
    let statusIndicator: { unmount?: () => void } | null = $state(null);

    $effect(() => {
        initialize();
        onMount?.(cleanup);
        return cleanup;
    });

    // Initialize group page components and features
    async function initialize() {
        try {
            await Promise.all([
                setupStatusIndicator(),
                setupGroups()
            ]);
            logger.debug('GroupPageManager initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize GroupPageManager:', error);
        }
    }

    // Setup status indicator for group owner
    async function setupStatusIndicator() {
        if (!groupId) return;
        
        try {
            const ownerElement = findOwnerElement();
            if (ownerElement) {
                insertStatusIndicator(ownerElement);
                logger.debug('Group status indicator mounted successfully');
            } else {
                logger.warn('Could not find group owner element for status indicator');
            }
        } catch (error) {
            logger.error('Failed to setup group status indicator:', error);
        }
    }

    // Find DOM element for group owner name
    function findOwnerElement() {
        const headerInfo = document.querySelector(GROUP_HEADER_SELECTORS.HEADER_INFO);
        if (!headerInfo) return null;

        const namesContainer = headerInfo.querySelector(GROUP_HEADER_SELECTORS.NAMES_CONTAINER);
        if (!namesContainer) return null;

        return namesContainer.querySelector(GROUP_HEADER_SELECTORS.OWNER_NAME);
    }

    // Insert and mount status indicator component
    function insertStatusIndicator(ownerElement: Element) {
        const container = document.createElement('span');
        ownerElement.parentNode?.insertBefore(container, ownerElement.nextSibling);
        
        statusIndicator = mount(StatusIndicator, {
            target: container,
            props: {
                entityId: groupId!,
                entityType: ENTITY_TYPES.GROUP,
                status: groupStatus,
                loading: !groupStatus,
                showText: true,
                showTooltips
            }
        });
    }

    // Wait for groups container and enable groups functionality
    async function setupGroups() {
        const result = await waitForElement(GROUPS_SELECTORS.CONTAINER, {timeout: 20000});
        if (result.success) {
            showGroups = true;
            logger.debug('Groups container detected');
        }
    }

    // Handle user processing completion from UserListManager
    function handleUserProcessed(processedUserId: string, status: UserStatus) {
        logger.debug('Groups page user processed', {userId: processedUserId, status: status?.flagType});
    }

    // Handle errors from UserListManager
    function handleError(error: string) {
        logger.error('Groups page UserListManager error:', error);
    }

    // Clean up mounted components and resources
    function cleanup() {
        statusIndicator?.unmount?.();
        statusIndicator = null;
        logger.debug('GroupPageManager cleanup completed');
    }
</script>

<!-- Groups Manager -->
{#if showGroups}
  <UserListManager
      onError={handleError}
      onUserProcessed={handleUserProcessed}
      {pageType}
      {showTooltips}
  />
{/if}