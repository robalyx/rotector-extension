import { getAssetUrl } from './assets';
import { SETTINGS_KEYS } from '../types/settings';
import { logger } from './logging/logger';
import { getStorage, subscribeStorageKey } from './storage';

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

export const RTL_LOCALES: ReadonlySet<string> = new Set<SupportedLocale>(['ar']);

export const NO_WORD_BREAK_LOCALES: ReadonlySet<string> = new Set<SupportedLocale>([
	'zh-CN',
	'zh-TW',
	'ja',
	'ko',
	'th'
]);

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

// Maps zh variants to TW or CN, falls back to base tag, or 'en' when nothing matches
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

async function getCurrentLocale(): Promise<SupportedLocale> {
	try {
		const storedLocale = await getStorage<string | undefined>(
			'sync',
			SETTINGS_KEYS.LANGUAGE_OVERRIDE,
			undefined
		);

		if (storedLocale && storedLocale !== 'auto') {
			return normalizeLocale(storedLocale);
		}

		const browserLocale = navigator.language;
		return normalizeLocale(browserLocale);
	} catch {
		return 'en';
	}
}

// Falls back to en on fetch failure, returns empty object only when en itself fails
export async function loadLocaleMessages(locale: SupportedLocale): Promise<Record<string, string>> {
	try {
		const url = getAssetUrl(`/locales/${locale}/messages.json`);
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${String(response.status)}`);
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

// Returns the key itself when the message is missing so the UI never shows undefined
export async function t(key: string, params?: Record<string, string | number>): Promise<string> {
	const locale = await getCurrentLocale();

	if (cachedLocale !== locale || !cachedMessages) {
		cachedMessages = await loadLocaleMessages(locale);
		cachedLocale = locale;
	}

	let message = cachedMessages[key] ?? key;

	if (params) {
		for (const [paramKey, value] of Object.entries(params)) {
			message = message.replaceAll(new RegExp(String.raw`\{${paramKey}\}`, 'g'), String(value));
		}
	}

	return message;
}

subscribeStorageKey<string>('sync', SETTINGS_KEYS.LANGUAGE_OVERRIDE, () => {
	cachedMessages = null;
	cachedLocale = null;
});
