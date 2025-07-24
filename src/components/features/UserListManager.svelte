<script lang="ts">
  import { mount } from 'svelte';
  import { SvelteSet, SvelteMap } from 'svelte/reactivity';
  import { observerFactory } from '../../lib/utils/observer';
  import { 
    FRIENDS_CAROUSEL_SELECTORS, 
    FRIENDS_SELECTORS,
    GROUPS_SELECTORS,
    PAGE_TYPES,
    COMPONENT_CLASSES,
    USER_ACTIONS
  } from '../../lib/types/constants';
  import { apiClient } from '../../lib/services/api-client';
  import { userStatusService } from '../../lib/services/user-status-service';
  import { sanitizeUserId } from '../../lib/utils/sanitizer';
  import { logger } from '../../lib/utils/logger';
  import type { UserStatus, PageType, QueueSuccessData, QueueErrorData } from '../../lib/types/api';
  import type { Observer } from '../../lib/utils/observer';
  import StatusIndicator from '../status/StatusIndicator.svelte';
  import QueuePopup from './QueuePopup.svelte';
  import QueueSuccessModal from './QueueSuccessModal.svelte';
  import QueueErrorModal from './QueueErrorModal.svelte';

  interface Props {
    pageType: PageType;
    showTooltips?: boolean;
    onUserProcessed?: (userId: string, status: UserStatus) => void;
    onError?: (error: string) => void;
    onMount?: (cleanup: () => void) => void;
  }

  let {
    pageType,
    showTooltips = true,
    onUserProcessed,
    onError,
    onMount
  }: Props = $props();

  // Local state
  let observer: Observer | null = null;
  let containerWatcher: Observer | null = null; 
  let processedUsers = new SvelteSet<string>();
  let userStatuses = new SvelteMap<string, UserStatus>();
  let loadingUsers = new SvelteSet<string>();
  let mountedComponents = new SvelteMap<string, { unmount?: () => void }>();
  let elementToComponent = new WeakMap<Element, { userId: string; component: { unmount?: () => void } }>();
  let destroyed = $state(false);
  
  // Queue modal state
  let showQueueModal = $state(false);
  let queueUserId = $state<string>('');
  let showSuccessModal = $state(false);
  let showErrorModal = $state(false);
  let successData = $state<QueueSuccessData | null>(null);
  let errorData = $state<QueueErrorData | null>(null);

  // Type definitions for user details
  interface UserDetails {
    userId: string;
    element: Element;
    profileLink: Element;
  }

  // Page configuration objects
  const FRIENDS_CAROUSEL_CONFIG = {
    containerSelector: FRIENDS_CAROUSEL_SELECTORS.CONTAINER,
    itemSelector: FRIENDS_CAROUSEL_SELECTORS.TILE,
    profileLinkSelector: FRIENDS_CAROUSEL_SELECTORS.PROFILE_LINK
  };

  const PAGE_CONFIGS = {
    [PAGE_TYPES.FRIENDS_LIST]: {
      containerSelector: FRIENDS_SELECTORS.CONTAINER,
      itemSelector: FRIENDS_SELECTORS.CARD.CONTAINER,
      profileLinkSelector: FRIENDS_SELECTORS.PROFILE_LINK
    },
    [PAGE_TYPES.GROUPS]: {
      containerSelector: GROUPS_SELECTORS.CONTAINER,
      itemSelector: GROUPS_SELECTORS.TILE,
      profileLinkSelector: GROUPS_SELECTORS.PROFILE_LINK
    },
    [PAGE_TYPES.FRIENDS_CAROUSEL]: FRIENDS_CAROUSEL_CONFIG,
    [PAGE_TYPES.HOME]: FRIENDS_CAROUSEL_CONFIG,
    [PAGE_TYPES.PROFILE]: FRIENDS_CAROUSEL_CONFIG
  };

  // Get page configuration with validation
  function getPageConfig() {
    const config = PAGE_CONFIGS[pageType as keyof typeof PAGE_CONFIGS];
    if (!config) {
      throw new Error(`UserListManager does not support page type: ${pageType}`);
    }
    return config;
  }

  // Creates standardized observer configuration for the current page type
  function createObserverConfig(options: {
    name?: string;
    processExistingItems?: boolean;
    restartDelay?: number;
  } = {}) {
    const config = getPageConfig();
    
    // Enable post-resize processing for carousel page types where resize events
    // can cause new tiles to appear that need to be processed
    const isCarouselPageType = pageType === PAGE_TYPES.FRIENDS_CAROUSEL || 
                              pageType === PAGE_TYPES.HOME || 
                              pageType === PAGE_TYPES.PROFILE;
    
    return {
      name: options.name || `user-list-${pageType}`,
      containerSelector: config.containerSelector,
      unprocessedItemSelector: config.itemSelector,
      processItems: handleNewUsers,
      processExistingItems: options.processExistingItems ?? true,
      maxRetries: 3,
      enablePostResizeProcessing: isCarouselPageType,
      ...(options.restartDelay && { restartDelay: options.restartDelay })
    };
  }

  // Initialize observer and start processing, cleanup on unmount
  $effect(() => {
    if (destroyed) {
      return;
    }
    
    // Provide cleanup function to parent
    onMount?.(cleanup);
    
    initializeObserver();
    
    // Start periodic cleanup for orphaned components
    const cleanupInterval = setInterval(() => {
      cleanupOrphanedComponents();
    }, 5000);
    
    return () => {
      clearInterval(cleanupInterval);
      cleanup();
    };
  });

  // Initialize the observer for this page type
  async function initializeObserver() {
    if (destroyed) {
      return;
    }
    
    try {
      // For friends page, use hybrid approach due to container replacement during pagination
      if (pageType === PAGE_TYPES.FRIENDS_LIST) {
        await initializeFriendsPageObserver();
      } else {
        // Standard list observer for other page types
        const config = createObserverConfig();

        observer = observerFactory.createListObserver(config);
        await observer.start();
      }

      logger.debug(`UserListManager observer started for ${pageType}`);
      
      await warmCacheForVisibleUsers();
    } catch (error) {
      logger.error('Failed to initialize UserListManager observer:', error);
      onError?.('Failed to initialize user list processing');
    }
  }

  // Initialize observer specifically for friends page with container replacement handling
  async function initializeFriendsPageObserver() {
    containerWatcher = observerFactory.createContainerWatcher({
      name: `friends-container-watcher`,
      containerSelector: FRIENDS_SELECTORS.CONTAINER,
      onContainerAdded: async (container: Element) => {
        logger.debug('Friends container detected/replaced, processing new items');
        
        // Process all items in the new container immediately
        const items = Array.from(container.querySelectorAll(FRIENDS_SELECTORS.CARD.CONTAINER));
        if (items.length > 0) {
          await handleNewUsers(items);
        }
        
        // Restart the list observer on the new container
        if (observer) {
          observer.stop();
          observer.cleanup();
        }
        
        // Create new list observer for the new container
        const config = createObserverConfig({
          name: 'friends-list-observer',
          processExistingItems: false,
          restartDelay: 500
        });

        observer = observerFactory.createListObserver(config);
        await observer.start();
      }
    });

    // Start the container watcher
    await containerWatcher.start();

    // Also create initial list observer if container already exists
    const existingContainer = document.querySelector(FRIENDS_SELECTORS.CONTAINER);
    if (existingContainer) {
      const config = createObserverConfig({
        name: 'friends-list-observer',
        restartDelay: 500
      });

      observer = observerFactory.createListObserver(config);
      await observer.start();
    }
  }

  // Get container selector based on page type
  function getContainerSelector(): string {
    return getPageConfig().containerSelector;
  }

  // Get user item selector based on page type
  function getUserItemSelector(): string {
    return getPageConfig().itemSelector;
  }

  // Process new users found by the observer
  async function handleNewUsers(items: Element[]) {
    try {
      const userElements = items.filter(item => !isProcessed(item));
      if (userElements.length === 0) return;

      logger.debug(`Processing ${userElements.length} new users for ${pageType}`);

      // Extract user details
      const allUserDetails = userElements
        .map(extractUserDetails)
        .filter((user): user is UserDetails => user !== null);

      if (allUserDetails.length === 0) return;

      // Separate users into new and returning
      const newUsers: UserDetails[] = [];
      const returningUsers: UserDetails[] = [];

      allUserDetails.forEach(user => {
        if (processedUsers.has(user.userId)) {
          // User was processed before but DOM element is new
          returningUsers.push(user);
        } else {
          // Completely new user
          newUsers.push(user);
        }
      });

      // Mark all as processed (DOM-wise)
      allUserDetails.forEach(user => {
        markAsProcessed(user.element);
      });

      // Process new users
      if (newUsers.length > 0) {
        newUsers.forEach(user => {
          processedUsers.add(user.userId);
        });

        // Mount status indicators immediately with loading state
        newUsers.forEach(user => {
          mountStatusIndicator(user, true);
        });

        // Load user statuses in batches
        await loadUserStatuses(newUsers);

        // Remount status indicators with actual data
        newUsers.forEach(user => {
          if (userStatuses.has(user.userId)) {
            mountStatusIndicator(user, false);
          }
        });
      }

      // Re-mount status indicators for returning users
      returningUsers.forEach(user => {
        if (userStatuses.has(user.userId)) {
          mountStatusIndicator(user, false);
        }
      });
    
    } catch (error) {
      logger.error('Failed to process new users:', error);
      onError?.('Failed to process user list');
    }
  }

  // Extract user details from DOM element
  function extractUserDetails(element: Element): UserDetails | null {
    try {
      let profileLink: Element | null = null;

      // Get the appropriate profile link selector based on page type
      profileLink = element.querySelector(getPageConfig().profileLinkSelector);

      if (!profileLink) {
        return null;
      }

      const href = profileLink.getAttribute('href');
      if (!href) return null;

      const userIdMatch = href.match(/\/users\/(\d+)/);
      if (!userIdMatch) return null;

      const userId = sanitizeUserId(userIdMatch[1]);
      if (!userId) return null;

      return {
        userId: userId.toString(),
        element,
        profileLink
      };
    } catch (error) {
      logger.error('Failed to extract user details:', error);
      return null;
    }
  }

  // Check if element is already processed
  function isProcessed(element: Element): boolean {
    return element.hasAttribute('data-rotector-processed');
  }

  // Mark element as processed
  function markAsProcessed(element: Element): void {
    element.setAttribute('data-rotector-processed', 'true');
  }

  // Load user statuses from API with caching
  async function loadUserStatuses(users: UserDetails[]) {
    try {
      const userIds = users.map(u => u.userId);
      
      // Mark as loading
      userIds.forEach(id => loadingUsers.add(id));

      // Use cached batch request
      const statusMap = await userStatusService.getStatuses(userIds);
      
      // Store statuses
      statusMap.forEach((status, userId) => {
        if (status) {
          userStatuses.set(userId, status);
        }
        loadingUsers.delete(userId);
        
        // Notify parent
        if (status) {
          onUserProcessed?.(userId, status);
        }
      });

      logger.debug(`Loaded ${statusMap.size} user statuses for ${pageType}`);
    
    } catch (error) {
      logger.error('Failed to load user statuses:', error);
      
      // Clear loading state
      users.forEach(u => loadingUsers.delete(u.userId));
      
      onError?.('Failed to load user status information');
    }
  }

  // Mount status indicator for a user
  function mountStatusIndicator(user: UserDetails, isLoading = false) {
    try {
      const status = userStatuses.get(user.userId);
      
      // If not loading and no status, skip mount
      if (!isLoading && !status) {
        logger.warn(`No status found for user ${user.userId} - skipping mount`);
        return;
      }

      // Unmount existing component if any
      const existingComponent = mountedComponents.get(user.userId);
      if (existingComponent) {
        existingComponent.unmount?.();
        mountedComponents.delete(user.userId);
      }

      const tileElement = user.element as HTMLElement;
      let targetElement: HTMLElement;

      // For friends list, place status indicator inside avatar-card-caption
      if (pageType === PAGE_TYPES.FRIENDS_LIST) {
        const captionElement = tileElement.querySelector('.avatar-card-caption') as HTMLElement;
        if (captionElement) {
          targetElement = captionElement;
        } else {
          logger.warn(`Avatar card caption not found for user ${user.userId} - using tile element`);
          targetElement = tileElement;
        }
      } else {
        // For other page types, use the tile element directly
        targetElement = tileElement;
      }

      // Check if container already exists, reuse it
      let container = targetElement.querySelector(`.${COMPONENT_CLASSES.STATUS_CONTAINER}`) as HTMLElement;
      if (!container) {
        // Create container for status indicator
        container = document.createElement('div');
        
        // Apply base status container class
        container.className = COMPONENT_CLASSES.STATUS_CONTAINER;
        
        // Add absolute positioning modifier for friend carousel tiles and groups
        if (pageType === PAGE_TYPES.FRIENDS_CAROUSEL || pageType === PAGE_TYPES.GROUPS) {
          container.classList.add(COMPONENT_CLASSES.STATUS_POSITIONED_ABSOLUTE);
        }

        // Ensure the target element has relative positioning for absolute positioning to work
        if (targetElement.style.position !== 'relative' && targetElement.style.position !== 'absolute') {
          targetElement.style.position = 'relative';
        }

        // Insert into the target element
        targetElement.appendChild(container);
      }

      const showTextValue = pageType !== PAGE_TYPES.FRIENDS_CAROUSEL && pageType !== PAGE_TYPES.GROUPS;

      // Clear container content before mounting to prevent duplicates
      container.innerHTML = '';

      // Mount StatusIndicator component
      const component = mount(StatusIndicator, {
        target: container,
        props: {
          userId: user.userId,
          status: isLoading ? null : status,
          loading: isLoading,
          showTooltips,
          showText: showTextValue,
          skipAutoFetch: true, // Prevent individual API calls since this is batch-managed
          onClick: handleStatusClick,
          onQueue: handleQueueUser
        }
      });

      // Store component reference for potential cleanup
      mountedComponents.set(user.userId, component);
      
      // Also track by DOM element for detecting when elements are removed
      elementToComponent.set(user.element, { userId: user.userId, component });

      logger.debug(`Status indicator mounted for user ${user.userId} on ${pageType}`, {
        isLoading,
        statusType: status?.flagType,
        showText: showTextValue,
        targetElement: pageType === PAGE_TYPES.FRIENDS_LIST ? 'avatar-card-caption' : 'tile'
      });

    } catch (error) {
      logger.error('Failed to mount status indicator:', error, {
        userId: user.userId,
        pageType,
        hasStatus: !!userStatuses.get(user.userId)
      });
    }
  }

  // Handle status indicator click
  function handleStatusClick(userId: string) {
    logger.userAction(`${pageType}_${USER_ACTIONS.STATUS_CLICKED}`, { userId });
  }

  // Clean up components for DOM elements that have been removed
  function cleanupOrphanedComponents() {
    const orphanedUserIds = new SvelteSet<string>();
    
    // Check each mounted component to see if its DOM element still exists
    for (const [userId] of mountedComponents.entries()) {
      // Try to find the user's element in the current DOM
      const selector = `[data-rotector-processed] [href*="/users/${userId}"]`;
      const element = document.querySelector(selector)?.closest('[data-rotector-processed]');
      
      if (!element || !document.contains(element)) {
        // Element no longer exists in DOM, mark for cleanup
        orphanedUserIds.add(userId);
      }
    }
    
    // Clean up orphaned components
    if (orphanedUserIds.size > 0) {
      logger.debug(`Cleaning up ${orphanedUserIds.size} orphaned components for ${pageType}`);
      
      orphanedUserIds.forEach(userId => {
        const component = mountedComponents.get(userId);
        if (component) {
          try {
            component.unmount?.();
          } catch (error) {
            logger.error('Failed to unmount orphaned component:', error);
          }
          mountedComponents.delete(userId);
        }
      });
    }
  }

  // Handle queue user action
  function handleQueueUser(userId: string) {
    queueUserId = userId;
    showQueueModal = true;
  }

  // Handle queue confirmation from modal
  async function handleQueueConfirm(inappropriateOutfit = false) {
    try {
      logger.userAction(`${pageType}_queue_user`, { userId: queueUserId, inappropriateOutfit });
      
      const result = await apiClient.queueUser(queueUserId, inappropriateOutfit);
      
      // Handle successful queue submission
      if (result.success && result.data) {
        successData = result.data;
        showSuccessModal = true;
        
        // Refresh user status
        const newStatus = await userStatusService.getStatus(queueUserId);
        if (newStatus) {
          userStatuses.set(queueUserId, newStatus);
        }
        
        // Re-mount status indicator with updated status
        const userElement = document.querySelector(`[data-rotector-processed] [href*="/users/${queueUserId}"]`)?.closest('[data-rotector-processed]');
        if (userElement) {
          // Find and update existing status indicator
          const statusContainer = userElement.querySelector(`.${COMPONENT_CLASSES.STATUS_CONTAINER}`);
          if (statusContainer) {
            statusContainer.remove();
            const user = extractUserDetails(userElement);
            if (user) {
              mountStatusIndicator(user);
            }
          }
        }
      } else {
        errorData = {
          error: result.error || 'Unknown error occurred',
          requestId: result.requestId || 'N/A',
          code: result.code || 'UNKNOWN_ERROR',
          type: result.type || 'Error'
        };
        showErrorModal = true;
      }
    } catch (error) {
      logger.error('Failed to queue user:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorObj = error as Error & { requestId?: string; code?: string; type?: string };
      
      errorData = {
        error: errorMessage,
        requestId: errorObj.requestId || 'N/A',
        code: errorObj.code || 'NETWORK_ERROR',
        type: errorObj.type || 'Error'
      };
      showErrorModal = true;
    } finally {
      // Reset queue modal state
      showQueueModal = false;
      queueUserId = '';
    }
  }

  // Handle queue cancellation from modal
  function handleQueueCancel() {
    logger.userAction(`${pageType}_queue_cancel`, { userId: queueUserId });
    showQueueModal = false;
    queueUserId = '';
  }

  // Handle success modal close
  function handleSuccessModalClose() {
    showSuccessModal = false;
    successData = null;
  }

  // Handle error modal close
  function handleErrorModalClose() {
    showErrorModal = false;
    errorData = null;
  }

  // Warm the cache with visible users on page load
  async function warmCacheForVisibleUsers() {
    try {
      const selector = getUserItemSelector();
      const container = document.querySelector(getContainerSelector());
      if (!container) return;

      const visibleUsers = container.querySelectorAll(selector);
      const userIds: string[] = [];

      visibleUsers.forEach(element => {
        const user = extractUserDetails(element);
        if (user && !processedUsers.has(user.userId)) {
          userIds.push(user.userId);
        }
      });

      if (userIds.length > 0) {
        logger.debug('Warming cache for visible users', { count: userIds.length });
        await userStatusService.warmCache(userIds);
      }
    } catch (error) {
      logger.error('Failed to warm cache:', error);
    }
  }

  // Cleanup resources
  function cleanup() {
    destroyed = true;
    
    if (observer) {
      observer.stop();
      observer.cleanup();
      observer = null;
    }

    if (containerWatcher) {
      containerWatcher.stop();
      containerWatcher.cleanup();
      containerWatcher = null;
    }
    
    // Cleanup mounted components
    for (const component of mountedComponents.values()) {
      try {
        component.unmount?.();
      } catch (error) {
        logger.error('Failed to unmount component:', error);
      }
    }
    
    processedUsers.clear();
    userStatuses.clear();
    loadingUsers.clear();
    mountedComponents.clear();
    
    logger.debug(`UserListManager cleanup completed for ${pageType}`);
  }
</script>

<!-- Queue confirmation modal -->
<QueuePopup
  onCancel={handleQueueCancel}
  onConfirm={handleQueueConfirm}
  userId={queueUserId}
  bind:isOpen={showQueueModal}
/>

<!-- Success Modal -->
{#if successData}
  <QueueSuccessModal
    onClose={handleSuccessModalClose}
    {successData}
    bind:isOpen={showSuccessModal}
  />
{/if}

<!-- Error Modal -->
{#if errorData}
  <QueueErrorModal
    {errorData}
    onClose={handleErrorModalClose}
    userId={queueUserId}
    bind:isOpen={showErrorModal}
  />
{/if} 