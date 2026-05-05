import { PageController } from './PageController';
import { COMPONENT_CLASSES } from '@/lib/types/constants';
import { GROUP_HEADER_SELECTORS } from '@/lib/controllers/selectors/groups';
import { SETTINGS_KEYS } from '@/lib/types/settings';
import { logger } from '@/lib/utils/logging/logger';
import { extractIdFromUrl } from '@/lib/utils/dom/sanitizer';
import { waitForElement } from '@/lib/utils/dom/element-waiter';
import { startGroupQuery, type GroupQuerySubscription } from '@/lib/services/rotector/group-query';
import GroupPageManager from '@/components/features/groups/GroupPageManager.svelte';

export class GroupsPageController extends PageController {
	protected override readonly settingsKey = SETTINGS_KEYS.GROUPS_CHECK_ENABLED;
	private querySubscription: GroupQuerySubscription | null = null;

	protected override async initializePage(): Promise<void> {
		const groupId = extractIdFromUrl(this.url, /\/(?:groups|communities)\/(\d+)/);

		if (groupId) {
			this.querySubscription = startGroupQuery(groupId);
			const result = await waitForElement(GROUP_HEADER_SELECTORS.HEADER_INFO);
			if (!result.success) {
				logger.warn('Group header element not found after timeout');
			}
		}

		const container = this.createComponentContainer(COMPONENT_CLASSES.GROUPS_MANAGER);
		this.mountComponent(GroupPageManager, container, {
			groupId,
			pageType: this.pageType,
			querySubscription: this.querySubscription
		});
	}

	protected override async cleanupPage(): Promise<void> {
		this.querySubscription?.cancel();
	}
}
