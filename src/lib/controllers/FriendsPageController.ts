import { get } from 'svelte/store';
import { PageController } from './PageController';
import { 
  FRIENDS_CAROUSEL_SELECTORS, 
  FRIENDS_SELECTORS,
  PAGE_TYPES,
  COMPONENT_CLASSES
} from '../types/constants';
import { SETTINGS_KEYS } from '../types/settings';
import { settings } from '../stores/settings';
import { logger } from '../utils/logger';
import { waitForElement } from '../utils/element-waiter';

/**
 * Handles friends list and friends carousel pages
 */
export class FriendsPageController extends PageController {
  private friendsListManager: { element: HTMLElement; cleanup: () => void } | null = null;
  private carouselManager: { element: HTMLElement; cleanup: () => void } | null = null;

  protected async initializePage(): Promise<void> {
    try {
      logger.debug('Initializing FriendsPageController', { 
        pageType: this.pageType,
        url: this.url 
      });

      // Check if friends checks are enabled
      const currentSettings = get(settings);
      if (!currentSettings[SETTINGS_KEYS.FRIENDS_CHECK_ENABLED]) {
        logger.debug('Friends checks disabled, skipping FriendsPageController initialization');
        return;
      }

      // Handle friends list page
      if (this.pageType === PAGE_TYPES.FRIENDS_LIST) {
        await this.initializeFriendsListPage();
      } else {
        // Handle carousel page
        await this.initializeCarouselPage();
      }

      logger.debug('FriendsPageController initialized successfully');

    } catch (error) {
      this.handleError(error, 'initializePage');
      throw error;
    }
  }

  // Initialize friends list page with both friends list and carousel sections
  private async initializeFriendsListPage(): Promise<void> {
    const result = await waitForElement(FRIENDS_SELECTORS.CONTAINER, {
      timeout: 30000,
      onTimeout: () => {
        logger.debug('Friends list container timeout');
      }
    });

    if (!result.success) {
      throw new Error('Friends list container not found on friends page');
    }

    await this.mountFriendsListManager();
  }

  // Initialize carousel-only page
  private async initializeCarouselPage(): Promise<void> {
    const result = await waitForElement(FRIENDS_CAROUSEL_SELECTORS.CONTAINER, {
      timeout: 30000,
      onTimeout: () => {
        logger.debug('Friends carousel container timeout');
      }
    });
    
    if (!result.success) {
      throw new Error('Friends carousel container not found');
    }

    await this.mountCarouselManager();
  }

  // Mount the UserListManager component for friends list
  private async mountFriendsListManager(): Promise<void> {
    const currentSettings = get(settings);
    const showTooltips = currentSettings[SETTINGS_KEYS.FRIENDS_TOOLTIPS_ENABLED];
    
    this.friendsListManager = this.mountUserListManager(
      FRIENDS_SELECTORS.CONTAINER,
      COMPONENT_CLASSES.FRIENDS_MANAGER,
      PAGE_TYPES.FRIENDS_LIST,
      showTooltips
    );
  }

  // Mount the UserListManager component for carousel
  private async mountCarouselManager(): Promise<void> {
    const currentSettings = get(settings);
    const showTooltips = currentSettings[SETTINGS_KEYS.FRIENDS_TOOLTIPS_ENABLED];
    
    this.carouselManager = this.mountUserListManager(
      FRIENDS_CAROUSEL_SELECTORS.CONTAINER,
      COMPONENT_CLASSES.FRIENDS_MANAGER,
      PAGE_TYPES.FRIENDS_CAROUSEL,
      showTooltips
    );
  }

  // Page cleanup
  protected async cleanupPage(): Promise<void> {
    try {
      if (this.friendsListManager) {
        this.friendsListManager.cleanup();
        this.friendsListManager = null;
      }

      if (this.carouselManager) {
        this.carouselManager.cleanup();
        this.carouselManager = null;
      }

      logger.debug('FriendsPageController cleanup completed');
    } catch (error) {
      this.handleError(error, 'cleanupPage');
    }
  }
} 