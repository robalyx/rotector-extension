import { API_ACTIONS } from '@/lib/types/constants';
import { logger } from './logger';

const TRANSLATE_API_ORIGIN = 'https://translate.googleapis.com/*';

interface HasPermissionResponse {
	hasPermission: boolean;
}

interface RequestPermissionResponse {
	granted: boolean;
}

function isHasPermissionResponse(response: unknown): response is HasPermissionResponse {
	return typeof response === 'object' && response !== null && 'hasPermission' in response;
}

function isRequestPermissionResponse(response: unknown): response is RequestPermissionResponse {
	return typeof response === 'object' && response !== null && 'granted' in response;
}

// Check if browser.permissions API is available
function isPermissionsApiAvailable(): boolean {
	return typeof browser !== 'undefined' && !!browser.permissions;
}

// Check if we have permission to use the Google Translate API
export async function hasTranslatePermission(): Promise<boolean> {
	if (isPermissionsApiAvailable()) {
		return hasPermissionsForOrigins([TRANSLATE_API_ORIGIN]);
	}

	try {
		const response: unknown = await browser.runtime.sendMessage({
			action: API_ACTIONS.HAS_TRANSLATE_PERMISSION
		});
		return isHasPermissionResponse(response) ? response.hasPermission : false;
	} catch (error) {
		logger.error('Failed to check translate permission via messaging:', error);
		return false;
	}
}

// Request permission to use the Google Translate API
export async function requestTranslatePermission(): Promise<boolean> {
	if (isPermissionsApiAvailable()) {
		return requestPermissionsForOrigins([TRANSLATE_API_ORIGIN]);
	}

	try {
		const response: unknown = await browser.runtime.sendMessage({
			action: API_ACTIONS.REQUEST_TRANSLATE_PERMISSION
		});
		return isRequestPermissionResponse(response) ? response.granted : false;
	} catch (error) {
		logger.error('Failed to request translate permission via messaging:', error);
		return false;
	}
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
