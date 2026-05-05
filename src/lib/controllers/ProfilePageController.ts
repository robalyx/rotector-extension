import { PageController } from './PageController';
import { COMPONENT_CLASSES } from '@/lib/types/constants';
import { PROFILE_SELECTORS } from '@/lib/controllers/selectors/profile';
import { SETTINGS_KEYS } from '@/lib/types/settings';
import { extractIdFromUrl } from '@/lib/utils/dom/sanitizer';
import { waitForElement } from '@/lib/utils/dom/element-waiter';
import {
	startProfileQuery,
	type ProfileQuerySubscription
} from '@/lib/services/rotector/profile-query';
import ProfilePageManager from '@/components/features/profile/ProfilePageManager.svelte';

export class ProfilePageController extends PageController {
	protected override readonly settingsKey = SETTINGS_KEYS.PROFILE_CHECK_ENABLED;
	private querySubscription: ProfileQuerySubscription | null = null;

	protected override async initializePage(): Promise<void> {
		const userId = extractIdFromUrl(this.url, /\/users\/(\d+)/);
		if (!userId) {
			throw new Error('Could not extract user ID from profile URL');
		}

		this.querySubscription = startProfileQuery(userId);

		const result = await waitForElement(PROFILE_SELECTORS.HEADER, { baseDelay: 200 });
		if (!result.success) {
			throw new Error('Profile header element not found');
		}

		const container = this.createComponentContainer(COMPONENT_CLASSES.PROFILE_STATUS);
		container.style.display = 'none';
		document.body.appendChild(container);

		this.mountComponent(ProfilePageManager, container, {
			userId,
			querySubscription: this.querySubscription
		});
	}

	protected override async cleanupPage(): Promise<void> {
		this.querySubscription?.cancel();
	}
}
