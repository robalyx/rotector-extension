import '../styles/index.css';
import { mount } from 'svelte';
import { get } from 'svelte/store';
import { logger } from '@/lib/utils/logger';
import { PageControllerManager } from '@/lib/controllers/PageControllerManager';
import {
	registerPortalContainer,
	themeManager,
	unregisterPortalContainer
} from '@/lib/utils/theme';
import { initializeSettings, settings } from '@/lib/stores/settings';
import { SETTINGS_KEYS } from '@/lib/types/settings';
import { loadStoredLanguagePreference } from '@/lib/stores/i18n';
import { loadCustomApis } from '@/lib/stores/custom-apis';
import {
	initializeRestrictedAccess,
	setupRestrictedAccessListener
} from '@/lib/stores/restricted-access';
import { triggerOnboardingReplay } from '@/lib/stores/onboarding';
import { injectBlurStyles, injectDefaultBlurStyles } from '@/lib/services/blur-service';
import { shouldShowChangelogModal } from '@/lib/stores/changelog';
import OnboardingManager from '@/components/onboarding/OnboardingManager.svelte';
import ChangelogModal from '@/components/changelog/ChangelogModal.svelte';

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
		// Standard URLs (no language prefix)
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
		// Internationalized URLs (with language prefix like /es/, /de/)
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

	async main() {
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
			const body = await waitForBody();

			// Initialize Roblox theme detection
			themeManager.initializeRobloxTheme();

			// Create container for onboarding and mount component
			const onboardingContainer = document.createElement('div');
			onboardingContainer.id = 'rotector-onboarding';
			body.appendChild(onboardingContainer);
			registerPortalContainer(onboardingContainer);
			mount(OnboardingManager, { target: onboardingContainer });
			logger.debug('Onboarding manager mounted');

			// Check for replay request from popup
			const replayResult = await browser.storage.local.get('onboardingReplayRequested');
			if (replayResult.onboardingReplayRequested) {
				await browser.storage.local.remove('onboardingReplayRequested');
				triggerOnboardingReplay();
				logger.debug('Onboarding replay triggered from popup');
			}

			// Create container for changelog modal and mount if needed
			const changelogContainer = document.createElement('div');
			changelogContainer.id = 'rotector-changelog';
			body.appendChild(changelogContainer);
			registerPortalContainer(changelogContainer);

			// Mount changelog modal if there are unread changelogs
			if (get(shouldShowChangelogModal)) {
				mount(ChangelogModal, {
					target: changelogContainer,
					props: {
						onClose: () => {
							logger.debug('Changelog modal closed');
						}
					}
				});
				logger.debug('Changelog modal mounted');
			}

			// Create portal container for tooltips
			const portalContainer = document.createElement('div');
			portalContainer.id = 'rotector-tooltip-portal';
			portalContainer.style.cssText =
				'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 10000;';
			body.appendChild(portalContainer);

			// Register portal container with theme manager for theme updates
			registerPortalContainer(portalContainer);
			logger.debug('Portal container created and registered with theme manager');

			// Track initialization state
			let pageManagerInitialized = false;

			function initializePageHandling() {
				if (pageManagerInitialized) return;
				pageManagerInitialized = true;

				// Initialize page controller manager
				const pageManager = new PageControllerManager();
				pageManager.initialize();
				logger.debug('Page controller manager initialized');

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
				if (onboardingContainer) {
					unregisterPortalContainer(onboardingContainer);
				}
				if (changelogContainer) {
					unregisterPortalContainer(changelogContainer);
				}
				if (portalContainer) {
					unregisterPortalContainer(portalContainer);
				}
				themeManager.cleanup();
			});

			logger.info('Rotector content script successfully initialized');
		} catch (error) {
			logger.error('Failed to initialize content script:', error);
			themeManager.cleanup();
		}
	}
});
