import { get } from 'svelte/store';
import { PageController } from './PageController';
import { 
  FRIENDS_CAROUSEL_SELECTORS,
  PROFILE_SELECTORS,
  COMPONENT_CLASSES,
  PAGE_TYPES,
  USER_ACTIONS,
  type ComponentClassType
} from '../types/constants';
import { SETTINGS_KEYS } from '../types/settings';
import { apiClient } from '../services/api-client';
import { userStatusService } from '../services/user-status-service';
import { sanitizeUserId } from '../utils/sanitizer';
import { waitForElement } from '../utils/element-waiter';
import { settings } from '../stores/settings';
import StatusIndicator from '../../components/status/StatusIndicator.svelte';
import FriendWarning from '../../components/features/FriendWarning.svelte';
import QueuePopup from '../../components/features/QueuePopup.svelte';
import ReportHelper from '../../components/features/ReportHelper.svelte';
import type { UserStatus } from '../types/api';
import { logger } from '../utils/logger';

/**
 * Handles user profile pages
 */
export class ProfilePageController extends PageController {
  private userId: string | null = null;
  private userStatus: UserStatus | null = null;
  private statusIndicator: { element: HTMLElement; cleanup: () => void } | null = null;
  private friendWarning: { element: HTMLElement; cleanup: () => void; component?: object } | null = null;
  private friendWarningOpen = false;
  private queuePopup: { element: HTMLElement; cleanup: () => void } | null = null;
  private reportHelper: { element: HTMLElement; cleanup: () => void } | null = null;
  private carouselManager: { element: HTMLElement; cleanup: () => void } | null = null;

  protected async initializePage(): Promise<void> {
    try {
      logger.debug('Initializing ProfilePageController', { 
        pageType: this.pageType,
        url: this.url 
      });

      // Check if profile checks are enabled
      const currentSettings = get(settings);
      if (!currentSettings[SETTINGS_KEYS.PROFILE_CHECK_ENABLED]) {
        logger.debug('Profile checks disabled, skipping ProfilePageController initialization');
        return;
      }

      // Extract user ID from URL
      this.userId = this.extractUserIdFromUrl();
      if (!this.userId) {
        throw new Error('Could not extract user ID from profile URL');
      }

      logger.debug('Profile user ID extracted', { userId: this.userId });

      // Wait for profile elements to load
      await this.waitForProfileElements();

      // Load user status
      await this.loadUserStatus();

      // Mount status indicator with data
      await this.mountStatusIndicator();

      // Mount other components
      await this.mountOtherProfileComponents();

      logger.debug('ProfilePageController initialized successfully');

    } catch (error) {
      this.handleError(error, 'initializePage');
      throw error;
    }
  }

  // Extract user ID from profile URL
  private extractUserIdFromUrl(): string | null {
    try {
      const match = this.url.match(/\/users\/(\d+)/);
      if (match && match[1]) {
        return sanitizeUserId(match[1])?.toString() || null;
      }
      return null;
    } catch (error) {
      logger.error('Failed to extract user ID from URL:', error);
      return null;
    }
  }

  // Wait for profile elements to be available
  private async waitForProfileElements(): Promise<void> {
    // Wait for the profile header username element
    const result = await waitForElement('.profile-header-username', {
      timeout: 20000,
      onTimeout: () => {}
    });
    
    if (!result.success) {
      throw new Error('Profile username element not found after timeout');
    }
  }

  // Load user status from API with caching
  private async loadUserStatus(): Promise<void> {
    if (!this.userId) return;

    try {
      logger.debug('Loading user status', { userId: this.userId });
      this.userStatus = await userStatusService.getStatus(this.userId);
      logger.debug('User status loaded', { 
        userId: this.userId, 
        flagType: this.userStatus?.flagType 
      });
    } catch (error) {
      logger.error('Failed to load user status:', error);
    }
  }

  // Mount other profile components (excluding status indicator)
  private async mountOtherProfileComponents(): Promise<void> {
    try {
      // Mount friend warning if applicable
      await this.mountFriendWarning();

      // Mount carousel manager if carousel exists
      await this.mountCarouselManager();

      // Set up queue popup
      this.setupQueuePopup();

      // Set up report helper
      this.setupReportHelper();

      logger.debug('Other profile components mounted successfully');

    } catch (error) {
      this.handleError(error, 'mountOtherProfileComponents');
      throw error;
    }
  }

  // Mount status indicator in profile header
  private async mountStatusIndicator(): Promise<void> {
    try {
      // If status indicator already exists, unmount it first
      if (this.statusIndicator) {
        logger.debug('Unmounting existing status indicator');
        this.statusIndicator.cleanup();
        this.statusIndicator = null;
      }

      // Find profile header title container
      const titleContainer = this.findElement(`${PROFILE_SELECTORS.TITLE_CONTAINER}`) ||
                            this.findElement(`${PROFILE_SELECTORS.PROFILE_HEADER}`) ||
                            this.findElement('.profile-header-title-container');

      if (!titleContainer) {
        logger.warn('Could not find profile header title container for status indicator');
        return;
      }

      // Check if container already exists, reuse it
      let container = titleContainer.querySelector(`.${COMPONENT_CLASSES.PROFILE_STATUS}`) as HTMLElement;
      if (!container) {
        // Create container for status indicator
        container = this.createComponentContainer(COMPONENT_CLASSES.PROFILE_STATUS);
        container.style.display = 'inline-flex';
        container.style.alignItems = 'center';
        container.style.verticalAlign = 'middle';
        container.style.lineHeight = 'normal';

        // Append directly to title container
        titleContainer.appendChild(container);
      }

      // Mount StatusIndicator
      if (this.userId) {
        const currentSettings = get(settings);
        const showTooltips = currentSettings[SETTINGS_KEYS.PROFILE_TOOLTIPS_ENABLED];
        
        // Clear container content before mounting to prevent duplicates
        container.innerHTML = '';
        
        this.statusIndicator = this.mountComponent(
          StatusIndicator,
          container,
          {
            userId: this.userId,
            status: this.userStatus,
            loading: !this.userStatus,
            showTooltips,
            onClick: this.handleStatusClick.bind(this),
            onQueue: this.handleQueueUser.bind(this),
            onVote: this.handleVote.bind(this)
          }
        );
      }

      logger.debug('Status indicator mounted', { 
        hasStatus: !!this.userStatus,
        loading: !this.userStatus 
      });

    } catch (error) {
      this.handleError(error, 'mountStatusIndicator');
    }
  }

  // Mount friend warning if this looks like a friend request page
  private async mountFriendWarning(): Promise<void> {
    try {
      const friendButton = this.findElement('#friend-button');

      if (!friendButton || !this.userStatus) return;

      // Only show warning for potentially unsafe users
      if (this.userStatus.flagType === 0) return; // Don't show for safe users

      // Create hidden container for the modal
      const container = this.createComponentContainer(COMPONENT_CLASSES.FRIEND_WARNING);
      container.style.display = 'none';
      document.body.appendChild(container);

      if (this.userId) {
        this.friendWarning = this.mountComponent(FriendWarning, container, {
          isOpen: this.friendWarningOpen,
          userId: this.userId,
          status: this.userStatus,
          onProceed: this.handleFriendProceed.bind(this),
          onCancel: this.handleFriendCancel.bind(this),
          onBlock: this.handleFriendBlock.bind(this)
        });
      }

      // Set up click interception
      this.setupFriendButtonInterception(friendButton);

      logger.debug('Friend warning mounted and interception set up');
    } catch (error) {
      this.handleError(error, 'mountFriendWarning');
    }
  }

  // Set up friend button click interception
  private setupFriendButtonInterception(friendButton: Element): void {
    const clickHandler = (event: Event) => {
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
      this.setFriendWarningVisible(true);
    };

    // Add click listener with capture to intercept before other handlers
    friendButton.addEventListener('click', clickHandler, true);

    // Store the handler so we can remove it during cleanup
    (friendButton as HTMLElement & { __rotectorClickHandler?: EventListener }).__rotectorClickHandler = clickHandler;
  }

  // Set friend warning visibility and manage component state
  private setFriendWarningVisible(visible: boolean): void {
    this.friendWarningOpen = visible;
    
    if (!this.friendWarning || !this.userId) return;

    this.friendWarning = this.updateModalVisibility(
      this.friendWarning,
      FriendWarning,
      visible,
      {
        userId: this.userId,
        status: this.userStatus,
        onProceed: this.handleFriendProceed.bind(this),
        onCancel: this.handleFriendCancel.bind(this),
        onBlock: this.handleFriendBlock.bind(this)
      }
    );
  }

  // Set queue popup visibility and manage component state
  private setQueuePopupVisible(visible: boolean): void {
    if (!this.queuePopup || !this.userId) return;

    this.queuePopup = this.updateModalVisibility(
      this.queuePopup,
      QueuePopup,
      visible,
      {
        userId: this.userId,
        onConfirm: this.handleConfirmQueue.bind(this),
        onCancel: this.handleCancelQueue.bind(this)
      }
    );
  }

  // Generic method to set up modal components
  private setupModal(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    componentClass: any,
    containerClass: ComponentClassType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    props: Record<string, any>,
    debugName: string
  ): { element: HTMLElement; cleanup: () => void } | null {
    try {
      // Create container for modal
      const container = this.createComponentContainer(containerClass);
      container.style.display = 'none';
      document.body.appendChild(container);

      // Mount component
      if (this.userId) {
        const component = this.mountComponent(
          componentClass,
          container,
          {
            isOpen: false,
            userId: this.userId,
            ...props
          }
        );

        logger.debug(`${debugName} set up`);
        return component;
      }

      return null;
    } catch (error) {
      this.handleError(error, `setup${debugName}`);
      return null;
    }
  }

  // Set up queue popup modal
  private setupQueuePopup(): void {
    this.queuePopup = this.setupModal(
      QueuePopup,
      COMPONENT_CLASSES.QUEUE_MODAL,
      {
        username: null,
        onConfirm: this.handleConfirmQueue.bind(this),
        onCancel: this.handleCancelQueue.bind(this)
      },
      'Queue popup'
    );
  }

  // Set up report helper modal
  private setupReportHelper(): void {
    this.reportHelper = this.setupModal(
      ReportHelper,
      COMPONENT_CLASSES.REPORT_HELPER,
      {
        status: this.userStatus,
        onClose: this.handleReportClose.bind(this)
      },
      'Report helper'
    );
  }

  // Mount carousel manager for friends carousel on profile page
  private async mountCarouselManager(): Promise<void> {
    try {
      const containerSelector = FRIENDS_CAROUSEL_SELECTORS.CONTAINER;
      
      // Wait for carousel container
      const result = await waitForElement(containerSelector, {
        onTimeout: () => {
          logger.debug('Carousel search timed out - carousel may not exist on this profile');
        }
      });

      if (!result.success) {
        logger.debug('No friends carousel found on profile page');
        return;
      }

      // Mount carousel manager
      const currentSettings = get(settings);
      const showTooltips = currentSettings[SETTINGS_KEYS.PROFILE_TOOLTIPS_ENABLED];
      
      this.carouselManager = this.mountUserListManager(
        containerSelector,
        COMPONENT_CLASSES.FRIENDS_MANAGER,
        PAGE_TYPES.FRIENDS_CAROUSEL,
        showTooltips,
        this.handleCarouselUserProcessed.bind(this),
        this.handleCarouselError.bind(this)
      );

      logger.debug('Profile carousel UserListManager mounted successfully');

    } catch (error) {
      this.handleError(error, 'mountCarouselManager');
    }
  }

  // Handle user processed event from carousel UserListManager
  private handleCarouselUserProcessed(userId: string, status: UserStatus): void {
    logger.debug('Profile carousel user processed', { userId, status: status.flagType });
  }

  // Handle errors from carousel UserListManager
  private handleCarouselError(error: string): void {
    logger.error('Profile carousel UserListManager error:', error);
  }

  // Handle status indicator click
  private handleStatusClick(userId: string): void {
    logger.userAction(USER_ACTIONS.STATUS_CLICKED, { userId });
  }

  // Handle queue user request
  private handleQueueUser(userId: string): void {
    logger.userAction(USER_ACTIONS.QUEUE_REQUESTED, { userId });
    
    // Show queue popup for confirmation
    this.setQueuePopupVisible(true);
  }

  // Handle confirmed queue action
  private async handleConfirmQueue(inappropriateOutfit = false): Promise<void> {
    if (!this.userId) return;

    try {
      logger.userAction(USER_ACTIONS.QUEUE_CONFIRMED, { 
        userId: this.userId, 
        inappropriateOutfit 
      });
      
      await apiClient.queueUser(this.userId, inappropriateOutfit);
      
      // Hide popup
      this.setQueuePopupVisible(false);

      // Refresh user status
      await this.loadUserStatus();

    } catch (error) {
      this.handleError(error, 'handleConfirmQueue');
    }
  }

  // Handle cancel queue
  private handleCancelQueue(): void {
    logger.userAction(USER_ACTIONS.QUEUE_CANCELLED, { userId: this.userId });
    
    this.setQueuePopupVisible(false);
  }

  // Handle vote submission
  private handleVote(userId: string, voteType: number): void {
    logger.userAction(USER_ACTIONS.VOTE_SUBMITTED, { userId, voteType });
  }

  // Handle friend request proceed
  private handleFriendProceed(): void {
    logger.userAction(USER_ACTIONS.FRIEND_PROCEED, { userId: this.userId });
    
    // Find the friend button and simulate click to proceed with friend request
    const friendButton = this.findElement('#friend-button');
    
    if (friendButton) {
      (friendButton as HTMLElement).dataset.skipWarning = 'true';
      (friendButton as HTMLElement).click();
      
      logger.debug('Friend request proceeded - simulated click');
    }

    this.setFriendWarningVisible(false);
  }

  // Handle friend request cancel
  private handleFriendCancel(): void {
    logger.userAction(USER_ACTIONS.FRIEND_CANCEL, { userId: this.userId });
    
    this.setFriendWarningVisible(false);
    
    logger.debug('Friend request cancelled by user');
  }

  // Handle block user action
  private handleFriendBlock(): void {
    logger.userAction(USER_ACTIONS.FRIEND_BLOCK, { userId: this.userId });
    
    try {
      // Find the more options button (three dots)
      const moreButton = this.findElement('.profile-header-dropdown') ||
                         this.findElement('[aria-label="See More"]');
      
      if (moreButton) {
        // Click the more button to open dropdown
        (moreButton as HTMLElement).click();
        
        // Wait for dropdown to appear and find block option
        setTimeout(() => {
          const blockButton = this.findElement('#block-button');
          
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
    this.setFriendWarningVisible(false);
  }

  // Handle report helper close
  private handleReportClose(): void {
    this.setReportHelperVisible(false);
  }

  // Set report helper visibility and manage component state
  private setReportHelperVisible(visible: boolean): void {
    if (!this.reportHelper || !this.userId) return;

    this.reportHelper = this.updateModalVisibility(
      this.reportHelper,
      ReportHelper,
      visible,
      {
        userId: this.userId,
        status: this.userStatus,
        onClose: this.handleReportClose.bind(this)
      }
    );
  }

  // Page cleanup
  protected async cleanupPage(): Promise<void> {
    try {
      // Clean up friend button event listener
      const friendButton = this.findElement('#friend-button');
      
      const typedFriendButton = friendButton as HTMLElement & { __rotectorClickHandler?: EventListener };
      if (friendButton && typedFriendButton.__rotectorClickHandler) {
        friendButton.removeEventListener('click', typedFriendButton.__rotectorClickHandler, true);
        delete typedFriendButton.__rotectorClickHandler;
      }

      // Cleanup all mounted components
      const componentRefs = [
        { ref: 'statusIndicator', component: this.statusIndicator },
        { ref: 'friendWarning', component: this.friendWarning },
        { ref: 'queuePopup', component: this.queuePopup },
        { ref: 'reportHelper', component: this.reportHelper },
        { ref: 'carouselManager', component: this.carouselManager }
      ];

      for (const { ref, component } of componentRefs) {
        if (component) {
          component.cleanup();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (this as any)[ref] = null;
        }
      }

      // Reset state
      this.userId = null;
      this.userStatus = null;
      this.friendWarningOpen = false;

      logger.debug('ProfilePageController cleanup completed');
    } catch (error) {
      this.handleError(error, 'cleanupPage');
    }
  }
} 