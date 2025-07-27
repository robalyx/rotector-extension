<script lang="ts">
  import { get } from 'svelte/store';
  import { mount } from 'svelte';
  import { settings } from '../../lib/stores/settings';
  import { logger } from '../../lib/utils/logger';
  import { waitForElement } from '../../lib/utils/element-waiter';
  import { 
    FRIENDS_CAROUSEL_SELECTORS,
    PROFILE_SELECTORS,
    COMPONENT_CLASSES,
    PAGE_TYPES,
    USER_ACTIONS
  } from '../../lib/types/constants';
  import { SETTINGS_KEYS } from '../../lib/types/settings';
  import type { UserStatus } from '../../lib/types/api';
  import StatusIndicator from '../status/StatusIndicator.svelte';
  import FriendWarning from './FriendWarning.svelte';
  import QueueModalManager from './QueueModalManager.svelte';
  import UserListManager from './UserListManager.svelte';

  interface Props {
    userId: string;
    userStatus: UserStatus | null;
    onStatusRefresh: () => Promise<void>;
    onMount?: (cleanup: () => void) => void;
  }

  let { 
    userId, 
    userStatus, 
    onStatusRefresh,
    onMount 
  }: Props = $props();

  // Component state
  let friendWarningOpen = $state(false);
  let showCarousel = $state(false);
  let showTooltips = $state(true);

  // Component references
  let queueModalManager: QueueModalManager;
  let statusContainer: HTMLElement | null = null;
  let statusIndicatorComponent: { unmount?: () => void } | null = null;
  let friendButtonHandler: ((event: Event) => void) | null = null;

  // Reactive settings
  $effect(() => {
    const currentSettings = get(settings);
    showTooltips = currentSettings[SETTINGS_KEYS.PROFILE_TOOLTIPS_ENABLED];
  });

  // Update status indicator when userStatus changes
  $effect(() => {
    if (userStatus && statusContainer) {
      mountStatusIndicator();
    }
  });

  // Initialize components when mounted
  $effect(() => {
    initialize();
    onMount?.(cleanup);
    
    return cleanup;
  });

  // Initialize profile components
  async function initialize() {
    try {
      await setupStatusIndicator();
      await setupFriendWarning();
      await setupCarousel();
      
      logger.debug('ProfilePageManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ProfilePageManager:', error);
    }
  }

  // Set up status indicator in profile header
  async function setupStatusIndicator() {
    try {
      // Find profile header title container
      const titleContainer = document.querySelector(PROFILE_SELECTORS.TITLE_CONTAINER) ||
                            document.querySelector(PROFILE_SELECTORS.PROFILE_HEADER) ||
                            document.querySelector('.profile-header-title-container');

      if (!titleContainer) {
        logger.warn('Could not find profile header title container for status indicator');
        return;
      }

      // Check if container already exists, reuse it
      let container = titleContainer.querySelector(`.${COMPONENT_CLASSES.PROFILE_STATUS}`) as HTMLElement;
      if (!container) {
        // Create container for status indicator
        container = document.createElement('div');
        container.className = COMPONENT_CLASSES.PROFILE_STATUS;
        container.style.display = 'inline-flex';
        container.style.alignItems = 'center';
        container.style.verticalAlign = 'middle';
        container.style.lineHeight = 'normal';

        // Append directly to title container
        titleContainer.appendChild(container);
      }

      statusContainer = container;
      
      // Mount StatusIndicator component to the container
      mountStatusIndicator();
      
      logger.debug('Status indicator container set up and component mounted');

    } catch (error) {
      logger.error('Failed to setup status indicator:', error);
    }
  }

  // Mount StatusIndicator component
  function mountStatusIndicator() {
    if (!statusContainer || !userId) return;

    try {
      // Unmount existing component if any
      if (statusIndicatorComponent) {
        statusIndicatorComponent.unmount?.();
        statusIndicatorComponent = null;
      }

      // Clear container content
      statusContainer.innerHTML = '';

      // Mount new StatusIndicator
      const component = mount(StatusIndicator, {
        target: statusContainer,
        props: {
          userId,
          status: userStatus,
          loading: !userStatus,
          showTooltips,
          onClick: handleStatusClick,
          onQueue: handleQueueUser,
          onVote: handleVote
        }
      });

      statusIndicatorComponent = component;
      logger.debug('StatusIndicator component mounted');

    } catch (error) {
      logger.error('Failed to mount StatusIndicator:', error);
    }
  }

  // Set up friend warning if applicable
  async function setupFriendWarning() {
    try {
      const friendButton = document.querySelector('#friend-button');

      if (!friendButton || !userStatus) return;

      // Only show warning for potentially unsafe users
      if (userStatus.flagType === 0) return;

      // Set up click interception
      friendButtonHandler = (event: Event) => {
        // Check if user specifically wants to skip the warning
        if ((friendButton as HTMLElement).dataset.skipWarning) {
          logger.debug('Skipping friend warning - user confirmed');
          delete (friendButton as HTMLElement).dataset.skipWarning;
          return;
        }

        // Prevent the default friend request behavior
        event.preventDefault();
        event.stopPropagation();
        
        logger.debug('Friend button clicked - showing warning modal');
        
        // Show the friend warning modal
        friendWarningOpen = true;
      };

      // Add click listener with capture to intercept before other handlers
      friendButton.addEventListener('click', friendButtonHandler, true);

      logger.debug('Friend warning set up and interception configured');
    } catch (error) {
      logger.error('Failed to setup friend warning:', error);
    }
  }

  // Set up carousel manager if carousel exists
  async function setupCarousel() {
    try {
      const containerSelector = FRIENDS_CAROUSEL_SELECTORS.CONTAINER;
      
      // Wait for carousel container
      const result = await waitForElement(containerSelector, {
        onTimeout: () => {
          logger.debug('Carousel search timed out - carousel may not exist on this profile');
        }
      });

      if (result.success) {
        showCarousel = true;
        logger.debug('Profile carousel detected and will be managed');
      } else {
        logger.debug('No friends carousel found on profile page');
      }

    } catch (error) {
      logger.error('Failed to setup carousel:', error);
    }
  }

  // Handle status indicator click
  function handleStatusClick(clickedUserId: string) {
    logger.userAction(USER_ACTIONS.STATUS_CLICKED, { userId: clickedUserId });
  }

  // Handle queue user request
  function handleQueueUser(clickedUserId: string) {
    logger.userAction(USER_ACTIONS.QUEUE_REQUESTED, { userId: clickedUserId });
    queueModalManager?.showQueue(clickedUserId);
  }

  // Handle vote submission
  function handleVote(clickedUserId: string, voteType: number) {
    logger.userAction(USER_ACTIONS.VOTE_SUBMITTED, { userId: clickedUserId, voteType });
  }

  // Handle friend request proceed
  function handleFriendProceed() {
    logger.userAction(USER_ACTIONS.FRIEND_PROCEED, { userId });
    
    // Find the friend button and simulate click to proceed with friend request
    const friendButton = document.querySelector('#friend-button');
    
    if (friendButton) {
      (friendButton as HTMLElement).dataset.skipWarning = 'true';
      (friendButton as HTMLElement).click();
      
      logger.debug('Friend request proceeded - simulated click');
    }

    friendWarningOpen = false;
  }

  // Handle friend request cancel
  function handleFriendCancel() {
    logger.userAction(USER_ACTIONS.FRIEND_CANCEL, { userId });
    friendWarningOpen = false;
    logger.debug('Friend request cancelled by user');
  }

  // Handle block user action
  function handleFriendBlock() {
    logger.userAction(USER_ACTIONS.FRIEND_BLOCK, { userId });
    
    try {
      // Find the more options button (three dots)
      const moreButton = document.querySelector('.profile-header-dropdown') ||
                         document.querySelector('[aria-label="See More"]');
      
      if (moreButton) {
        // Click the more button to open dropdown
        (moreButton as HTMLElement).click();
        
        // Wait for dropdown to appear and find block option
        setTimeout(() => {
          const blockButton = document.querySelector('#block-button');
          
          if (blockButton) {
            (blockButton as HTMLElement).click();
            logger.debug('Block user action triggered');
          } else {
            logger.warn('Could not find block button in dropdown');
          }
        }, 500);
      } else {
        logger.warn('Could not find more options button for blocking');
      }
    } catch (error) {
      logger.error('Error blocking user:', error);
    }

    // Hide the modal
    friendWarningOpen = false;
  }


  // Handle carousel user processed event
  function handleCarouselUserProcessed(processedUserId: string, status: UserStatus) {
    logger.debug('Profile carousel user processed', { userId: processedUserId, status: status.flagType });
  }

  // Handle carousel errors
  function handleCarouselError(error: string) {
    logger.error('Profile carousel UserListManager error:', error);
  }

  // Cleanup resources
  function cleanup() {
    try {
      // Clean up friend button event listener
      const friendButton = document.querySelector('#friend-button');
      
      if (friendButton && friendButtonHandler) {
        friendButton.removeEventListener('click', friendButtonHandler, true);
        friendButtonHandler = null;
      }

      // Clean up status indicator component
      if (statusIndicatorComponent) {
        statusIndicatorComponent.unmount?.();
        statusIndicatorComponent = null;
      }

      // Clean up status container
      if (statusContainer) {
        statusContainer.remove();
        statusContainer = null;
      }

      logger.debug('ProfilePageManager cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup ProfilePageManager:', error);
    }
  }
</script>

<!-- Friend Warning Modal -->
{#if userStatus && userStatus.flagType > 0}
  <FriendWarning
    isOpen={friendWarningOpen}
    onBlock={handleFriendBlock}
    onCancel={handleFriendCancel}
    onProceed={handleFriendProceed}
    status={userStatus}
    {userId}
  />
{/if}


<!-- Queue Modal Manager -->
<QueueModalManager
  bind:this={queueModalManager}
  {onStatusRefresh}
/>

<!-- Carousel Manager -->
{#if showCarousel}
  <UserListManager
    onError={handleCarouselError}
    onUserProcessed={handleCarouselUserProcessed}
    pageType={PAGE_TYPES.FRIENDS_CAROUSEL}
    {showTooltips}
  />
{/if}