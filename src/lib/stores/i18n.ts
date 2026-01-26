import { addMessages, init, locale, getLocaleFromNavigator } from 'svelte-i18n';
import { SETTINGS_KEYS } from '../types/settings';
import { logger } from '../utils/logger';
import {
	SUPPORTED_LOCALES,
	LOCALE_DISPLAY_NAMES,
	normalizeLocale,
	loadLocaleMessages,
	type SupportedLocale
} from '../utils/i18n';

// Track loaded locales to avoid re-fetching
const loadedLocales = new Set<string>();

// Initialize svelte-i18n
void init({
	fallbackLocale: 'en',
	initialLocale: 'en'
});

// Load locale into svelte-i18n
async function loadLocale(localeCode: string): Promise<void> {
	if (loadedLocales.has(localeCode)) {
		return;
	}

	try {
		const messages = await loadLocaleMessages(localeCode);
		addMessages(localeCode, messages);
		loadedLocales.add(localeCode);
	} catch (error) {
		logger.warn(`Failed to load locale: ${localeCode}`, error);
	}
}

// Apply a locale setting, handling 'auto' to use browser locale
async function applyLocale(localeCode: string): Promise<void> {
	let targetLocale: SupportedLocale;

	if (localeCode === 'auto') {
		const browserLocale = getLocaleFromNavigator() ?? 'en';
		targetLocale = normalizeLocale(browserLocale);
	} else if (SUPPORTED_LOCALES.includes(localeCode as SupportedLocale)) {
		targetLocale = localeCode as SupportedLocale;
	} else {
		targetLocale = 'en';
	}

	await loadLocale(targetLocale);
	void locale.set(targetLocale);
}

// Load and apply the user's stored language preference
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

// Set the language override or 'auto'
export async function setLanguage(localeCode: string): Promise<void> {
	await browser.storage.sync.set({ [SETTINGS_KEYS.LANGUAGE_OVERRIDE]: localeCode });
	await applyLocale(localeCode);
}

// Get list of available locales for the settings dropdown
export function getAvailableLocales(): Array<{ code: string; name: string }> {
	return SUPPORTED_LOCALES.map((code) => ({
		code,
		name: LOCALE_DISPLAY_NAMES[code]
	}));
}

// Sync language across contexts when storage changes
browser.storage.onChanged.addListener((changes, namespace) => {
	if (namespace === 'sync' && changes[SETTINGS_KEYS.LANGUAGE_OVERRIDE]) {
		void applyLocale(changes[SETTINGS_KEYS.LANGUAGE_OVERRIDE].newValue as string);
	}
});
