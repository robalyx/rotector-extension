<script lang="ts">
    import {get} from 'svelte/store';
    import {settings} from '@/lib/stores/settings';
    import {logger} from '@/lib/utils/logger';
    import {waitForElement} from '@/lib/utils/element-waiter';
    import {SEARCH_SELECTORS, PAGE_TYPES} from '@/lib/types/constants';
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
    let showSearchList = $state(false);
    let showTooltips = $state(true);

    // Reactive settings
    $effect(() => {
        const currentSettings = get(settings);
        showTooltips = currentSettings[SETTINGS_KEYS.SEARCH_TOOLTIPS_ENABLED];
    });

    // Initialize components when mounted
    $effect(() => {
        void initialize();
        onMount?.(cleanup);

        return cleanup;
    });

    // Initialize search page components
    async function initialize() {
        try {
            await setupSearchListPage();
            logger.debug('SearchPageManager initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize SearchPageManager:', error);
        }
    }

    // Set up search list page
    async function setupSearchListPage() {
        const result = await waitForElement(SEARCH_SELECTORS.CONTAINER, {
            timeout: 30000,
            onTimeout: () => {
                logger.debug('Search results container timeout');
            }
        });

        if (!result.success) {
            throw new Error('Search results container not found on search page');
        }

        showSearchList = true;
        logger.debug('Search results detected and will be managed');
    }

    // Handle user processed events
    function handleUserProcessed(processedUserId: string, status: UserStatus) {
        logger.debug('Search page user processed', {userId: processedUserId, status: status?.flagType});
    }

    // Handle errors
    function handleError(error: string) {
        logger.error('Search page UserListManager error:', error);
    }

    // Cleanup resources
    function cleanup() {
        try {
            logger.debug('SearchPageManager cleanup completed');
        } catch (error) {
            logger.error('Failed to cleanup SearchPageManager:', error);
        }
    }
</script>

<!-- Search Results List Manager -->
{#if showSearchList}
  <UserListManager
      onError={handleError}
      onUserProcessed={handleUserProcessed}
      pageType={PAGE_TYPES.SEARCH_USER}
      {showTooltips}
  />
{/if}