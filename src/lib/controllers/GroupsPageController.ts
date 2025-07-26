import { get } from 'svelte/store';
import { PageController } from './PageController';
import { GROUPS_SELECTORS, COMPONENT_CLASSES } from '../types/constants';
import { SETTINGS_KEYS } from '../types/settings';
import { settings } from '../stores/settings';
import { logger } from '../utils/logger';
import { waitForElement } from '../utils/element-waiter';

/**
 * Handles group pages with member lists
 */
export class GroupsPageController extends PageController {
  private userListManager: { element: HTMLElement; cleanup: () => void } | null = null;

  protected async initializePage(): Promise<void> {
    try {
      logger.debug('Initializing GroupsPageController', { 
        pageType: this.pageType,
        url: this.url 
      });

      // Check if groups checks are enabled
      const currentSettings = get(settings);
      if (!currentSettings[SETTINGS_KEYS.GROUPS_CHECK_ENABLED]) {
        logger.debug('Groups checks disabled, skipping GroupsPageController initialization');
        return;
      }

      // Wait for group container to load
      const result = await waitForElement(GROUPS_SELECTORS.CONTAINER, {
        timeout: 20000,
        onTimeout: () => {
          logger.debug('Groups container timeout');
        }
      });

      if (!result.success) {
        throw new Error(`Group container not found after timeout: ${GROUPS_SELECTORS.CONTAINER}`);
      }

      // Mount UserListManager component
      await this.mountGroupUserListManager();

      logger.debug('GroupsPageController initialized successfully');

    } catch (error) {
      this.handleError(error, 'initializePage');
      throw error;
    }
  }

  // Mount the UserListManager component
  private async mountGroupUserListManager(): Promise<void> {
    const currentSettings = get(settings);
    const showTooltips = currentSettings[SETTINGS_KEYS.GROUPS_TOOLTIPS_ENABLED];
    
    this.userListManager = this.mountUserListManager(
      GROUPS_SELECTORS.CONTAINER,
      COMPONENT_CLASSES.GROUPS_MANAGER,
      this.pageType,
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

      logger.debug('GroupsPageController cleanup completed');
    } catch (error) {
      this.handleError(error, 'cleanupPage');
    }
  }
} 