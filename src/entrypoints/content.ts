import '../styles/index.css';
import {logger} from '@/lib/utils/logger';
import {PageControllerManager} from '@/lib/controllers/PageControllerManager';
import {registerPortalContainer, themeManager, unregisterPortalContainer} from '@/lib/utils/theme';
import {initializeSettings} from '@/lib/stores/settings';

export default defineContentScript({
    matches: [
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
        'https://*.roblox.com/report-abuse*',
        'https://*.roblox.com/report-abuse/*'
    ],

    async main() {
        try {
            logger.info('Rotector content script initializing...');

            logger.debug('Initializing settings...');
            await initializeSettings();
            logger.debug('Settings loaded successfully');

            // Create portal container for tooltips
            const portalContainer = document.createElement('div');
            portalContainer.id = 'rotector-tooltip-portal';
            portalContainer.style.cssText = 'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 10000;';
            document.body.appendChild(portalContainer);

            // Register portal container with theme manager for theme updates
            registerPortalContainer(portalContainer);
            logger.debug('Portal container created and registered with theme manager');

            // Initialize page controller manager
            const pageManager = new PageControllerManager();
            await pageManager.initialize();
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
                    pageManager.handleNavigation(currentUrl);
                }
            };

            // Set up navigation monitoring
            setInterval(checkForNavigation, 1000);

            // Listen for hash changes
            window.addEventListener('hashchange', () => {
                logger.debug('Hash change detected', {hash: window.location.hash});
                setTimeout(checkForNavigation, 100);
            });

            // Initial page detection and setup
            await pageManager.handleNavigation(currentUrl);

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
