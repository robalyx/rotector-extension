import { logger } from './logger';

const TRANSLATE_API_ORIGIN = 'https://translate.googleapis.com/*';

// Check if we have permission to use the Google Translate API
export async function hasTranslatePermission(): Promise<boolean> {
	return hasPermissionsForOrigins([TRANSLATE_API_ORIGIN]);
}

// Request permission to use the Google Translate API
export async function requestTranslatePermission(): Promise<boolean> {
	return requestPermissionsForOrigins([TRANSLATE_API_ORIGIN]);
}

// Convert a full API URL to an origin pattern for permission requests
export function extractOriginPattern(url: string): string | null {
	try {
		const urlObj = new URL(url);
		return `${urlObj.protocol}//${urlObj.host}/*`;
	} catch (error) {
		logger.error('Failed to extract origin pattern from URL:', { url, error });
		return null;
	}
}

// Check if we have permissions for specific origins
export async function hasPermissionsForOrigins(origins: string[]): Promise<boolean> {
	try {
		if (typeof browser === 'undefined' || !browser.permissions) {
			logger.warn('Permissions API not available');
			return false;
		}

		if (origins.length === 0) {
			return true;
		}

		const result = await browser.permissions.contains({ origins });
		return result;
	} catch (error) {
		logger.error('Failed to check permissions for origins:', { origins, error });
		return false;
	}
}

// Request permissions for specific origins
export async function requestPermissionsForOrigins(origins: string[]): Promise<boolean> {
	try {
		if (typeof browser === 'undefined' || !browser.permissions) {
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
