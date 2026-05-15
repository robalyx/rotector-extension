import { derived, get, writable } from 'svelte/store';
import { logger } from './logging/logger';
import { getStorage, setStorage, subscribeStorageKey } from './storage';
import { settings, updateSetting } from '../stores/settings';
import { STORAGE_KEYS } from '../types/constants';
import { SETTINGS_KEYS, type Theme } from '../types/settings';

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

			return this.isRobloxPage() ? robloxTheme : (contentScriptTheme ?? systemTheme);
		}
	);
	private mediaQuery: MediaQueryList | null = null;
	private mediaQueryHandler: ((e: MediaQueryListEvent) => void) | null = null;
	private robloxObserver: MutationObserver | null = null;
	private readonly portalContainers = new Set<HTMLElement>();

	constructor() {
		this.initializeSystemThemeDetection();
		this.setupThemeApplication();
		this.setupThemePersistence();
	}

	// No-op off Roblox so popup and other contexts skip the body class observer
	initializeRobloxTheme(): void {
		if (!this.isRobloxPage()) return;
		this.setupRobloxThemeObserver();
	}

	async setTheme(theme: Theme): Promise<void> {
		try {
			await updateSetting(SETTINGS_KEYS.THEME, theme);
			logger.userAction('Theme changed', { theme });
		} catch (error) {
			logger.error('Failed to update theme setting:', error);
		}
	}

	getCurrentTheme(): 'light' | 'dark' {
		return get(this.effectiveTheme);
	}

	// Tracks the container and stamps data-theme so shadow-root portals follow theme changes
	registerPortalContainer(container: HTMLElement): void {
		this.portalContainers.add(container);

		const currentTheme = this.getCurrentTheme();
		container.dataset['theme'] = currentTheme;
		logger.debug('Portal container registered for theme updates');
	}

	async getContentScriptTheme(): Promise<'light' | 'dark' | null> {
		try {
			return await getStorage<'light' | 'dark' | null>('local', STORAGE_KEYS.CONTENT_THEME, null);
		} catch (error) {
			logger.error('Failed to get content script theme:', error);
			return null;
		}
	}

	// Mirrors content-script theme into the popup via local storage so colors stay aligned
	async initializePopupThemeSync(): Promise<void> {
		if (this.isRobloxPage()) return;

		try {
			const storedTheme = await this.getContentScriptTheme();
			if (storedTheme) {
				this._contentScriptTheme.set(storedTheme);
				logger.debug(`Popup initialized with content script theme: ${storedTheme}`);
			}

			subscribeStorageKey<'light' | 'dark' | null>(
				'local',
				STORAGE_KEYS.CONTENT_THEME,
				(newTheme) => {
					if (newTheme) {
						this._contentScriptTheme.set(newTheme);
						logger.debug(`Popup synced with content script theme change: ${newTheme}`);
					}
				}
			);
		} catch (error) {
			logger.error('Failed to initialize popup theme sync:', error);
		}
	}

	cleanup(): void {
		if (this.mediaQuery && this.mediaQueryHandler) {
			this.mediaQuery.removeEventListener('change', this.mediaQueryHandler);
		}

		if (this.robloxObserver) {
			this.robloxObserver.disconnect();
			this.robloxObserver = null;
		}

		logger.debug('Theme manager cleaned up');
	}

	private isRobloxPage(): boolean {
		return globalThis.location.hostname.includes('roblox.com');
	}

	private initializeSystemThemeDetection(): void {
		try {
			this.mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');
			this.updateSystemTheme();

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

	private setupRobloxThemeObserver(): void {
		try {
			this.updateRobloxTheme();

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

	private updateSystemTheme(): void {
		if (!this.mediaQuery) return;

		const isDark = this.mediaQuery.matches;
		this._systemTheme.set(isDark ? 'dark' : 'light');
	}

	private updateRobloxTheme(): void {
		const isDark = document.body.classList.contains('dark-theme');
		this._robloxTheme.set(isDark ? 'dark' : 'light');
		logger.debug(`Roblox theme updated to: ${isDark ? 'dark' : 'light'}`);
	}

	private setupThemeApplication(): void {
		this.effectiveTheme.subscribe((theme) => {
			this.applyThemeToDocument(theme);
		});
	}

	private setupThemePersistence(): void {
		this.effectiveTheme.subscribe((theme) => {
			if (this.isRobloxPage()) {
				this.storeContentScriptTheme(theme).catch((error: unknown) => {
					logger.error('Failed to store content script theme:', error);
				});
			}
		});
	}

	private applyThemeToDocument(theme: 'light' | 'dark'): void {
		try {
			const { documentElement } = document;

			documentElement.dataset['theme'] = theme;

			for (const portal of this.portalContainers) {
				try {
					portal.dataset['theme'] = theme;
				} catch (error) {
					logger.error('Failed to apply theme to portal container:', error);
				}
			}

			logger.debug(
				`Applied ${theme} theme to document and ${String(this.portalContainers.size)} portal containers`
			);
		} catch (error) {
			logger.error('Failed to apply theme to document:', error);
		}
	}

	private async storeContentScriptTheme(theme: 'light' | 'dark'): Promise<void> {
		try {
			await setStorage('local', STORAGE_KEYS.CONTENT_THEME, theme);
			this._contentScriptTheme.set(theme);
			logger.debug(`Stored content script theme: ${theme}`);
		} catch (error) {
			logger.error('Failed to store content script theme:', error);
		}
	}
}

export const themeManager = new ThemeManager();
