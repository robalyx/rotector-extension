import { logger } from '@/lib/utils/logging/logger';
import { startTrace } from '@/lib/utils/logging/perf-tracer';
import { TRACE_CATEGORIES } from '@/lib/types/performance';
import { metricsCollector } from '@/lib/utils/logging/metrics-collector';
import { sanitizeEntityId, sanitizeUrl } from '@/lib/utils/dom/sanitizer';
import { detectPageType, stripHash } from '@/lib/utils/dom/page-detection';
import { COMPONENT_CLASSES, PAGE_TYPES } from '@/lib/types/constants';
import { SETTINGS_KEYS } from '@/lib/types/settings';
import type { PageType } from '@/lib/types/api';
import type { PageController } from './PageController';
import { SimplePageController } from './SimplePageController';
import { ProfilePageController } from './ProfilePageController';
import { GroupsPageController } from './GroupsPageController';
import { ReportPageController } from './ReportPageController';
import HomePageManager from '@/components/features/home/HomePageManager.svelte';
import FriendsPageManager from '@/components/features/friends/FriendsPageManager.svelte';
import SearchPageManager from '@/components/features/search/SearchPageManager.svelte';
import GroupConfigurePageManager from '@/components/features/groups/GroupConfigurePageManager.svelte';

export class PageControllerManager {
	private currentController: PageController | null = null;
	private readonly controllers = new Map<
		PageType,
		(pageType: PageType, url: string) => PageController
	>();
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
					getProps: () => ({})
				})
		);
		this.controllers.set(
			PAGE_TYPES.FRIENDS_LIST,
			(pt, url) =>
				new SimplePageController(pt, url, {
					settingsKey: SETTINGS_KEYS.FRIENDS_CHECK_ENABLED,
					component: FriendsPageManager,
					containerClass: COMPONENT_CLASSES.FRIENDS_MANAGER,
					getProps: () => ({})
				})
		);
		this.controllers.set(
			PAGE_TYPES.FRIENDS_CAROUSEL,
			(pt, url) =>
				new SimplePageController(pt, url, {
					settingsKey: SETTINGS_KEYS.FRIENDS_CHECK_ENABLED,
					component: FriendsPageManager,
					containerClass: COMPONENT_CLASSES.FRIENDS_MANAGER,
					getProps: () => ({})
				})
		);
		this.controllers.set(
			PAGE_TYPES.SEARCH_USER,
			(pt, url) =>
				new SimplePageController(pt, url, {
					settingsKey: SETTINGS_KEYS.SEARCH_CHECK_ENABLED,
					component: SearchPageManager,
					containerClass: COMPONENT_CLASSES.SEARCH_MANAGER,
					getProps: () => ({})
				})
		);
		this.controllers.set(
			PAGE_TYPES.GROUP_CONFIGURE_MEMBERS,
			(pt, url) =>
				new SimplePageController(pt, url, {
					settingsKey: SETTINGS_KEYS.GROUPS_CHECK_ENABLED,
					component: GroupConfigurePageManager,
					containerClass: COMPONENT_CLASSES.GROUP_CONFIGURE_MANAGER,
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

			const pageType = detectPageType(sanitizedUrl);

			if (pageType && this.controllers.has(pageType)) {
				await this.switchToController(pageType, sanitizedUrl);
			} else {
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

	private async switchToController(pageType: PageType, url: string): Promise<void> {
		const endTrace = startTrace(TRACE_CATEGORIES.CONTROLLER, 'switchToController', { pageType });
		try {
			if (
				this.currentController &&
				(this.currentController.pageType !== pageType ||
					stripHash(this.currentUrl ?? '') !== stripHash(url))
			) {
				await this.cleanupCurrentController();
			}

			if (!this.currentController) {
				const factory = this.controllers.get(pageType);
				if (!factory) {
					logger.error(`No controller factory found for page type: ${pageType}`);
					return;
				}

				this.currentController = factory(pageType, url);
				this.currentUrl = url;
			}

			await this.currentController.initialize();
		} catch (error) {
			logger.error(`Failed to switch to controller for ${pageType}:`, error);
			await this.cleanupCurrentController();
		} finally {
			endTrace();
		}
	}

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
}
