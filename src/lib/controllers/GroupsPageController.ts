import { get } from 'svelte/store';
import { PageController } from './PageController';
import { GROUPS_SELECTORS, COMPONENT_CLASSES } from '../types/constants';
import { SETTINGS_KEYS } from '../types/settings';
import { settings } from '../stores/settings';
import UserListManager from '../../components/features/UserListManager.svelte';
import type { UserStatus } from '../types/api';
import { logger } from '../utils/logger';

/**
 * Handles group pages with member lists
 */
export class GroupsPageController extends PageController {

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
      await this.waitForGroupContainer();

      // Mount UserListManager component
      await this.mountUserListManager();

      logger.debug('GroupsPageController initialized successfully');

    } catch (error) {
      this.handleError(error, 'initializePage');
      throw error;
    }
  }

  // Wait for the group container to be available
  private async waitForGroupContainer(): Promise<void> {
    const containerSelector = `${GROUPS_SELECTORS.CONTAINER}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Group container not found after timeout: ${containerSelector}`));
      }, 20000);

      const checkForContainer = () => {
        const container = this.findElement(containerSelector);
        if (container) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkForContainer, 500);
        }
      };

      checkForContainer();
    });
  }

  // Mount the UserListManager component
  private async mountUserListManager(): Promise<void> {
    try {
      const containerSelector = `${GROUPS_SELECTORS.CONTAINER}`;
      const targetContainer = this.findElement(containerSelector);
      
      if (!targetContainer) {
        throw new Error(`Container not found: ${containerSelector}`);
      }

      // Create a wrapper for our component
      const componentContainer = this.createComponentContainer(COMPONENT_CLASSES.GROUPS_MANAGER);
      targetContainer.appendChild(componentContainer);

      // Mount UserListManager
      const currentSettings = get(settings);
      const showTooltips = currentSettings[SETTINGS_KEYS.GROUPS_TOOLTIPS_ENABLED];
      
      this.mountComponent(
        UserListManager,
        componentContainer,
        {
          pageType: this.pageType,
          showTooltips,
          onUserProcessed: this.handleUserProcessed.bind(this),
          onError: this.handleUserListError.bind(this)
        }
      );

      logger.debug('UserListManager mounted successfully for groups page');

    } catch (error) {
      this.handleError(error, 'mountUserListManager');
      throw error;
    }
  }

  // Handle user processed event from UserListManager
  private handleUserProcessed(userId: string, status: UserStatus): void {
    logger.debug('Group member processed', { userId, status: status.flagType });
  }

  // Handle errors from UserListManager
  private handleUserListError(error: string): void {
    logger.error('UserListManager error in groups page:', error);
  }

  // Page cleanup
  protected async cleanupPage(): Promise<void> {
    try {
      logger.debug('GroupsPageController cleanup completed');
    } catch (error) {
      this.handleError(error, 'cleanupPage');
    }
  }
} 