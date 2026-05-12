import '../styles/index.css';
import shadowCssRaw from '../styles/index.css?inline';
import { mount } from 'svelte';
import { get } from 'svelte/store';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { logger } from '@/lib/utils/logging/logger';
import { PageControllerManager } from '@/lib/controllers/PageControllerManager';
import { themeManager } from '@/lib/utils/theme';
import { initializeSettings } from '@/lib/stores/settings';
import { extensionFeaturesEnabled } from '@/lib/stores/legal';
import { loadStoredLanguagePreference } from '@/lib/stores/i18n';
import { loadCustomApis } from '@/lib/stores/custom-apis';
import {
	initializeRestrictedAccess,
	setupRestrictedAccessListener
} from '@/lib/stores/restricted-access';
import { injectBlurStyles, injectDefaultBlurStyles } from '@/lib/services/blur/service';
import { metricsCollector } from '@/lib/utils/logging/metrics-collector';
import { registerOverlayContainer } from '@/lib/utils/overlay-portal-registry';
import OverlayRoot from '@/components/overlay/OverlayRoot.svelte';

async function registerBuilderSans(): Promise<void> {
	try {
		const url = browser.runtime.getURL(
			'/fonts/builder-sans/BuilderSans.woff2' as Parameters<typeof browser.runtime.getURL>[0]
		);
		const face = new FontFace('Builder Sans', `url("${url}")`, { weight: '400' });
		await face.load();
		document.fonts.add(face);
	} catch (err) {
		logger.warn('Builder Sans font registration failed; falling back to system font', err);
	}
}

async function waitForBody(): Promise<HTMLElement> {
	return new Promise((resolve) => {
		// document.body is typed as non-null but can be null before DOM loads
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- document.body is typed non-null but is null at document_start before DOM parse
		if (document.body) {
			resolve(document.body);
			return;
		}
		const observer = new MutationObserver(() => {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- document.body is typed non-null but is null at document_start before DOM parse
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

			injectBlurStyles();
			logger.debug('Blur styles injected');

			logger.debug('Loading custom APIs configuration...');
			await loadCustomApis();
			logger.debug('Custom APIs loaded successfully');

			logger.debug('Initializing access state...');
			await initializeRestrictedAccess();
			setupRestrictedAccessListener();
			logger.debug('Access state initialized');

			await waitForBody();

			// Register Builder Sans against document.fonts. WXT moves @font-face rules
			// into document.head where relative URLs resolve against the page origin
			// and 404; the FontFace API takes the explicit extension URL.
			void registerBuilderSans();

			themeManager.initializeRobloxTheme();

			const cssText = shadowCssRaw.replaceAll(':root', ':host');

			const ui = await createShadowRootUi(ctx, {
				name: 'rotector-overlay',
				position: 'overlay',
				zIndex: 10000,
				css: cssText,
				onMount(uiContainer, _shadow, shadowHost) {
					registerOverlayContainer(uiContainer);
					themeManager.registerPortalContainer(shadowHost);

					// Register inner html element so [data-theme] CSS selectors
					// match inside the shadow root (bare attribute selectors
					// don't match the shadow host from within shadow CSS)
					const shadowHtml = _shadow.querySelector('html');
					if (shadowHtml) themeManager.registerPortalContainer(shadowHtml);

					mount(OverlayRoot, { target: uiContainer });
					logger.debug('Shadow root overlay mounted');
					return uiContainer;
				},
				onRemove() {
					logger.debug('Shadow root overlay removed');
				}
			});
			ui.mount();

			let pageManagerInitialized = false;

			function initializePageHandling() {
				if (pageManagerInitialized) return;
				pageManagerInitialized = true;

				const pageManager = new PageControllerManager();
				logger.debug('Page controller manager initialized');

				metricsCollector.start();

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

				window.addEventListener('popstate', () => {
					logger.debug('Popstate event detected');
					checkForNavigation();
				});

				window.addEventListener('hashchange', () => {
					logger.debug('Hash change detected', { hash: window.location.hash });
					checkForNavigation();
				});

				void pageManager.handleNavigation(currentUrl);
			}

			if (get(extensionFeaturesEnabled)) {
				initializePageHandling();
			} else {
				const unsubscribe = extensionFeaturesEnabled.subscribe((enabled) => {
					if (enabled) {
						initializePageHandling();
						unsubscribe();
					}
				});
				logger.debug('Waiting for onboarding + legal acceptance to initialize page controllers');
			}

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
