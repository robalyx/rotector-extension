import { get } from 'svelte/store';
import { PageController } from './PageController';
import { FRIENDS_CAROUSEL_SELECTORS, COMPONENT_CLASSES, PAGE_TYPES } from '../types/constants';
import { SETTINGS_KEYS } from '../types/settings';
import { settings } from '../stores/settings';
import UserListManager from '../../components/features/UserListManager.svelte';
import type { UserStatus } from '../types/api';
import { logger } from '../utils/logger';

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
      await this.waitForFriendsCarousel();

      // Mount UserListManager component
      await this.mountUserListManager();

      logger.debug('HomePageController initialized successfully');

    } catch (error) {
      this.handleError(error, 'initializePage');
      throw error;
    }
  }

  // Wait for the friends carousel to be available
  private async waitForFriendsCarousel(): Promise<void> {
    const containerSelector = `${FRIENDS_CAROUSEL_SELECTORS.CONTAINER}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Friends carousel not found after timeout: ${containerSelector}`));
      }, 30000);

      const checkForCarousel = () => {
        const container = this.findElement(containerSelector);
        if (container) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkForCarousel, 1000);
        }
      };

      checkForCarousel();
    });
  }

  // Mount the UserListManager component
  private async mountUserListManager(): Promise<void> {
    try {
      const containerSelector = `${FRIENDS_CAROUSEL_SELECTORS.CONTAINER}`;
      const targetContainer = this.findElement(containerSelector);
      
      if (!targetContainer) {
        throw new Error(`Container not found: ${containerSelector}`);
      }

      // Create a wrapper for our component
      const componentContainer = this.createComponentContainer(COMPONENT_CLASSES.HOME_CAROUSEL_MANAGER);
      targetContainer.appendChild(componentContainer);

      // Mount UserListManager for friends carousel
      const currentSettings = get(settings);
      const showTooltips = currentSettings[SETTINGS_KEYS.HOME_TOOLTIPS_ENABLED];
      
      this.userListManager = this.mountComponent(
        UserListManager,
        componentContainer,
        {
          pageType: PAGE_TYPES.FRIENDS_CAROUSEL,
          showTooltips,
          onUserProcessed: this.handleUserProcessed.bind(this),
          onError: this.handleUserListError.bind(this)
        }
      );

      logger.debug('UserListManager mounted successfully for home page carousel');

    } catch (error) {
      this.handleError(error, 'mountUserListManager');
      throw error;
    }
  }

  // Handle user processed event from UserListManager
  private handleUserProcessed(userId: string, status: UserStatus): void {
    logger.debug('Home carousel user processed', { userId, status: status.flagType });
  }

  // Handle errors from UserListManager
  private handleUserListError(error: string): void {
    logger.error('UserListManager error in home page:', error);
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