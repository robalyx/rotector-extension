<script lang="ts">
    import {get} from 'svelte/store';
    import {settings} from '@/lib/stores/settings';
    import {logger} from '@/lib/utils/logger';
    import {waitForElement} from '@/lib/utils/element-waiter';
    import {FRIENDS_CAROUSEL_SELECTORS, PAGE_TYPES} from '@/lib/types/constants';
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
    let showCarousel = $state(false);
    let showTooltips = $state(true);

    // Reactive settings
    $effect(() => {
        const currentSettings = get(settings);
        showTooltips = currentSettings[SETTINGS_KEYS.HOME_TOOLTIPS_ENABLED];
    });

    // Initialize components when mounted
    $effect(() => {
        initialize();
        onMount?.(cleanup);

        return cleanup;
    });

    // Initialize home page components
    async function initialize() {
        try {
            await setupCarousel();
            logger.debug('HomePageManager initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize HomePageManager:', error);
        }
    }

    // Set up friends carousel
    async function setupCarousel() {
        const result = await waitForElement(FRIENDS_CAROUSEL_SELECTORS.CONTAINER, {
            timeout: 30000,
            onTimeout: () => {
                logger.debug('Friends carousel timeout');
            }
        });

        if (!result.success) {
            throw new Error(`Friends carousel not found after timeout: ${FRIENDS_CAROUSEL_SELECTORS.CONTAINER}`);
        }

        showCarousel = true;
        logger.debug('Home page friends carousel detected and will be managed');
    }

    // Handle user processed events
    function handleUserProcessed(processedUserId: string, status: UserStatus) {
        logger.debug('Home page carousel user processed', {userId: processedUserId, status: status?.flagType});
    }

    // Handle errors
    function handleError(error: string) {
        logger.error('Home page UserListManager error:', error);
    }

    // Cleanup resources
    function cleanup() {
        try {
            logger.debug('HomePageManager cleanup completed');
        } catch (error) {
            logger.error('Failed to cleanup HomePageManager:', error);
        }
    }
</script>

<!-- Home Page Carousel Manager -->
{#if showCarousel}
  <UserListManager
      onError={handleError}
      onUserProcessed={handleUserProcessed}
      pageType={PAGE_TYPES.FRIENDS_CAROUSEL}
      {showTooltips}
  />
{/if}