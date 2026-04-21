import '../styles/index.css';
import { mount } from 'svelte';
import { get } from 'svelte/store';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { logger } from '@/lib/utils/logger';
import { PageControllerManager } from '@/lib/controllers/PageControllerManager';
import { registerPortalContainer, themeManager } from '@/lib/utils/theme';
import { initializeSettings, settings } from '@/lib/stores/settings';
import { SETTINGS_KEYS } from '@/lib/types/settings';
import { loadStoredLanguagePreference } from '@/lib/stores/i18n';
import { loadCustomApis } from '@/lib/stores/custom-apis';
import {
	initializeRestrictedAccess,
	setupRestrictedAccessListener
} from '@/lib/stores/restricted-access';
import { injectBlurStyles, injectDefaultBlurStyles } from '@/lib/services/blur-service';
import { metricsCollector } from '@/lib/utils/metrics-collector';
import { setOverlayContainer } from '@/lib/stores/overlay';
import OverlayRoot from '@/components/overlay/OverlayRoot.svelte';

/**
 * Wait for document.body to exist.
 */
async function waitForBody(): Promise<HTMLElement> {
	return new Promise((resolve) => {
		if (document.body) {
			resolve(document.body);
			return;
		}
		const observer = new MutationObserver(() => {
			if (document.body) {
				observer.disconnect();
				resolve(document.body);
			}
		});
		observer.observe(document.documentElement, { childList: true });
	});
}

export default defineContentScript({
	matches: [
		// Standard URLs
		'https://*.roblox.com/users/*/profile*',
		'https://*.roblox.com/users/*/profile/*',
		'https://*.roblox.com/home*',
		'https://*.roblox.com/home/*',
		'https://*.roblox.com/users/*/friends*',
		'https://*.roblox.com/users/*/friends/*',
		'https://*.roblox.com/users/*/followers*',
		'https://*.roblox.com/users/*/followers/*',
		'https://*.roblox.com/users/*/following*',
		'https://*.roblox.com/users/*/following/*',
		'https://*.roblox.com/users/friends*',
		'https://*.roblox.com/users/friends/*',
		'https://*.roblox.com/groups*',
		'https://*.roblox.com/groups/*',
		'https://*.roblox.com/communities*',
		'https://*.roblox.com/communities/*',
		'https://*.roblox.com/search/users*',
		'https://*.roblox.com/search/users/*',
		'https://*.roblox.com/report-abuse*',
		'https://*.roblox.com/report-abuse/*',
		// Internationalized URLs
		'https://*.roblox.com/*/users/*/profile*',
		'https://*.roblox.com/*/users/*/profile/*',
		'https://*.roblox.com/*/home*',
		'https://*.roblox.com/*/home/*',
		'https://*.roblox.com/*/users/*/friends*',
		'https://*.roblox.com/*/users/*/friends/*',
		'https://*.roblox.com/*/users/*/followers*',
		'https://*.roblox.com/*/users/*/followers/*',
		'https://*.roblox.com/*/users/*/following*',
		'https://*.roblox.com/*/users/*/following/*',
		'https://*.roblox.com/*/users/friends*',
		'https://*.roblox.com/*/users/friends/*',
		'https://*.roblox.com/*/groups*',
		'https://*.roblox.com/*/groups/*',
		'https://*.roblox.com/*/communities*',
		'https://*.roblox.com/*/communities/*',
		'https://*.roblox.com/*/search/users*',
		'https://*.roblox.com/*/search/users/*',
		'https://*.roblox.com/*/report-abuse*',
		'https://*.roblox.com/*/report-abuse/*'
	],
	runAt: 'document_start',

	async main(ctx: ContentScriptContext) {
		try {
			injectDefaultBlurStyles();

			logger.info('Rotector content script initializing...');

			logger.debug('Loading stored language preference...');
			await loadStoredLanguagePreference();
			logger.debug('Language preference loaded successfully');

			logger.debug('Initializing settings...');
			await initializeSettings();
			logger.debug('Settings loaded successfully');

			// Inject blur styles based on settings
			injectBlurStyles();
			logger.debug('Blur styles injected');

			logger.debug('Loading custom APIs configuration...');
			await loadCustomApis();
			logger.debug('Custom APIs loaded successfully');

			logger.debug('Initializing access state...');
			await initializeRestrictedAccess();
			setupRestrictedAccessListener();
			logger.debug('Access state initialized');

			// Wait for body to exist before DOM operations
			await waitForBody();

			// Initialize Roblox theme detection
			themeManager.initializeRobloxTheme();

			// Load content script CSS for injection into the shadow root
			const cssUrl = browser.runtime.getURL(
				'/content-scripts/content.css' as Parameters<typeof browser.runtime.getURL>[0]
			);
			const cssResponse = await fetch(cssUrl);
			const rawCss = await cssResponse.text();
			const cssText = rawCss.split(':root').join(':host');

			// Create shadow root for overlay UI
			const ui = await createShadowRootUi(ctx, {
				name: 'rotector-overlay',
				position: 'overlay',
				zIndex: 10000,
				css: cssText,
				onMount(uiContainer, _shadow, shadowHost) {
					setOverlayContainer(uiContainer);
					registerPortalContainer(shadowHost);

					// Register inner html element so [data-theme] CSS selectors
					// match inside the shadow root (bare attribute selectors
					// don't match the shadow host from within shadow CSS)
					const shadowHtml = _shadow.querySelector('html');
					if (shadowHtml) registerPortalContainer(shadowHtml);

					mount(OverlayRoot, { target: uiContainer });
					logger.debug('Shadow root overlay mounted');
					return uiContainer;
				},
				onRemove() {
					logger.debug('Shadow root overlay removed');
				}
			});
			ui.mount();

			// Track initialization state
			let pageManagerInitialized = false;

			function initializePageHandling() {
				if (pageManagerInitialized) return;
				pageManagerInitialized = true;

				// Initialize page controller manager
				const pageManager = new PageControllerManager();
				pageManager.initialize();
				logger.debug('Page controller manager initialized');

				// Start metrics collection in dev mode
				metricsCollector.start();

				// Handle page navigation changes
				let currentUrl = window.location.href;
				const checkForNavigation = () => {
					if (window.location.href !== currentUrl) {
						currentUrl = window.location.href;
						logger.debug('Navigation detected', {
							newUrl: currentUrl,
							pathname: window.location.pathname,
							hash: window.location.hash
						});
						void pageManager.handleNavigation(currentUrl);
					}
				};

				// Listen for browser navigation events
				window.addEventListener('popstate', () => {
					logger.debug('Popstate event detected');
					checkForNavigation();
				});

				window.addEventListener('hashchange', () => {
					logger.debug('Hash change detected', { hash: window.location.hash });
					checkForNavigation();
				});

				// Initial page detection and setup
				void pageManager.handleNavigation(currentUrl);
			}

			// Initialize page handling based on onboarding status
			const currentSettings = get(settings);
			if (currentSettings[SETTINGS_KEYS.ONBOARDING_COMPLETED]) {
				initializePageHandling();
			} else {
				// Subscribe to settings changes to initialize after onboarding completes
				const unsubscribe = settings.subscribe((s) => {
					if (s[SETTINGS_KEYS.ONBOARDING_COMPLETED]) {
						initializePageHandling();
						unsubscribe();
					}
				});
				logger.debug('Waiting for onboarding completion to initialize page controllers');
			}

			// Set up cleanup on page unload
			window.addEventListener('beforeunload', () => {
				logger.debug('Content script cleanup on page unload');
				metricsCollector.stop();
				themeManager.cleanup();
			});

			logger.info('Rotector content script successfully initialized');
		} catch (error) {
			logger.error('Failed to initialize content script:', error);
			themeManager.cleanup();
		}
	}
});
