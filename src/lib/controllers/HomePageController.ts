import { get } from 'svelte/store';
import { PageController } from './PageController';
import { FRIENDS_CAROUSEL_SELECTORS, COMPONENT_CLASSES, PAGE_TYPES } from '../types/constants';
import { SETTINGS_KEYS } from '../types/settings';
import { settings } from '../stores/settings';
import { logger } from '../utils/logger';
import { waitForElement } from '../utils/element-waiter';

/**
 * Handles home page with friends carousel
 */
export class HomePageController extends PageController {
  private userListManager: { element: HTMLElement; cleanup: () => void } | null = null;

  protected async initializePage(): Promise<void> {
    try {
      logger.debug('Initializing HomePageController', { 
        pageType: this.pageType,
        url: this.url 
      });

      // Check if home checks are enabled
      const currentSettings = get(settings);
      if (!currentSettings[SETTINGS_KEYS.HOME_CHECK_ENABLED]) {
        logger.debug('Home checks disabled, skipping HomePageController initialization');
        return;
      }

      // Wait for friends carousel to load
      const result = await waitForElement(FRIENDS_CAROUSEL_SELECTORS.CONTAINER, {
        timeout: 30000,
        onTimeout: () => {
          logger.debug('Friends carousel timeout');
        }
      });

      if (!result.success) {
        throw new Error(`Friends carousel not found after timeout: ${FRIENDS_CAROUSEL_SELECTORS.CONTAINER}`);
      }

      // Mount UserListManager component
      await this.mountHomeUserListManager();

      logger.debug('HomePageController initialized successfully');

    } catch (error) {
      this.handleError(error, 'initializePage');
      throw error;
    }
  }

  // Mount the UserListManager component
  private async mountHomeUserListManager(): Promise<void> {
    const currentSettings = get(settings);
    const showTooltips = currentSettings[SETTINGS_KEYS.HOME_TOOLTIPS_ENABLED];
    
    this.userListManager = this.mountUserListManager(
      FRIENDS_CAROUSEL_SELECTORS.CONTAINER,
      COMPONENT_CLASSES.HOME_CAROUSEL_MANAGER,
      PAGE_TYPES.FRIENDS_CAROUSEL,
      showTooltips
    );
  }

  // Page cleanup
  protected async cleanupPage(): Promise<void> {
    try {
      if (this.userListManager) {
        this.userListManager.cleanup();
        this.userListManager = null;
      }

      logger.debug('HomePageController cleanup completed');
    } catch (error) {
      this.handleError(error, 'cleanupPage');
    }
  }
} 