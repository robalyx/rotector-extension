import { get } from 'svelte/store';
import { PageController } from './PageController';
import { COMPONENT_CLASSES, GROUP_HEADER_SELECTORS } from '../types/constants';
import { SETTINGS_KEYS } from '../types/settings';
import { settings } from '../stores/settings';
import { logger } from '../utils/logger';
import { sanitizeEntityId } from '../utils/sanitizer';
import { waitForElement } from '../utils/element-waiter';
import GroupPageManager from '../../components/features/GroupPageManager.svelte';

/**
 * Handles group pages with member lists
 */
export class GroupsPageController extends PageController {
	private groupPageManager: { element: HTMLElement; cleanup: () => void } | null = null;
	private groupId: string | null = null;

	protected override async initializePage(): Promise<void> {
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

			// Extract group ID from URL
			this.groupId = this.extractGroupIdFromUrl();

			// Wait for group elements if we have a group ID
			if (this.groupId) {
				logger.debug('Group ID extracted', { groupId: this.groupId });
				await this.waitForGroupElements();
			} else {
				logger.debug('No group ID found in URL, proceeding with groups page manager only');
			}

			// Mount group page manager
			this.mountGroupPageManager();

			logger.debug('GroupsPageController initialized successfully');
		} catch (error) {
			this.handleError(error, 'initializePage');
			throw error;
		}
	}

	// Page cleanup
	protected override async cleanupPage(): Promise<void> {
		try {
			if (this.groupPageManager) {
				this.groupPageManager.cleanup();
				this.groupPageManager = null;
			}

			this.groupId = null;

			logger.debug('GroupsPageController cleanup completed');
		} catch (error) {
			this.handleError(error, 'cleanupPage');
			throw error;
		}
	}

	// Mount unified group page manager
	private mountGroupPageManager(): void {
		try {
			// Create container for group page manager
			const container = this.createComponentContainer(COMPONENT_CLASSES.GROUPS_MANAGER);

			// Mount GroupPageManager
			this.groupPageManager = this.mountComponent(GroupPageManager, container, {
				groupId: this.groupId,
				pageType: this.pageType
			});

			logger.debug('GroupPageManager mounted successfully');
		} catch (error) {
			this.handleError(error, 'mountGroupPageManager');
			throw error;
		}
	}

	// Extract group ID from the current URL
	private extractGroupIdFromUrl(): string | null {
		try {
			const match = /\/(groups|communities)\/(\d+)/.exec(this.url);
			if (match && match.length > 2 && match[2]) {
				return sanitizeEntityId(match[2]) ?? null;
			}
			return null;
		} catch (error) {
			logger.error('Failed to extract group ID from URL:', error);
			return null;
		}
	}

	// Wait for group elements to be available
	private async waitForGroupElements(): Promise<void> {
		const result = await waitForElement(GROUP_HEADER_SELECTORS.HEADER_INFO);

		if (!result.success) {
			logger.warn('Group header element not found after timeout');
		}
	}
}
