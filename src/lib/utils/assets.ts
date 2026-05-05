import { browser, type PublicPath } from 'wxt/browser';

export function getAssetUrl(path: PublicPath): string {
	return browser.runtime.getURL(path);
}
