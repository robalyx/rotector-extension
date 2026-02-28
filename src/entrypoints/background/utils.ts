import type { ApiResponse } from '@/lib/types/api';
import { SETTINGS_DEFAULTS, SETTINGS_KEYS } from '@/lib/types/settings';
import { logger } from '@/lib/utils/logger';
import { extractErrorMessage, sanitizeEntityId } from '@/lib/utils/sanitizer';
import { loadCustomApis } from '@/lib/stores/custom-apis';

// Validates and sanitizes an entity ID (user or group)
export function validateEntityId(entityId: string | number): string {
	const sanitized = sanitizeEntityId(entityId);
	if (!sanitized) {
		throw new Error('Invalid entity ID');
	}
	return sanitized;
}

// Extracts response data from API responses
export function extractResponseData<T>(response: unknown): T {
	if (typeof response === 'object' && response !== null && 'data' in response) {
		return (response as { data: T }).data;
	}
	return response as T;
}

// Processes and validates batch entity IDs
export function processBatchEntityIds(entityIds: Array<string | number>): string[] {
	const sanitized = entityIds
		.map((id) => sanitizeEntityId(id))
		.filter((id): id is string => id !== null);

	if (sanitized.length === 0) {
		throw new Error('No valid entity IDs provided for batch check');
	}
	return sanitized;
}

// Gets the advanced violation info setting from storage
export async function getExcludeAdvancedInfoSetting(): Promise<boolean> {
	const settings = await browser.storage.sync.get([SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED]);
	return !settings[SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED];
}

// Creates a standardized error response with optional error properties
export function createErrorResponse(error: Error): ApiResponse & {
	requestId?: string;
	code?: string;
	type?: string;
	status?: number;
	rateLimitReset?: number;
} {
	const errorMessage = extractErrorMessage(error);
	const errorObj = error as Error & {
		requestId?: string;
		code?: string;
		type?: string;
		status?: number;
		rateLimitReset?: number;
	};

	return {
		success: false,
		error: errorMessage,
		...(errorObj.requestId && { requestId: errorObj.requestId }),
		...(errorObj.code && { code: errorObj.code }),
		...(errorObj.type && { type: errorObj.type }),
		...(errorObj.status !== undefined && { status: errorObj.status }),
		...(errorObj.rateLimitReset && { rateLimitReset: errorObj.rateLimitReset })
	};
}

// Initialize settings on first install
export async function initializeSettings(): Promise<void> {
	try {
		const existingSettings = await browser.storage.sync.get(Object.keys(SETTINGS_DEFAULTS));
		const missingSettings: Partial<typeof SETTINGS_DEFAULTS> = {};

		for (const [key, defaultValue] of Object.entries(SETTINGS_DEFAULTS)) {
			if (!(key in existingSettings)) {
				(missingSettings as Record<string, unknown>)[key] = defaultValue;
			}
		}

		if (Object.keys(missingSettings).length > 0) {
			await browser.storage.sync.set(missingSettings);
			logger.info('Background: Initialized missing settings', missingSettings);
		} else {
			logger.debug('Background: All settings already initialized');
		}

		// Load custom APIs configuration
		await loadCustomApis();
		logger.debug('Background: Custom APIs loaded');
	} catch (error) {
		logger.error('Background: Failed to initialize settings:', error);
	}
}
