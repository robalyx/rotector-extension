import { logger } from '../utils/logger';
import { sanitizeUrl } from '../utils/sanitizer';
import { PAGE_TYPES } from '../types/constants';
import type { PageType } from '../types/api';
import type { PageController } from './PageController';
import { FriendsPageController } from './FriendsPageController';
import { ProfilePageController } from './ProfilePageController';
import { GroupsPageController } from './GroupsPageController';
import { HomePageController } from './HomePageController';
import { ReportPageController } from './ReportPageController';
import { SearchPageController } from './SearchPageController';

/**
 * Manages page controllers and handles navigation between different Roblox pages
 */
export class PageControllerManager {
	private currentController: PageController | null = null;
	private readonly controllers = new Map<
		PageType,
		new (pageType: PageType, url: string) => PageController
	>();
	private isInitialized = false;
	private currentUrl: string | null = null;

	constructor() {
		// Register page controllers
		this.controllers.set(PAGE_TYPES.HOME, HomePageController);
		this.controllers.set(PAGE_TYPES.FRIENDS_LIST, FriendsPageController);
		this.controllers.set(PAGE_TYPES.FRIENDS_CAROUSEL, FriendsPageController);
		this.controllers.set(PAGE_TYPES.PROFILE, ProfilePageController);
		this.controllers.set(PAGE_TYPES.MEMBERS, GroupsPageController);
		this.controllers.set(PAGE_TYPES.REPORT, ReportPageController);
		this.controllers.set(PAGE_TYPES.SEARCH_USER, SearchPageController);
	}

	// Initialize the page controller manager
	initialize(): void {
		if (this.isInitialized) {
			logger.warn('PageControllerManager already initialized');
			return;
		}

		logger.debug('Initializing PageControllerManager');
		this.isInitialized = true;
	}

	// Handle navigation to a new URL
	async handleNavigation(url: string): Promise<void> {
		try {
			const sanitizedUrl = sanitizeUrl(url);
			if (!sanitizedUrl) {
				logger.warn('Invalid URL provided to handleNavigation');
				return;
			}

			const pageType = this.detectPageType(sanitizedUrl);

			// If we have a controller for this page type
			if (pageType && this.controllers.has(pageType)) {
				await this.switchToController(pageType, sanitizedUrl);
			} else {
				// Clean up current controller if no specific controller for this page
				await this.cleanupCurrentController();
			}
		} catch (error) {
			logger.error('Failed to handle navigation:', error, { url });
		}
	}

	// Get the current controller
	getCurrentController(): PageController | null {
		return this.currentController;
	}

	// Get the current page type
	getCurrentPageType(): PageType | null {
		return this.currentController?.getPageType() ?? null;
	}

	// Cleanup all resources
	async destroy(): Promise<void> {
		logger.debug('Destroying PageControllerManager');
		await this.cleanupCurrentController();
		this.controllers.clear();
		this.isInitialized = false;
	}

	// Switch to a specific page controller
	private async switchToController(pageType: PageType, url: string): Promise<void> {
		try {
			// Clean up current controller if page type is different or URL changed
			if (
				this.currentController &&
				(this.currentController.getPageType() !== pageType || this.currentUrl !== url)
			) {
				await this.cleanupCurrentController();
			}

			// Create new controller if needed
			if (!this.currentController) {
				const ControllerClass = this.controllers.get(pageType);
				if (!ControllerClass) {
					logger.error(`No controller class found for page type: ${pageType}`);
					return;
				}

				this.currentController = new ControllerClass(pageType, url);
				this.currentUrl = url;
			}

			// Initialize controller
			if (this.currentController) {
				await this.currentController.initialize();
			}
		} catch (error) {
			logger.error(`Failed to switch to controller for ${pageType}:`, error);
			await this.cleanupCurrentController();
		}
	}

	// Clean up the current controller
	private async cleanupCurrentController(): Promise<void> {
		if (this.currentController) {
			try {
				await this.currentController.cleanup();
				logger.debug(`Cleaned up controller for ${this.currentController.getPageType()}`);
			} catch (error) {
				logger.error('Failed to cleanup current controller:', error);
			} finally {
				this.currentController = null;
				this.currentUrl = null;
			}
		}
	}

	// Detect the page type based on URL
	private detectPageType(url: string): PageType | null {
		try {
			const urlObj = new URL(url);
			const pathname = urlObj.pathname.toLowerCase();

			// URL pattern to page type mapping
			const pagePatterns = [
				{ pattern: /^\/(?:home)?$/, type: PAGE_TYPES.HOME },
				{
					pattern: /\/users\/(?:\d+\/)?(?:friends|followers|following)/,
					type: PAGE_TYPES.FRIENDS_LIST
				},
				{ pattern: /\/users\/\d+(?:\/profile)?/, type: PAGE_TYPES.PROFILE },
				{ pattern: /\/search\/users/, type: PAGE_TYPES.SEARCH_USER },
				{ pattern: /\/report-abuse\//, type: PAGE_TYPES.REPORT }
			];

			// Check standard patterns
			for (const { pattern, type } of pagePatterns) {
				if (pattern.test(pathname)) {
					return type;
				}
			}

			// Special case: Groups/Communities with hash
			if (
				(pathname.includes('/groups') || pathname.includes('/communities')) &&
				urlObj.hash.includes('#!/about')
			) {
				return PAGE_TYPES.MEMBERS;
			}

			return null;
		} catch (error) {
			logger.error('Failed to detect page type:', error, { url });
			return null;
		}
	}
}
