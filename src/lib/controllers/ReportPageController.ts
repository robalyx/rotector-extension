import { PageController } from './PageController';
import { COMPONENT_CLASSES } from '@/lib/types/constants';
import { SETTINGS_KEYS } from '@/lib/types/settings';
import { userStatusService } from '@/lib/services/rotector/entity-status';
import { sanitizeEntityId } from '@/lib/utils/dom/sanitizer';
import ReportPageManager from '@/components/features/report/ReportPageManager.svelte';
import type { UserStatus } from '@/lib/types/api';
import { logger } from '@/lib/utils/logging/logger';

export class ReportPageController extends PageController {
	protected override readonly settingsKey = SETTINGS_KEYS.REPORT_HELPER_ENABLED;

	protected override async initializePage(): Promise<void> {
		const userId = this.extractUserId();
		if (!userId) {
			logger.warn('Could not extract user ID from report page');
			return;
		}

		let userStatus: UserStatus | null = null;
		try {
			logger.debug('Loading user status for report page', { userId });
			userStatus = await userStatusService.getStatus(userId);
		} catch (error) {
			logger.error('Failed to load user status for report page:', error);
		}

		if (!userStatus) {
			logger.debug('Missing userStatus, not mounting ReportPageManager');
			return;
		}

		const container = this.createComponentContainer(COMPONENT_CLASSES.REPORT_HELPER);
		this.mountComponent(ReportPageManager, container, { userId, userStatus });
	}

	private extractUserId(): string | null {
		try {
			const urlParams = new URLSearchParams(window.location.search);
			const sources = [
				{ source: 'targetId URL parameter', getValue: () => urlParams.get('targetId') },
				{ source: 'id URL parameter', getValue: () => urlParams.get('id') },
				{
					source: 'form field',
					getValue: () => document.querySelector<HTMLInputElement>('#Id')?.value
				}
			];

			for (const { source, getValue } of sources) {
				const value = getValue();
				if (value) {
					const sanitized = sanitizeEntityId(value);
					if (sanitized) {
						logger.debug(`User ID extracted from ${source}`, { userId: sanitized });
						return sanitized;
					}
				}
			}

			return null;
		} catch (error) {
			logger.error('Failed to extract user ID from report page:', error);
			return null;
		}
	}
}
