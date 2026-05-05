import type { ApiResponse } from '../types/api';
import type { CustomApiConfig } from '../types/custom-api';
import { API_ACTIONS } from '../types/constants';
import { logger } from './logging/logger';

const TRANSLATE_API_ORIGIN = 'https://translate.googleapis.com/*';

// browser.permissions is unavailable to content scripts (and to popups in some
// browsers), so callers fall through to a background-message round-trip
function isPermissionsApiAvailable(): boolean {
	return typeof browser !== 'undefined' && !!browser.permissions;
}

// Falls back to a background message round-trip when browser.permissions is unavailable
export async function hasTranslatePermission(): Promise<boolean> {
	if (isPermissionsApiAvailable()) {
		return hasPermissionsForOrigins([TRANSLATE_API_ORIGIN]);
	}
	try {
		const response: ApiResponse<{ hasPermission: boolean }> = await browser.runtime.sendMessage({
			action: API_ACTIONS.HAS_TRANSLATE_PERMISSION
		});
		return response.success && response.data?.hasPermission === true;
	} catch (error) {
		logger.error('Failed to check translate permission via messaging:', error);
		return false;
	}
}

// Must be invoked from a user gesture, falls back to background message in restricted contexts
export async function requestTranslatePermission(): Promise<boolean> {
	if (isPermissionsApiAvailable()) {
		return requestPermissionsForOrigins([TRANSLATE_API_ORIGIN]);
	}
	try {
		const response: ApiResponse<{ granted: boolean }> = await browser.runtime.sendMessage({
			action: API_ACTIONS.REQUEST_TRANSLATE_PERMISSION
		});
		return response.success && response.data?.granted === true;
	} catch (error) {
		logger.error('Failed to request translate permission via messaging:', error);
		return false;
	}
}

function extractOriginPattern(url: string): string | null {
	try {
		const urlObj = new URL(url);
		return `${urlObj.protocol}//${urlObj.host}/*`;
	} catch (error) {
		logger.error('Failed to extract origin pattern from URL:', { url, error });
		return null;
	}
}

// Deduplicates singleUrl and batchUrl into origin patterns suitable for permissions.request
export function extractApiOrigins(api: Pick<CustomApiConfig, 'singleUrl' | 'batchUrl'>): string[] {
	const origins: string[] = [];
	for (const url of [api.singleUrl, api.batchUrl]) {
		const origin = extractOriginPattern(url);
		if (origin && !origins.includes(origin)) {
			origins.push(origin);
		}
	}
	return origins;
}

export async function hasPermissionsForOrigins(origins: string[]): Promise<boolean> {
	try {
		if (typeof browser === 'undefined') {
			logger.warn('Permissions API not available');
			return false;
		}

		if (origins.length === 0) {
			return true;
		}

		return await browser.permissions.contains({ origins });
	} catch (error) {
		logger.error('Failed to check permissions for origins:', { origins, error });
		return false;
	}
}

export async function requestPermissionsForOrigins(origins: string[]): Promise<boolean> {
	try {
		if (typeof browser === 'undefined') {
			logger.warn('Permissions API not available');
			return false;
		}

		if (origins.length === 0) {
			return true;
		}

		const granted = await browser.permissions.request({ origins });
		logger.info('Permission request result:', { granted, origins });
		return granted;
	} catch (error) {
		logger.error('Failed to request permissions for origins:', { origins, error });
		return false;
	}
}
