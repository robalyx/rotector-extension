import { logger } from '../utils/logger';
import { startTrace, TRACE_CATEGORIES } from '../utils/perf-tracer';
import { metricsCollector } from '../utils/metrics-collector';
import { sanitizeEntityId, sanitizeUrl } from '../utils/sanitizer';
import { normalizePathname } from '../utils/page-detection';
import { COMPONENT_CLASSES, PAGE_TYPES } from '../types/constants';
import { SETTINGS_KEYS } from '../types/settings';
import type { PageType } from '../types/api';
import type { PageController } from './PageController';
import { SimplePageController } from './SimplePageController';
import { ProfilePageController } from './ProfilePageController';
import { GroupsPageController } from './GroupsPageController';
import { ReportPageController } from './ReportPageController';
import HomePageManager from '../../components/features/HomePageManager.svelte';
import FriendsPageManager from '../../components/features/FriendsPageManager.svelte';
import SearchPageManager from '../../components/features/SearchPageManager.svelte';
import GroupConfigurePageManager from '../../components/features/GroupConfigurePageManager.svelte';

/**
 * Manages page controllers and handles navigation between different Roblox pages
 */
export class PageControllerManager {
	private currentController: PageController | null = null;
	private readonly controllers = new Map<
		PageType,
		(pageType: PageType, url: string) => PageController
	>();
	private isInitialized = false;
	private currentUrl: string | null = null;
	private isNavigating = false;

	constructor() {
		this.controllers.set(
			PAGE_TYPES.HOME,
			(pt, url) =>
				new SimplePageController(pt, url, {
					settingsKey: SETTINGS_KEYS.HOME_CHECK_ENABLED,
					component: HomePageManager,
					containerClass: COMPONENT_CLASSES.HOME_CAROUSEL_MANAGER,
					disabledMessage: 'Home checks disabled, skipping initialization'
				})
		);
		this.controllers.set(
			PAGE_TYPES.FRIENDS_LIST,
			(pt, url) =>
				new SimplePageController(pt, url, {
					settingsKey: SETTINGS_KEYS.FRIENDS_CHECK_ENABLED,
					component: FriendsPageManager,
					containerClass: COMPONENT_CLASSES.FRIENDS_MANAGER,
					disabledMessage: 'Friends checks disabled, skipping initialization'
				})
		);
		this.controllers.set(
			PAGE_TYPES.FRIENDS_CAROUSEL,
			(pt, url) =>
				new SimplePageController(pt, url, {
					settingsKey: SETTINGS_KEYS.FRIENDS_CHECK_ENABLED,
					component: FriendsPageManager,
					containerClass: COMPONENT_CLASSES.FRIENDS_MANAGER,
					disabledMessage: 'Friends checks disabled, skipping initialization'
				})
		);
		this.controllers.set(
			PAGE_TYPES.SEARCH_USER,
			(pt, url) =>
				new SimplePageController(pt, url, {
					settingsKey: SETTINGS_KEYS.SEARCH_CHECK_ENABLED,
					component: SearchPageManager,
					containerClass: COMPONENT_CLASSES.SEARCH_MANAGER,
					disabledMessage: 'Search checks disabled, skipping initialization'
				})
		);
		this.controllers.set(
			PAGE_TYPES.GROUP_CONFIGURE_MEMBERS,
			(pt, url) =>
				new SimplePageController(pt, url, {
					settingsKey: SETTINGS_KEYS.GROUPS_CHECK_ENABLED,
					component: GroupConfigurePageManager,
					containerClass: COMPONENT_CLASSES.GROUP_CONFIGURE_MANAGER,
					disabledMessage: 'Groups checks disabled, skipping initialization',
					getProps: () => {
						const params = new URLSearchParams(window.location.search);
						const id = params.get('id');
						return { groupId: id ? (sanitizeEntityId(id) ?? null) : null };
					}
				})
		);

		this.controllers.set(PAGE_TYPES.PROFILE, (pt, url) => new ProfilePageController(pt, url));
		this.controllers.set(PAGE_TYPES.MEMBERS, (pt, url) => new GroupsPageController(pt, url));
		this.controllers.set(PAGE_TYPES.REPORT, (pt, url) => new ReportPageController(pt, url));
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
		if (this.isNavigating) {
			logger.debug('Navigation already in progress, skipping');
			return;
		}

		this.isNavigating = true;
		const endTrace = startTrace(TRACE_CATEGORIES.CONTROLLER, 'handleNavigation', { url });
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
		} finally {
			endTrace();
			this.isNavigating = false;
			metricsCollector.takeSnapshot('navigation');
		}
	}

	// Switch to a specific page controller
	private async switchToController(pageType: PageType, url: string): Promise<void> {
		const endTrace = startTrace(TRACE_CATEGORIES.CONTROLLER, 'switchToController', { pageType });
		try {
			// Clean up current controller if page type is different or URL changed
			if (
				this.currentController &&
				(this.currentController.pageType !== pageType ||
					this.stripHash(this.currentUrl ?? '') !== this.stripHash(url))
			) {
				await this.cleanupCurrentController();
			}

			// Create new controller if needed
			if (!this.currentController) {
				const factory = this.controllers.get(pageType);
				if (!factory) {
					logger.error(`No controller factory found for page type: ${pageType}`);
					return;
				}

				this.currentController = factory(pageType, url);
				this.currentUrl = url;
			}

			// Initialize controller
			if (this.currentController) {
				await this.currentController.initialize();
			}
		} catch (error) {
			logger.error(`Failed to switch to controller for ${pageType}:`, error);
			await this.cleanupCurrentController();
		} finally {
			endTrace();
		}
	}

	// Clean up the current controller
	private async cleanupCurrentController(): Promise<void> {
		if (this.currentController) {
			try {
				await this.currentController.cleanup();
				logger.debug(`Cleaned up controller for ${this.currentController.pageType}`);
			} catch (error) {
				logger.error('Failed to cleanup current controller:', error);
			} finally {
				this.currentController = null;
				this.currentUrl = null;
			}
		}
	}

	// Strip hash fragment from URL
	private stripHash(url: string): string {
		const hashIndex = url.indexOf('#');
		return hashIndex >= 0 ? url.substring(0, hashIndex) : url;
	}

	// Detect the page type based on URL
	private detectPageType(url: string): PageType | null {
		try {
			const urlObj = new URL(url);
			const pathname = normalizePathname(urlObj.pathname.toLowerCase());

			// URL pattern to page type mapping
			const pagePatterns: Array<{ pattern: RegExp; type: PageType; hash?: string }> = [
				{ pattern: /^\/(?:home)?$/, type: PAGE_TYPES.HOME },
				{
					pattern: /\/users\/(?:\d+\/)?(?:friends|followers|following)/,
					type: PAGE_TYPES.FRIENDS_LIST
				},
				{ pattern: /\/users\/\d+(?:\/profile)?/, type: PAGE_TYPES.PROFILE },
				{ pattern: /\/search\/users/, type: PAGE_TYPES.SEARCH_USER },
				{ pattern: /\/report-abuse\//, type: PAGE_TYPES.REPORT },
				{
					pattern: /^\/communities\/configure$/,
					type: PAGE_TYPES.GROUP_CONFIGURE_MEMBERS,
					hash: '#!/members'
				},
				{ pattern: /\/(groups|communities)\/\d+/, type: PAGE_TYPES.MEMBERS }
			];

			for (const { pattern, type, hash } of pagePatterns) {
				if (pattern.test(pathname) && (!hash || urlObj.hash === hash)) {
					return type;
				}
			}

			return null;
		} catch (error) {
			logger.error('Failed to detect page type:', error, { url });
			return null;
		}
	}
}
