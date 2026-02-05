import { get } from 'svelte/store';
import { PageController } from './PageController';
import { PROFILE_SELECTORS } from '../types/constants';
import { SETTINGS_KEYS } from '../types/settings';
import { sanitizeEntityId } from '../utils/sanitizer';
import { waitForElement } from '../utils/element-waiter';
import { startProfileQuery, type ProfileQuerySubscription } from '../utils/profile-query';
import { settings } from '../stores/settings';
import ProfilePageManager from '../../components/features/ProfilePageManager.svelte';
import { logger } from '../utils/logger';

/**
 * Handles user profile pages
 */
export class ProfilePageController extends PageController {
	private userId: string | null = null;
	private profilePageManager: { element: HTMLElement; cleanup: () => void } | null = null;
	private querySubscription: ProfileQuerySubscription | null = null;

	protected override async initializePage(): Promise<void> {
		try {
			logger.debug('Initializing ProfilePageController', {
				pageType: this.pageType,
				url: this.url
			});

			// Check if profile checks are enabled
			const currentSettings = get(settings);
			if (!currentSettings[SETTINGS_KEYS.PROFILE_CHECK_ENABLED]) {
				logger.debug('Profile checks disabled, skipping ProfilePageController initialization');
				return;
			}

			// Extract user ID from URL
			this.userId = this.extractUserIdFromUrl();
			if (!this.userId) {
				throw new Error('Could not extract user ID from profile URL');
			}

			logger.debug('Profile user ID extracted', { userId: this.userId });

			// Start API query
			this.querySubscription = startProfileQuery(this.userId);

			// Wait for profile elements to load
			await this.waitForProfileElements();

			// Mount profile page manager
			this.mountProfilePageManager();

			logger.debug('ProfilePageController initialized successfully');
		} catch (error) {
			this.handleError(error, 'initializePage');
			throw error;
		}
	}

	// Page cleanup
	protected override async cleanupPage(): Promise<void> {
		try {
			if (this.profilePageManager) {
				this.profilePageManager.cleanup();
				this.profilePageManager = null;
			}

			if (this.querySubscription) {
				this.querySubscription.cancel();
				this.querySubscription = null;
			}

			this.userId = null;

			logger.debug('ProfilePageController cleanup completed');
		} catch (error) {
			this.handleError(error, 'cleanupPage');
			throw error;
		}
	}

	// Extract user ID from profile URL
	private extractUserIdFromUrl(): string | null {
		try {
			const match = /\/users\/(\d+)/.exec(this.url);
			if (match && match.length > 1 && match[1]) {
				return sanitizeEntityId(match[1]) ?? null;
			}
			return null;
		} catch (error) {
			logger.error('Failed to extract user ID from URL:', error);
			return null;
		}
	}

	// Wait for profile elements to be available
	private async waitForProfileElements(): Promise<void> {
		const result = await waitForElement(PROFILE_SELECTORS.HEADER, {
			baseDelay: 200
		});

		if (!result.success) {
			throw new Error('Profile header element not found');
		}
	}

	// Mount profile page manager to handle all UI components
	private mountProfilePageManager(): void {
		try {
			if (!this.userId || !this.querySubscription) {
				throw new Error('Cannot mount ProfilePageManager without userId and querySubscription');
			}

			const container = this.createComponentContainer();
			container.style.display = 'none';
			document.body.appendChild(container);

			this.profilePageManager = this.mountComponent(ProfilePageManager, container, {
				userId: this.userId,
				querySubscription: this.querySubscription
			});

			logger.debug('ProfilePageManager mounted successfully');
		} catch (error) {
			this.handleError(error, 'mountProfilePageManager');
			throw error;
		}
	}
}
