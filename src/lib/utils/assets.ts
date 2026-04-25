import { browser, type PublicPath } from 'wxt/browser';

/**
 * Gets the full URL for an extension asset.
 */
export function getAssetUrl(path: PublicPath): string {
	return browser.runtime.getURL(path);
}
