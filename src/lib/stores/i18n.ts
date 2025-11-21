import { addMessages, init, locale, getLocaleFromNavigator } from 'svelte-i18n';
import { browser } from 'wxt/browser';
import { SETTINGS_KEYS } from '../types/settings';
import { logger } from '../utils/logger';
import en from '../../_locales/en/messages.json';
import ar from '../../_locales/ar/messages.json';
import bn from '../../_locales/bn/messages.json';
import de from '../../_locales/de/messages.json';
import es from '../../_locales/es/messages.json';
import fil from '../../_locales/fil/messages.json';
import fr from '../../_locales/fr/messages.json';
import hi from '../../_locales/hi/messages.json';
import id from '../../_locales/id/messages.json';
import it from '../../_locales/it/messages.json';
import ja from '../../_locales/ja/messages.json';
import ko from '../../_locales/ko/messages.json';
import ms from '../../_locales/ms/messages.json';
import nl from '../../_locales/nl/messages.json';
import pl from '../../_locales/pl/messages.json';
import pt from '../../_locales/pt/messages.json';
import ru from '../../_locales/ru/messages.json';
import sv from '../../_locales/sv/messages.json';
import th from '../../_locales/th/messages.json';
import tr from '../../_locales/tr/messages.json';
import uk from '../../_locales/uk/messages.json';
import vi from '../../_locales/vi/messages.json';
import zh_CN from '../../_locales/zh_CN/messages.json';
import zh_TW from '../../_locales/zh_TW/messages.json';

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

// Map locale codes to imported messages
const localeMessages: Record<string, Record<string, string>> = {
	en,
	ar,
	bn,
	de,
	es,
	fil,
	fr,
	hi,
	id,
	it,
	ja,
	ko,
	ms,
	nl,
	pl,
	pt,
	ru,
	sv,
	th,
	tr,
	uk,
	vi,
	zh_CN,
	zh_TW
};

// Register all messages
for (const [localeCode, messages] of Object.entries(localeMessages)) {
	addMessages(localeCode, messages);
}

// Initialize synchronously with browser locale detection
const detectedLocale = getLocaleFromNavigator() ?? 'en';
void init({
	fallbackLocale: 'en',
	initialLocale: normalizeLocale(detectedLocale)
});

/**
 * Apply a locale setting, handling 'auto' to use browser locale
 */
function applyLocale(localeCode: string): void {
	if (localeCode === 'auto') {
		const browserLocale = getLocaleFromNavigator() ?? 'en';
		void locale.set(normalizeLocale(browserLocale));
	} else if (localeCode in SUPPORTED_LOCALES) {
		void locale.set(localeCode);
	}
}

/**
 * Load and apply the user's stored language preference
 */
export async function loadStoredLanguagePreference(): Promise<void> {
	try {
		const stored = await browser.storage.sync.get(SETTINGS_KEYS.LANGUAGE_OVERRIDE);
		const storedLocale = stored[SETTINGS_KEYS.LANGUAGE_OVERRIDE] as string | undefined;

		if (storedLocale && storedLocale !== 'auto' && storedLocale in SUPPORTED_LOCALES) {
			void locale.set(storedLocale);
		}
	} catch (error) {
		logger.warn('Failed to load language preference from storage', error);
	}
}

/**
 * Normalize browser locale to our supported format
 */
function normalizeLocale(browserLocale: string): string {
	// Direct match
	if (browserLocale in SUPPORTED_LOCALES) {
		return browserLocale;
	}

	// Handle Chinese variants
	const lowerLocale = browserLocale.toLowerCase();
	if (lowerLocale.startsWith('zh')) {
		if (lowerLocale.includes('tw') || lowerLocale.includes('hant') || lowerLocale.includes('hk')) {
			return 'zh_TW';
		}
		return 'zh_CN';
	}

	// Try base language code (e.g., 'en-US' -> 'en')
	const baseLocale = browserLocale.split(/[-_]/)[0];
	if (baseLocale in SUPPORTED_LOCALES) {
		return baseLocale;
	}

	// Default to English
	return 'en';
}

/**
 * Set the language override or 'auto'
 */
export async function setLanguage(localeCode: string): Promise<void> {
	await browser.storage.sync.set({ [SETTINGS_KEYS.LANGUAGE_OVERRIDE]: localeCode });
	applyLocale(localeCode);
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
		applyLocale(changes[SETTINGS_KEYS.LANGUAGE_OVERRIDE].newValue as string);
	}
});
