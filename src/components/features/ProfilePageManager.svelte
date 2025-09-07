<script lang="ts">
    import {get} from 'svelte/store';
    import {mount} from 'svelte';
    import {settings} from '@/lib/stores/settings';
    import {logger} from '@/lib/utils/logger';
    import {waitForElement} from '@/lib/utils/element-waiter';
    import {
        COMPONENT_CLASSES,
        ENTITY_TYPES,
        FRIENDS_CAROUSEL_SELECTORS,
        PAGE_TYPES,
        PROFILE_GROUPS_SHOWCASE_SELECTORS,
        PROFILE_SELECTORS,
        USER_ACTIONS
    } from '@/lib/types/constants';
    import {SETTINGS_KEYS} from '@/lib/types/settings';
    import type {UserStatus} from '@/lib/types/api';
    import StatusIndicator from '../status/StatusIndicator.svelte';
    import FriendWarning from './FriendWarning.svelte';
    import QueueModalManager from './QueueModalManager.svelte';
    import type {QueueModalManagerInstance} from '@/lib/types/components';
    import UserListManager from './UserListManager.svelte';
    import GroupListManager from './GroupListManager.svelte';

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
    let showGroupsShowcase = $state(false);

    // Component references
    let queueModalManager: QueueModalManagerInstance | undefined;
    let statusContainer: HTMLElement | null = null;
    let friendButtonHandler: ((event: Event) => void) | null = null;
    let mountedComponents = $state(new Map<string, { unmount?: () => void }>());

    // Update status indicator when userStatus changes
    $effect(() => {
        if (userStatus && statusContainer) {
            mountStatusIndicator();
        }
    });

    // Initialize components when mounted
    $effect(() => {
        void initialize();
        onMount?.(cleanup);

        return cleanup;
    });

    // Initialize profile components
    async function initialize() {
        try {
            await Promise.all([
                setupStatusIndicator(),
                setupFriendWarning(),
                setupCarousel(),
                setupGroupsShowcase()
            ]);

            logger.debug('ProfilePageManager initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize ProfilePageManager:', error);
        }
    }

    // Set up status indicator in profile header
    async function setupStatusIndicator() {
        try {
            // Wait for profile header title container
            const titleResult = await waitForElement(`${PROFILE_SELECTORS.TITLE_CONTAINER}, ${PROFILE_SELECTORS.PROFILE_HEADER}, .profile-header-title-container`);

            if (!titleResult.success || !titleResult.element) {
                logger.warn('Could not find profile header title container for status indicator');
                return;
            }

            const titleContainer = titleResult.element;

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
            // Check and unmount existing component
            const existingComponent = mountedComponents.get('profile-status');
            if (existingComponent) {
                existingComponent.unmount?.();
                mountedComponents.delete('profile-status');
            }

            // Clear container content
            statusContainer.innerHTML = '';

            // Mount new StatusIndicator
            const component = mount(StatusIndicator, {
                target: statusContainer,
                props: {
                    entityId: userId,
                    entityType: ENTITY_TYPES.USER,
                    status: userStatus,
                    loading: !userStatus,
                    onClick: handleStatusClick,
                    onQueue: handleQueueUser
                }
            });

            // Track the component
            mountedComponents.set('profile-status', component);

            logger.debug('StatusIndicator component mounted');

        } catch (error) {
            logger.error('Failed to mount StatusIndicator:', error);
        }
    }

    // Set up friend warning if applicable
    async function setupFriendWarning() {
        try {
            if (!userStatus || userStatus.flagType === 0) return;

            // Wait for friend button to be available
            const result = await waitForElement('#friend-button');

            if (!result.success || !result.element) return;

            const friendButton = result.element;

            // Set up click interception
            friendButtonHandler = (event: Event) => {
                // Check if user specifically wants to skip the warning
                if (friendButton.dataset.skipWarning) {
                    delete friendButton.dataset.skipWarning;
                    return;
                }

                // Prevent the default friend request behavior
                event.preventDefault();
                event.stopPropagation();

                // Show the friend warning modal
                friendWarningOpen = true;
            };

            // Add click listener with capture to intercept before other handlers
            friendButton.addEventListener('click', friendButtonHandler, true);

        } catch (error) {
            logger.error('Failed to setup friend warning:', error);
        }
    }

    // Set up carousel manager if carousel exists
    async function setupCarousel() {
        try {
            const containerSelector = FRIENDS_CAROUSEL_SELECTORS.CONTAINER;

            // Wait for carousel container
            const result = await waitForElement(containerSelector);

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

    // Set up groups showcase manager if groups showcase exists
    async function setupGroupsShowcase() {
        try {
            // Check if groups checks are enabled
            const currentSettings = get(settings);
            if (!currentSettings[SETTINGS_KEYS.GROUPS_CHECK_ENABLED]) {
                logger.debug('Groups checks disabled, skipping groups showcase setup');
                return;
            }

            // Wait for groups showcase container
            const result = await waitForElement(PROFILE_GROUPS_SHOWCASE_SELECTORS.CONTAINER);

            if (result.success) {
                showGroupsShowcase = true;
                logger.debug('Profile groups showcase detected and will be managed');
            } else {
                logger.debug('No groups showcase found on profile page');
            }

        } catch (error) {
            logger.error('Failed to setup groups showcase:', error);
        }
    }

    // Handle status indicator click
    function handleStatusClick(clickedUserId: string) {
        logger.userAction(USER_ACTIONS.STATUS_CLICKED, {userId: clickedUserId});
    }

    // Handle queue user request
    function handleQueueUser(clickedUserId: string) {
        logger.userAction(USER_ACTIONS.QUEUE_REQUESTED, {userId: clickedUserId});
        queueModalManager?.showQueue(clickedUserId);
    }

    // Handle friend request proceed
    function handleFriendProceed() {
        logger.userAction(USER_ACTIONS.FRIEND_PROCEED, {userId});

        // Find the friend button and simulate click to proceed with friend request
        const friendButton = document.querySelector('#friend-button');

        if (friendButton instanceof HTMLElement) {
            friendButton.dataset.skipWarning = 'true';
            friendButton.click();

            logger.debug('Friend request proceeded - simulated click');
        }

        friendWarningOpen = false;
    }

    // Handle friend request cancel
    function handleFriendCancel() {
        logger.userAction(USER_ACTIONS.FRIEND_CANCEL, {userId});
        friendWarningOpen = false;
        logger.debug('Friend request cancelled by user');
    }

    // Handle block user action
    function handleFriendBlock() {
        logger.userAction(USER_ACTIONS.FRIEND_BLOCK, {userId});

        try {
            // Find the more options button (three dots)
            const moreButton = document.querySelector('.profile-header-dropdown') ||
                document.querySelector('[aria-label="See More"]');

            if (moreButton instanceof HTMLElement) {
                // Click the more button to open dropdown
                moreButton.click();

                // Wait for dropdown to appear and find block option
                setTimeout(() => {
                    const blockButton = document.querySelector('#block-button') as HTMLElement;

                    if (blockButton) {
                        blockButton.click();
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
        logger.debug('Profile carousel user processed', {userId: processedUserId, status: status.flagType});
    }

    // Handle carousel errors
    function handleCarouselError(error: string) {
        logger.error('Profile carousel UserListManager error:', error);
    }

    // Handle groups showcase errors
    function handleGroupsShowcaseError(error: string) {
        logger.error('Profile groups showcase GroupListManager error:', error);
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

            // Clean up mounted components
            mountedComponents.forEach(component => component.unmount?.());
            mountedComponents.clear();

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
  />
{/if}

<!-- Groups Showcase Manager -->
{#if showGroupsShowcase}
  <GroupListManager
      onError={handleGroupsShowcaseError}
  />
{/if}