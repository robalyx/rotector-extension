import { get } from 'svelte/store';
import { PageController } from './PageController';
import { COMPONENT_CLASSES } from '../types/constants';
import { SETTINGS_KEYS } from '../types/settings';
import { settings } from '../stores/settings';
import { logger } from '../utils/logger';
import FriendsPageManager from '../../components/features/FriendsPageManager.svelte';

/**
 * Handles friends list and friends carousel pages
 */
export class FriendsPageController extends PageController {
	private friendsPageManager: { element: HTMLElement; cleanup: () => void } | null = null;

	protected override async initializePage(): Promise<void> {
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

			// Mount friends page manager
			this.mountFriendsPageManager();

			logger.debug('FriendsPageController initialized successfully');
		} catch (error) {
			this.handleError(error, 'initializePage');
			throw error;
		}
	}

	// Page cleanup
	protected override async cleanupPage(): Promise<void> {
		try {
			if (this.friendsPageManager) {
				this.friendsPageManager.cleanup();
				this.friendsPageManager = null;
			}

			logger.debug('FriendsPageController cleanup completed');
		} catch (error) {
			this.handleError(error, 'cleanupPage');
			throw error;
		}
	}

	// Mount friends page manager
	private mountFriendsPageManager(): void {
		try {
			// Create container for friends page manager
			const container = this.createComponentContainer(COMPONENT_CLASSES.FRIENDS_MANAGER);

			// Mount FriendsPageManager
			this.friendsPageManager = this.mountComponent(FriendsPageManager, container, {});

			logger.debug('FriendsPageManager mounted successfully');
		} catch (error) {
			this.handleError(error, 'mountFriendsPageManager');
		}
	}
}
