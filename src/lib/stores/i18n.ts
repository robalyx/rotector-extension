import { browser } from 'wxt/browser';

// Get translated message from locale files
export function t(key: string, substitutions?: string[]): string {
	const message = browser.i18n.getMessage(
		key as Parameters<typeof browser.i18n.getMessage>[0],
		substitutions
	);
	return message || key;
}

// Get the current browser language
export function getCurrentLanguage(): string {
	return browser.i18n.getUILanguage();
}
