import { get } from 'svelte/store';
import { PageController } from './PageController';
import { COMPONENT_CLASSES, GROUP_HEADER_SELECTORS } from '../types/constants';
import { SETTINGS_KEYS } from '../types/settings';
import { settings } from '../stores/settings';
import { logger } from '../utils/logger';
import { sanitizeEntityId } from '../utils/sanitizer';
import { waitForElement } from '../utils/element-waiter';
import { startGroupQuery, type GroupQuerySubscription } from '../utils/group-query';
import GroupPageManager from '../../components/features/GroupPageManager.svelte';

/**
 * Handles group pages with member lists
 */
export class GroupsPageController extends PageController {
	private groupId: string | null = null;
	private querySubscription: GroupQuerySubscription | null = null;

	protected override async initializePage(): Promise<void> {
		// Check if groups checks are enabled
		const currentSettings = get(settings);
		if (!currentSettings[SETTINGS_KEYS.GROUPS_CHECK_ENABLED]) {
			logger.debug('Groups checks disabled, skipping GroupsPageController initialization');
			return;
		}

		// Extract group ID from URL
		this.groupId = this.extractGroupIdFromUrl();

		// Start API query
		if (this.groupId) {
			this.querySubscription = startGroupQuery(this.groupId);
			await this.waitForGroupElements();
		}

		// Mount group page manager
		this.mountGroupPageManager();
	}

	// Page cleanup
	protected override async cleanupPage(): Promise<void> {
		if (this.querySubscription) {
			this.querySubscription.cancel();
			this.querySubscription = null;
		}

		this.groupId = null;
	}

	// Mount unified group page manager
	private mountGroupPageManager(): void {
		const container = this.createComponentContainer(COMPONENT_CLASSES.GROUPS_MANAGER);

		this.mountComponent(GroupPageManager, container, {
			groupId: this.groupId,
			pageType: this.pageType,
			querySubscription: this.querySubscription
		});
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
