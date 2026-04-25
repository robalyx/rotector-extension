import { derived, get, writable } from 'svelte/store';
import { logger } from './logger';
import { settings, updateSetting } from '../stores/settings';
import { SETTINGS_KEYS, type Theme } from '../types/settings';

/**
 * Theme management utility with reactive Svelte stores and Roblox theme detection
 */
class ThemeManager {
	private readonly _systemTheme = writable<'light' | 'dark'>('light');
	public readonly systemTheme = { subscribe: this._systemTheme.subscribe };
	private readonly _robloxTheme = writable<'light' | 'dark'>('light');
	public readonly robloxTheme = { subscribe: this._robloxTheme.subscribe };
	private readonly _contentScriptTheme = writable<'light' | 'dark' | null>(null);
	public readonly effectiveTheme = derived(
		[settings, this._systemTheme, this._robloxTheme, this._contentScriptTheme],
		([currentSettings, systemTheme, robloxTheme, contentScriptTheme]) => {
			const userTheme = currentSettings[SETTINGS_KEYS.THEME];

			if (userTheme === 'light') return 'light';
			if (userTheme === 'dark') return 'dark';

			// Auto mode
			if (this.isRobloxPage()) {
				// Content script: use Roblox theme
				return robloxTheme;
			} else {
				// Popup: use stored content script theme if available, otherwise system theme
				return contentScriptTheme ?? systemTheme;
			}
		}
	);
	private mediaQuery: MediaQueryList | null = null;
	private mediaQueryHandler: ((e: MediaQueryListEvent) => void) | null = null;
	private robloxObserver: MutationObserver | null = null;
	private readonly portalContainers: Set<HTMLElement> = new Set();

	constructor() {
		this.initializeSystemThemeDetection();
		this.setupThemeApplication();
		this.setupThemePersistence();
	}

	// Initializes Roblox theme detection
	initializeRobloxTheme(): void {
		if (!this.isRobloxPage()) return;
		this.setupRobloxThemeObserver();
	}

	// Sets the theme preference
	async setTheme(theme: Theme): Promise<void> {
		try {
			await updateSetting(SETTINGS_KEYS.THEME, theme);
			logger.userAction('Theme changed', { theme });
		} catch (error) {
			logger.error('Failed to update theme setting:', error);
		}
	}

	// Gets the current effective theme
	getCurrentTheme(): 'light' | 'dark' {
		return get(this.effectiveTheme);
	}

	// Register a portal container to receive theme updates
	registerPortalContainer(container: HTMLElement): void {
		this.portalContainers.add(container);

		const currentTheme = this.getCurrentTheme();
		container.setAttribute('data-theme', currentTheme);
		logger.debug('Portal container registered for theme updates');
	}

	// Get the stored content script theme for popup synchronization
	async getContentScriptTheme(): Promise<'light' | 'dark' | null> {
		try {
			const result = await browser.storage.local.get(['rotector-content-theme']);
			return (result['rotector-content-theme'] as 'light' | 'dark' | null) ?? null;
		} catch (error) {
			logger.error('Failed to get content script theme:', error);
			return null;
		}
	}

	// Initialize popup theme synchronization with content script
	async initializePopupThemeSync(): Promise<void> {
		if (this.isRobloxPage()) return; // Only for popup context

		try {
			const storedTheme = await this.getContentScriptTheme();
			if (storedTheme) {
				this._contentScriptTheme.set(storedTheme);
				logger.debug(`Popup initialized with content script theme: ${storedTheme}`);
			}

			// Listen for changes to content script theme
			browser.storage.onChanged.addListener((changes, namespace) => {
				if (namespace === 'local' && changes['rotector-content-theme']) {
					const newTheme = changes['rotector-content-theme'].newValue as 'light' | 'dark' | null;
					if (newTheme) {
						this._contentScriptTheme.set(newTheme);
						logger.debug(`Popup synced with content script theme change: ${newTheme}`);
					}
				}
			});
		} catch (error) {
			logger.error('Failed to initialize popup theme sync:', error);
		}
	}

	// Cleans up event listeners and observers
	cleanup(): void {
		// Cleanup system theme detection
		if (this.mediaQuery && this.mediaQueryHandler) {
			this.mediaQuery.removeEventListener('change', this.mediaQueryHandler);
		}

		// Cleanup Roblox theme detection
		if (this.robloxObserver) {
			this.robloxObserver.disconnect();
			this.robloxObserver = null;
		}

		logger.debug('Theme manager cleaned up');
	}

	// Check if current page is a Roblox page
	private isRobloxPage(): boolean {
		return window.location.hostname.includes('roblox.com');
	}

	// Initializes system theme detection using prefers-color-scheme
	private initializeSystemThemeDetection(): void {
		try {
			this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
			this.updateSystemTheme();

			// Set up listener for system theme changes
			this.mediaQueryHandler = (e: MediaQueryListEvent) => {
				this.updateSystemTheme();
				logger.debug(`System theme changed to: ${e.matches ? 'dark' : 'light'}`);
			};

			this.mediaQuery.addEventListener('change', this.mediaQueryHandler);

			logger.debug('System theme detection initialized');
		} catch (error) {
			logger.error('Failed to initialize system theme detection:', error);
			this._systemTheme.set('light');
		}
	}

	// Sets up the MutationObserver for Roblox body class changes
	private setupRobloxThemeObserver(): void {
		try {
			// Initial detection
			this.updateRobloxTheme();

			// Set up observer for Roblox theme changes
			this.robloxObserver = new MutationObserver((mutations) => {
				for (const mutation of mutations) {
					if (
						mutation.type === 'attributes' &&
						mutation.attributeName === 'class' &&
						mutation.target === document.body
					) {
						this.updateRobloxTheme();
						break;
					}
				}
			});

			this.robloxObserver.observe(document.body, {
				attributes: true,
				attributeFilter: ['class']
			});

			logger.debug('Roblox theme detection initialized');
		} catch (error) {
			logger.error('Failed to initialize Roblox theme detection:', error);
			this._robloxTheme.set('light');
		}
	}

	// Updates the system theme based on media query
	private updateSystemTheme(): void {
		if (!this.mediaQuery) return;

		const isDark = this.mediaQuery.matches;
		this._systemTheme.set(isDark ? 'dark' : 'light');
	}

	// Updates the Roblox theme based on body class
	private updateRobloxTheme(): void {
		const isDark = document.body.classList.contains('dark-theme');
		this._robloxTheme.set(isDark ? 'dark' : 'light');
		logger.debug(`Roblox theme updated to: ${isDark ? 'dark' : 'light'}`);
	}

	// Sets up automatic theme application to document
	private setupThemeApplication(): void {
		this.effectiveTheme.subscribe((theme) => {
			this.applyThemeToDocument(theme);
		});
	}

	// Sets up theme persistence for content script synchronization
	private setupThemePersistence(): void {
		this.effectiveTheme.subscribe((theme) => {
			if (this.isRobloxPage()) {
				this.storeContentScriptTheme(theme).catch((err: unknown) => {
					logger.error('Failed to store content script theme:', err);
				});
			}
		});
	}

	// Applies theme to the document and all registered portal containers
	private applyThemeToDocument(theme: 'light' | 'dark'): void {
		try {
			const { documentElement } = document;

			// Set data attribute for CSS targeting
			documentElement.setAttribute('data-theme', theme);

			// Apply theme to all registered portal containers
			this.portalContainers.forEach((portal) => {
				try {
					portal.setAttribute('data-theme', theme);
				} catch (error) {
					logger.error('Failed to apply theme to portal container:', error);
				}
			});

			logger.debug(
				`Applied ${theme} theme to document and ${String(this.portalContainers.size)} portal containers`
			);
		} catch (error) {
			logger.error('Failed to apply theme to document:', error);
		}
	}

	// Store the content script's effective theme for popup synchronization
	private async storeContentScriptTheme(theme: 'light' | 'dark'): Promise<void> {
		try {
			await browser.storage.local.set({ 'rotector-content-theme': theme });
			this._contentScriptTheme.set(theme);
			logger.debug(`Stored content script theme: ${theme}`);
		} catch (error) {
			logger.error('Failed to store content script theme:', error);
		}
	}
}

// Export singleton instance
export const themeManager = new ThemeManager();

// Export portal management functions
export const registerPortalContainer = (container: HTMLElement) => {
	themeManager.registerPortalContainer(container);
};

// Export popup theme sync function
export const initializePopupThemeSync = async () => themeManager.initializePopupThemeSync();
