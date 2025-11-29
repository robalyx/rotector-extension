import { browser } from 'wxt/browser';

/**
 * Gets the full URL for an extension asset.
 */
export function getAssetUrl(path: string): string {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
	return browser.runtime.getURL(path as any);
}
