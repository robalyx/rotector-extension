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
import OnboardingManager from '@/components/onboarding/OnboardingManager.svelte';

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

	async main() {
		try {
			logger.info('Rotector content script initializing...');

			logger.debug('Loading stored language preference...');
			await loadStoredLanguagePreference();
			logger.debug('Language preference loaded successfully');

			logger.debug('Initializing settings...');
			await initializeSettings();
			logger.debug('Settings loaded successfully');

			logger.debug('Loading custom APIs configuration...');
			await loadCustomApis();
			logger.debug('Custom APIs loaded successfully');

			logger.debug('Initializing access state...');
			await initializeRestrictedAccess();
			setupRestrictedAccessListener();
			logger.debug('Access state initialized');

			// Create container for onboarding and mount component
			const onboardingContainer = document.createElement('div');
			onboardingContainer.id = 'rotector-onboarding';
			document.body.appendChild(onboardingContainer);
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

			// Create portal container for tooltips
			const portalContainer = document.createElement('div');
			portalContainer.id = 'rotector-tooltip-portal';
			portalContainer.style.cssText =
				'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 10000;';
			document.body.appendChild(portalContainer);

			// Register portal container with theme manager for theme updates
			registerPortalContainer(portalContainer);
			logger.debug('Portal container created and registered with theme manager');

			// Initialize page handling
			const currentSettings = get(settings);
			const onboardingCompleted = currentSettings[SETTINGS_KEYS.ONBOARDING_COMPLETED];

			if (onboardingCompleted) {
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
				await pageManager.handleNavigation(currentUrl);
			} else {
				logger.debug('Skipping page controller initialization - onboarding not completed');
			}

			// Set up cleanup on page unload
			window.addEventListener('beforeunload', () => {
				logger.debug('Content script cleanup on page unload');
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
