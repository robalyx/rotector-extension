import { get } from 'svelte/store';
import { PageController } from './PageController';
import { COMPONENT_CLASSES } from '../types/constants';
import { SETTINGS_KEYS } from '../types/settings';
import { settings } from '../stores/settings';
import { logger } from '../utils/logger';
import SearchPageManager from '../../components/features/SearchPageManager.svelte';

/**
 * Handles user search pages
 */
export class SearchPageController extends PageController {
	private searchPageManager: { element: HTMLElement; cleanup: () => void } | null = null;

	protected override async initializePage(): Promise<void> {
		try {
			logger.debug('Initializing SearchPageController', {
				pageType: this.pageType,
				url: this.url
			});

			// Check if search checks are enabled
			const currentSettings = get(settings);
			if (!currentSettings[SETTINGS_KEYS.SEARCH_CHECK_ENABLED]) {
				logger.debug('Search checks disabled, skipping SearchPageController initialization');
				return;
			}

			// Mount search page manager
			this.mountSearchPageManager();

			logger.debug('SearchPageController initialized successfully');
		} catch (error) {
			this.handleError(error, 'initializePage');
			throw error;
		}
	}

	// Page cleanup
	protected override async cleanupPage(): Promise<void> {
		try {
			if (this.searchPageManager) {
				this.searchPageManager.cleanup();
				this.searchPageManager = null;
			}

			logger.debug('SearchPageController cleanup completed');
		} catch (error) {
			this.handleError(error, 'cleanupPage');
			throw error;
		}
	}

	// Mount search page manager
	private mountSearchPageManager(): void {
		try {
			const container = this.createComponentContainer(COMPONENT_CLASSES.SEARCH_MANAGER);

			this.searchPageManager = this.mountComponent(SearchPageManager, container, {});

			logger.debug('SearchPageManager mounted successfully');
		} catch (error) {
			this.handleError(error, 'mountSearchPageManager');
		}
	}
}
