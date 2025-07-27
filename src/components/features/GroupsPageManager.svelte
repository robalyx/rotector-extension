<script lang="ts">
  import { get } from 'svelte/store';
  import { settings } from '../../lib/stores/settings';
  import { logger } from '../../lib/utils/logger';
  import { waitForElement } from '../../lib/utils/element-waiter';
  import { 
    GROUPS_SELECTORS
  } from '../../lib/types/constants';
  import { SETTINGS_KEYS } from '../../lib/types/settings';
  import type { PageType } from '../../lib/types/api';
  import type { UserStatus } from '../../lib/types/api';
  import UserListManager from './UserListManager.svelte';

  interface Props {
    pageType: PageType;
    onMount?: (cleanup: () => void) => void;
  }

  let { 
    pageType,
    onMount 
  }: Props = $props();

  // Component state
  let showGroups = $state(false);
  let showTooltips = $state(true);

  // Reactive settings
  $effect(() => {
    const currentSettings = get(settings);
    showTooltips = currentSettings[SETTINGS_KEYS.GROUPS_TOOLTIPS_ENABLED];
  });

  // Initialize components when mounted
  $effect(() => {
    initialize();
    onMount?.(cleanup);
    
    return cleanup;
  });

  // Initialize groups page components
  async function initialize() {
    try {
      await setupGroups();
      logger.debug('GroupsPageManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize GroupsPageManager:', error);
    }
  }

  // Set up groups container
  async function setupGroups() {
    const result = await waitForElement(GROUPS_SELECTORS.CONTAINER, {
      timeout: 20000,
      onTimeout: () => {
        logger.debug('Groups container timeout');
      }
    });

    if (!result.success) {
      throw new Error(`Group container not found after timeout: ${GROUPS_SELECTORS.CONTAINER}`);
    }

    showGroups = true;
    logger.debug('Groups container detected and will be managed');
  }

  // Handle user processed events
  function handleUserProcessed(processedUserId: string, status: UserStatus) {
    logger.debug('Groups page user processed', { userId: processedUserId, status: status?.flagType });
  }

  // Handle errors
  function handleError(error: string) {
    logger.error('Groups page UserListManager error:', error);
  }

  // Cleanup resources
  function cleanup() {
    try {
      logger.debug('GroupsPageManager cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup GroupsPageManager:', error);
    }
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