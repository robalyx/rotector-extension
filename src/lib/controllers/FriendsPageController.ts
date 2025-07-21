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
import UserListManager from '../../components/features/UserListManager.svelte';
import type { UserStatus } from '../types/api';
import { logger } from '../utils/logger';

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

      // Determine if this is friends list or carousel
      const isFriendsList = this.pageType === PAGE_TYPES.FRIENDS_LIST;

      if (isFriendsList) {
        // For friends list pages, handle both friends list and carousel sections
        await this.initializeFriendsListPage();
      } else {
        // For carousel-only pages, just handle carousel
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
    const friendsListExists = await this.waitForContainer(FRIENDS_SELECTORS.CONTAINER, 'friends list');

    if (friendsListExists) {
      await this.mountFriendsListManager();
    }

    if (!friendsListExists) {
      throw new Error('Friends list container not found on friends page');
    }
  }

  // Initialize carousel-only page
  private async initializeCarouselPage(): Promise<void> {
    const carouselExists = await this.waitForContainer(`${FRIENDS_CAROUSEL_SELECTORS.CONTAINER}`, 'friends carousel');
    
    if (carouselExists) {
      await this.mountCarouselManager();
    } else {
      throw new Error('Friends carousel container not found');
    }
  }

  // Wait for a specific container to be available
  private async waitForContainer(containerSelector: string, containerName: string, required: boolean = true): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (required) {
          reject(new Error(`${containerName} container not found after timeout: ${containerSelector}`));
        } else {
          logger.debug(`Optional ${containerName} container not found: ${containerSelector}`);
          resolve(false);
        }
      }, 30000);

      const checkForContainer = () => {
        const container = this.findElement(containerSelector);
        if (container) {
          clearTimeout(timeout);
          logger.debug(`Found ${containerName} container: ${containerSelector}`);
          resolve(true);
        } else {
          setTimeout(checkForContainer, 500);
        }
      };

      checkForContainer();
    });
  }

  // Mount the UserListManager component for friends list
  private async mountFriendsListManager(): Promise<void> {
    try {
      const containerSelector = FRIENDS_SELECTORS.CONTAINER;
      const targetContainer = this.findElement(containerSelector);
      
      if (!targetContainer) {
        throw new Error(`Friends list container not found: ${containerSelector}`);
      }

      // Create a wrapper for our component
      const componentContainer = this.createComponentContainer(COMPONENT_CLASSES.FRIENDS_MANAGER);
      targetContainer.appendChild(componentContainer);

      // Mount UserListManager for friends list
      const currentSettings = get(settings);
      const showTooltips = currentSettings[SETTINGS_KEYS.FRIENDS_TOOLTIPS_ENABLED];
      
      this.friendsListManager = this.mountComponent(
        UserListManager,
        componentContainer,
        {
          pageType: PAGE_TYPES.FRIENDS_LIST,
          showTooltips,
          onUserProcessed: this.handleUserProcessed.bind(this),
          onError: this.handleUserListError.bind(this)
        }
      );

      logger.debug('Friends list UserListManager mounted successfully', { 
        container: containerSelector 
      });

    } catch (error) {
      this.handleError(error, 'mountFriendsListManager');
      throw error;
    }
  }

  // Mount the UserListManager component for carousel
  private async mountCarouselManager(): Promise<void> {
    try {
      const containerSelector = `${FRIENDS_CAROUSEL_SELECTORS.CONTAINER}`;
      const targetContainer = this.findElement(containerSelector);
      
      if (!targetContainer) {
        throw new Error(`Friends carousel container not found: ${containerSelector}`);
      }

      // Create a wrapper for our component
      const componentContainer = this.createComponentContainer(COMPONENT_CLASSES.FRIENDS_MANAGER);
      targetContainer.appendChild(componentContainer);

      // Mount UserListManager for carousel
      const currentSettings = get(settings);
      const showTooltips = currentSettings[SETTINGS_KEYS.FRIENDS_TOOLTIPS_ENABLED];
      
      this.carouselManager = this.mountComponent(
        UserListManager,
        componentContainer,
        {
          pageType: PAGE_TYPES.FRIENDS_CAROUSEL,
          showTooltips,
          onUserProcessed: this.handleUserProcessed.bind(this),
          onError: this.handleUserListError.bind(this)
        }
      );

      logger.debug('Friends carousel UserListManager mounted successfully', { 
        container: containerSelector 
      });

    } catch (error) {
      this.handleError(error, 'mountCarouselManager');
      throw error;
    }
  }

  // Handle user processed event from UserListManager
  private handleUserProcessed(userId: string, status: UserStatus): void {
    logger.debug('User processed', { userId, status: status.flagType });
  }

  // Handle errors from UserListManager
  private handleUserListError(error: string): void {
    logger.error('UserListManager error:', error);
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