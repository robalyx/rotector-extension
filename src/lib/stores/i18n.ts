import { addMessages, init, locale, getLocaleFromNavigator } from 'svelte-i18n';
import { SETTINGS_KEYS } from '../types/settings';
import { logger } from '../utils/logging/logger';
import { getStorage, setStorage, subscribeStorageKey } from '../utils/storage';
import {
	SUPPORTED_LOCALES,
	LOCALE_DISPLAY_NAMES,
	normalizeLocale,
	loadLocaleMessages,
	type SupportedLocale
} from '../utils/i18n';

// Track loaded locales to avoid re-fetching
const loadedLocales = new Set<string>();

void init({
	fallbackLocale: 'en',
	initialLocale: 'en'
});

async function loadLocale(localeCode: SupportedLocale): Promise<void> {
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

// 'auto' resolves to the browser locale via getLocaleFromNavigator
async function applyLocale(localeCode: string): Promise<void> {
	const targetLocale = normalizeLocale(
		localeCode === 'auto' ? (getLocaleFromNavigator() ?? 'en') : localeCode
	);
	if (targetLocale !== 'en') await loadLocale('en');
	await loadLocale(targetLocale);
	void locale.set(targetLocale);
}

// Falls back to the browser locale when the stored value is missing or 'auto'
export async function loadStoredLanguagePreference(): Promise<void> {
	try {
		const storedLocale = await getStorage<string | undefined>(
			'sync',
			SETTINGS_KEYS.LANGUAGE_OVERRIDE,
			undefined
		);
		await applyLocale(storedLocale ?? normalizeLocale(getLocaleFromNavigator() ?? 'en'));
	} catch (error) {
		logger.warn('Failed to load language preference from storage', error);
	}
}

// Persists the override to sync storage and applies it, accepts 'auto' to follow the browser locale
export async function setLanguage(localeCode: string): Promise<void> {
	await setStorage('sync', SETTINGS_KEYS.LANGUAGE_OVERRIDE, localeCode);
	await applyLocale(localeCode);
}

export function getAvailableLocales(): Array<{ code: string; name: string }> {
	return SUPPORTED_LOCALES.map((code) => ({
		code,
		name: LOCALE_DISPLAY_NAMES[code]
	}));
}

// Cross-context sync when popup changes the override
subscribeStorageKey<string>('sync', SETTINGS_KEYS.LANGUAGE_OVERRIDE, (newValue) => {
	if (typeof newValue === 'string') void applyLocale(newValue);
});
