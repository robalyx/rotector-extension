import { get } from 'svelte/store';
import { PageController } from './PageController';
import { COMPONENT_CLASSES } from '../types/constants';
import { SETTINGS_KEYS } from '../types/settings';
import { settings } from '../stores/settings';
import { logger } from '../utils/logger';
import GroupConfigurePageManager from '../../components/features/GroupConfigurePageManager.svelte';

/**
 * Handles group configure members page
 */
export class GroupConfigureController extends PageController {
	private groupConfigurePageManager: { element: HTMLElement; cleanup: () => void } | null = null;

	protected override async initializePage(): Promise<void> {
		try {
			logger.debug('Initializing GroupConfigureController', {
				pageType: this.pageType,
				url: this.url
			});

			// Check if groups checks are enabled
			const currentSettings = get(settings);
			if (!currentSettings[SETTINGS_KEYS.GROUPS_CHECK_ENABLED]) {
				logger.debug('Groups checks disabled, skipping GroupConfigureController initialization');
				return;
			}

			// Verify we're on the members tab
			if (!this.isMembersTab()) {
				logger.debug('Not on members tab, skipping initialization');
				return;
			}

			this.mountGroupConfigurePageManager();
			logger.debug('GroupConfigureController initialized successfully');
		} catch (error) {
			this.handleError(error, 'initializePage');
			throw error;
		}
	}

	protected override async cleanupPage(): Promise<void> {
		try {
			if (this.groupConfigurePageManager) {
				this.groupConfigurePageManager.cleanup();
				this.groupConfigurePageManager = null;
			}
			logger.debug('GroupConfigureController cleanup completed');
		} catch (error) {
			this.handleError(error, 'cleanupPage');
			throw error;
		}
	}

	private isMembersTab(): boolean {
		return window.location.hash === '#!/members';
	}

	private mountGroupConfigurePageManager(): void {
		try {
			const container = this.createComponentContainer(COMPONENT_CLASSES.GROUP_CONFIGURE_MANAGER);
			this.groupConfigurePageManager = this.mountComponent(
				GroupConfigurePageManager,
				container,
				{}
			);
			logger.debug('GroupConfigurePageManager mounted successfully');
		} catch (error) {
			this.handleError(error, 'mountGroupConfigurePageManager');
			throw error;
		}
	}
}
