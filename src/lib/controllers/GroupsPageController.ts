import { get } from 'svelte/store';
import { PageController } from './PageController';
import { COMPONENT_CLASSES } from '../types/constants';
import { SETTINGS_KEYS } from '../types/settings';
import { settings } from '../stores/settings';
import { logger } from '../utils/logger';
import GroupsPageManager from '../../components/features/GroupsPageManager.svelte';

/**
 * Handles group pages with member lists
 */
export class GroupsPageController extends PageController {
  private groupsPageManager: { element: HTMLElement; cleanup: () => void } | null = null;

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

      // Mount groups page manager
      await this.mountGroupsPageManager();

      logger.debug('GroupsPageController initialized successfully');

    } catch (error) {
      this.handleError(error, 'initializePage');
      throw error;
    }
  }

  // Mount groups page manager
  private async mountGroupsPageManager(): Promise<void> {
    try {
      // Create container for groups page manager
      const container = this.createComponentContainer(COMPONENT_CLASSES.GROUPS_MANAGER);

      // Mount GroupsPageManager
      this.groupsPageManager = this.mountComponent(
        GroupsPageManager,
        container,
        {
          pageType: this.pageType
        }
      );

      logger.debug('GroupsPageManager mounted successfully');

    } catch (error) {
      this.handleError(error, 'mountGroupsPageManager');
    }
  }

  // Page cleanup
  protected async cleanupPage(): Promise<void> {
    try {
      if (this.groupsPageManager) {
        this.groupsPageManager.cleanup();
        this.groupsPageManager = null;
      }

      logger.debug('GroupsPageController cleanup completed');
    } catch (error) {
      this.handleError(error, 'cleanupPage');
    }
  }
} 