import { getAssetUrl } from './assets';
import { SETTINGS_KEYS } from '../types/settings';
import { logger } from './logger';

export const SUPPORTED_LOCALES = [
	'en',
	'ar',
	'bn',
	'de',
	'es',
	'fil',
	'fr',
	'hi',
	'id',
	'it',
	'ja',
	'ko',
	'ms',
	'nl',
	'pl',
	'pt',
	'ru',
	'sv',
	'th',
	'tr',
	'uk',
	'vi',
	'zh-CN',
	'zh-TW'
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// Display names for locale picker
export const LOCALE_DISPLAY_NAMES: Record<SupportedLocale, string> = {
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
	'zh-CN': '简体中文',
	'zh-TW': '繁體中文'
};

// Normalize browser locale to supported BCP 47 format
export function normalizeLocale(browserLocale: string): SupportedLocale {
	if (SUPPORTED_LOCALES.includes(browserLocale as SupportedLocale)) {
		return browserLocale as SupportedLocale;
	}

	const lowerLocale = browserLocale.toLowerCase();
	if (lowerLocale.startsWith('zh')) {
		if (lowerLocale.includes('tw') || lowerLocale.includes('hant') || lowerLocale.includes('hk')) {
			return 'zh-TW';
		}
		return 'zh-CN';
	}

	const baseLocale = browserLocale.split(/[-_]/)[0];
	if (SUPPORTED_LOCALES.includes(baseLocale as SupportedLocale)) {
		return baseLocale as SupportedLocale;
	}

	return 'en';
}

// Get current locale from storage or browser
async function getCurrentLocale(): Promise<SupportedLocale> {
	try {
		const stored = await browser.storage.sync.get(SETTINGS_KEYS.LANGUAGE_OVERRIDE);
		const storedLocale = stored[SETTINGS_KEYS.LANGUAGE_OVERRIDE] as string | undefined;

		if (storedLocale && storedLocale !== 'auto') {
			return normalizeLocale(storedLocale);
		}

		const browserLocale = navigator.language ?? 'en';
		return normalizeLocale(browserLocale);
	} catch {
		return 'en';
	}
}

// Load messages for a locale
export async function loadLocaleMessages(locale: string): Promise<Record<string, string>> {
	try {
		const url = getAssetUrl(`locales/${locale}/messages.json`);
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		return (await response.json()) as Record<string, string>;
	} catch (error) {
		logger.warn(`Failed to load locale: ${locale}`, error);
		if (locale !== 'en') {
			return loadLocaleMessages('en');
		}
		return {};
	}
}

// Simple translation function for non-Svelte contexts
let cachedMessages: Record<string, string> | null = null;
let cachedLocale: string | null = null;

export async function t(key: string, params?: Record<string, string | number>): Promise<string> {
	const locale = await getCurrentLocale();

	if (cachedLocale !== locale || !cachedMessages) {
		cachedMessages = await loadLocaleMessages(locale);
		cachedLocale = locale;
	}

	let message = cachedMessages[key] ?? key;

	if (params) {
		for (const [paramKey, value] of Object.entries(params)) {
			message = message.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value));
		}
	}

	return message;
}

// Invalidate cache when language changes
browser.storage.onChanged.addListener((changes, namespace) => {
	if (namespace === 'sync' && changes[SETTINGS_KEYS.LANGUAGE_OVERRIDE]) {
		cachedMessages = null;
		cachedLocale = null;
	}
});
