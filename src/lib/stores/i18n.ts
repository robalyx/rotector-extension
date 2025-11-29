import { addMessages, init, locale, getLocaleFromNavigator } from 'svelte-i18n';
import { SETTINGS_KEYS } from '../types/settings';
import { getAssetUrl } from '../utils/assets';
import { logger } from '../utils/logger';

// Supported locales with their display names
const SUPPORTED_LOCALES = {
	en: 'English',
	ar: 'العربية',
	bn: 'বাংলা',
	de: 'Deutsch',
	es: 'Español',
	fil: 'Filipino',
	fr: 'Français',
	hi: 'हिन्दी',
	id: 'Bahasa Indonesia',
	it: 'Italiano',
	ja: '日本語',
	ko: '한국어',
	ms: 'Bahasa Melayu',
	nl: 'Nederlands',
	pl: 'Polski',
	pt: 'Português',
	ru: 'Русский',
	sv: 'Svenska',
	th: 'ไทย',
	tr: 'Türkçe',
	uk: 'Українська',
	vi: 'Tiếng Việt',
	zh_CN: '简体中文',
	zh_TW: '繁體中文'
} as const;

// Track loaded locales to avoid re-fetching
const loadedLocales = new Set<string>();

// Initialize svelte-i18n
void init({
	fallbackLocale: 'en',
	initialLocale: 'en'
});

/**
 * Fetch locale messages from extension's public directory
 */
async function loadLocale(localeCode: string): Promise<void> {
	if (loadedLocales.has(localeCode)) {
		return;
	}

	try {
		const url = getAssetUrl(`locales/${localeCode}/messages.json`);
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		const messages = (await response.json()) as Record<string, string>;
		addMessages(localeCode, messages);
		loadedLocales.add(localeCode);
	} catch (error) {
		logger.warn(`Failed to load locale: ${localeCode}`, error);
	}
}

/**
 * Apply a locale setting, handling 'auto' to use browser locale
 */
async function applyLocale(localeCode: string): Promise<void> {
	let targetLocale: string;

	if (localeCode === 'auto') {
		const browserLocale = getLocaleFromNavigator() ?? 'en';
		targetLocale = normalizeLocale(browserLocale);
	} else if (localeCode in SUPPORTED_LOCALES) {
		targetLocale = localeCode;
	} else {
		targetLocale = 'en';
	}

	await loadLocale(targetLocale);
	void locale.set(targetLocale);
}

/**
 * Load and apply the user's stored language preference
 */
export async function loadStoredLanguagePreference(): Promise<void> {
	try {
		const stored = await browser.storage.sync.get(SETTINGS_KEYS.LANGUAGE_OVERRIDE);
		const storedLocale = stored[SETTINGS_KEYS.LANGUAGE_OVERRIDE] as string | undefined;

		if (storedLocale) {
			await applyLocale(storedLocale);
		} else {
			const browserLocale = getLocaleFromNavigator() ?? 'en';
			await applyLocale(normalizeLocale(browserLocale));
		}
	} catch (error) {
		logger.warn('Failed to load language preference from storage', error);
	}
}

/**
 * Normalize browser locale to our supported format
 */
function normalizeLocale(browserLocale: string): string {
	if (browserLocale in SUPPORTED_LOCALES) {
		return browserLocale;
	}

	const lowerLocale = browserLocale.toLowerCase();
	if (lowerLocale.startsWith('zh')) {
		if (lowerLocale.includes('tw') || lowerLocale.includes('hant') || lowerLocale.includes('hk')) {
			return 'zh_TW';
		}
		return 'zh_CN';
	}

	const baseLocale = browserLocale.split(/[-_]/)[0];
	if (baseLocale in SUPPORTED_LOCALES) {
		return baseLocale;
	}

	return 'en';
}

/**
 * Set the language override or 'auto'
 */
export async function setLanguage(localeCode: string): Promise<void> {
	await browser.storage.sync.set({ [SETTINGS_KEYS.LANGUAGE_OVERRIDE]: localeCode });
	await applyLocale(localeCode);
}

/**
 * Get list of available locales for the settings dropdown
 */
export function getAvailableLocales(): Array<{ code: string; name: string }> {
	return Object.entries(SUPPORTED_LOCALES).map(([code, name]) => ({
		code,
		name
	}));
}

// Sync language across contexts when storage changes
browser.storage.onChanged.addListener((changes, namespace) => {
	if (namespace === 'sync' && changes[SETTINGS_KEYS.LANGUAGE_OVERRIDE]) {
		void applyLocale(changes[SETTINGS_KEYS.LANGUAGE_OVERRIDE].newValue as string);
	}
});
