<script lang="ts">
    import {get} from 'svelte/store';
    import {settings} from '@/lib/stores/settings';
    import {logger} from '@/lib/utils/logger';
    import {waitForElement} from '@/lib/utils/element-waiter';
    import {FRIENDS_SELECTORS, PAGE_TYPES} from '@/lib/types/constants';
    import {SETTINGS_KEYS} from '@/lib/types/settings';
    import type {UserStatus} from '@/lib/types/api';
    import UserListManager from './UserListManager.svelte';

    interface Props {
        onMount?: (cleanup: () => void) => void;
    }

    let {
        onMount
    }: Props = $props();

    // Component state
    let showFriendsList = $state(false);
    let showTooltips = $state(true);

    // Reactive settings
    $effect(() => {
        const currentSettings = get(settings);
        showTooltips = currentSettings[SETTINGS_KEYS.FRIENDS_TOOLTIPS_ENABLED];
    });

    // Initialize components when mounted
    $effect(() => {
        initialize();
        onMount?.(cleanup);

        return cleanup;
    });

    // Initialize friends page components
    async function initialize() {
        try {
            await setupFriendsListPage();
            logger.debug('FriendsPageManager initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize FriendsPageManager:', error);
        }
    }

    // Set up friends list page
    async function setupFriendsListPage() {
        const result = await waitForElement(FRIENDS_SELECTORS.CONTAINER, {
            timeout: 30000,
            onTimeout: () => {
                logger.debug('Friends list container timeout');
            }
        });

        if (!result.success) {
            throw new Error('Friends list container not found on friends page');
        }

        showFriendsList = true;
        logger.debug('Friends list detected and will be managed');
    }

    // Handle user processed events
    function handleUserProcessed(processedUserId: string, status: UserStatus) {
        logger.debug('Friends page user processed', {userId: processedUserId, status: status?.flagType});
    }

    // Handle errors
    function handleError(error: string) {
        logger.error('Friends page UserListManager error:', error);
    }

    // Cleanup resources
    function cleanup() {
        try {
            logger.debug('FriendsPageManager cleanup completed');
        } catch (error) {
            logger.error('Failed to cleanup FriendsPageManager:', error);
        }
    }
</script>

<!-- Friends List Manager -->
{#if showFriendsList}
  <UserListManager
      onError={handleError}
      onUserProcessed={handleUserProcessed}
      pageType={PAGE_TYPES.FRIENDS_LIST}
      {showTooltips}
  />
{/if}