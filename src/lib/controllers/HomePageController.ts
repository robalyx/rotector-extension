import {get} from 'svelte/store';
import {PageController} from './PageController';
import {COMPONENT_CLASSES} from '../types/constants';
import {SETTINGS_KEYS} from '../types/settings';
import {settings} from '../stores/settings';
import {logger} from '../utils/logger';
import HomePageManager from '../../components/features/HomePageManager.svelte';

/**
 * Handles home page with friends carousel
 */
export class HomePageController extends PageController {
    private homePageManager: { element: HTMLElement; cleanup: () => void } | null = null;

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

            // Mount home page manager
            await this.mountHomePageManager();

            logger.debug('HomePageController initialized successfully');

        } catch (error) {
            this.handleError(error, 'initializePage');
            throw error;
        }
    }

    // Page cleanup
    protected async cleanupPage(): Promise<void> {
        try {
            if (this.homePageManager) {
                this.homePageManager.cleanup();
                this.homePageManager = null;
            }

            logger.debug('HomePageController cleanup completed');
        } catch (error) {
            this.handleError(error, 'cleanupPage');
        }
    }

    // Mount home page manager
    private async mountHomePageManager(): Promise<void> {
        try {
            // Create container for home page manager
            const container = this.createComponentContainer(COMPONENT_CLASSES.HOME_CAROUSEL_MANAGER);

            // Mount HomePageManager
            this.homePageManager = this.mountComponent(
                HomePageManager,
                container,
                {}
            );

            logger.debug('HomePageManager mounted successfully');

        } catch (error) {
            this.handleError(error, 'mountHomePageManager');
        }
    }
} 