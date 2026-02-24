import { writable, get } from 'svelte/store';
import type { CustomApiConfig } from '../types/custom-api';
import { SETTINGS_KEYS } from '../types/settings';
import { API_CONFIG } from '../types/constants';
import { logger } from '../utils/logger';
import { exportCustomApi, importCustomApi } from '../utils/api-export';
import { hasPermissionsForOrigins, extractOriginPattern } from '../utils/permissions';
import { getAssetUrl } from '../utils/assets';

// Maximum number of custom APIs allowed
export const MAX_CUSTOM_APIS = 5;

// Rotector system API configuration
export const ROTECTOR_API_ID = 'system-rotector';

// Create Rotector system API configuration
function createRotectorApiConfig(): CustomApiConfig {
	return {
		id: ROTECTOR_API_ID,
		name: 'Rotector',
		singleUrl: `${API_CONFIG.BASE_URL}/v1/lookup/roblox/user/{userId}`,
		batchUrl: `${API_CONFIG.BASE_URL}/v1/lookup/roblox/users`,
		enabled: true,
		timeout: API_CONFIG.TIMEOUT,
		order: -1, // Always first
		createdAt: 0,
		isSystem: true,
		reasonFormat: 'numeric',
		landscapeImageDataUrl: getAssetUrl('/assets/rotector-tab.webp')
	};
}

// Extract unique origins from a custom API's URLs
export function extractApiOrigins(api: CustomApiConfig): string[] {
	const origins: string[] = [];
	for (const url of [api.singleUrl, api.batchUrl]) {
		const origin = extractOriginPattern(url);
		if (origin && !origins.includes(origin)) {
			origins.push(origin);
		}
	}
	return origins;
}

// Store for custom API configurations
export const customApis = writable<CustomApiConfig[]>([]);

// Generate a unique ID for a new custom API
function generateCustomApiId(): string {
	return `custom-api-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Migrate legacy configs that used a single url field
function migrateApiConfig(api: Record<string, unknown>): CustomApiConfig {
	if ('url' in api && !('singleUrl' in api)) {
		const baseUrl = api.url as string;
		return {
			...(api as unknown as CustomApiConfig),
			singleUrl: `${baseUrl}/{userId}`,
			batchUrl: baseUrl
		};
	}
	return api as unknown as CustomApiConfig;
}

// Load custom APIs from storage and inject Rotector system API
export async function loadCustomApis(): Promise<void> {
	try {
		// Load user-created custom APIs
		const result = await browser.storage.local.get([SETTINGS_KEYS.CUSTOM_APIS]);
		const rawApis =
			(result[SETTINGS_KEYS.CUSTOM_APIS] as Array<Record<string, unknown>> | undefined) ?? [];

		// Migrate legacy configs and check if migration occurred
		const userApis = rawApis.map(migrateApiConfig);
		const needsMigration = rawApis.some((api) => 'url' in api && !('singleUrl' in api));

		// Initialize defaults or save migrated configs
		if (result[SETTINGS_KEYS.CUSTOM_APIS] === undefined) {
			await browser.storage.local.set({
				[SETTINGS_KEYS.CUSTOM_APIS]: []
			});
		} else if (needsMigration) {
			await browser.storage.local.set({
				[SETTINGS_KEYS.CUSTOM_APIS]: userApis
			});
			logger.info('Migrated custom API configs from legacy url field');
		}

		// Create Rotector system API and prepend it to the list
		const rotectorApi = createRotectorApiConfig();
		const allApis = [rotectorApi, ...userApis];

		customApis.set(allApis);
		logger.debug('Loaded APIs:', { total: allApis.length, userApis: userApis.length });
	} catch (error) {
		logger.error('Failed to load custom APIs:', error);
		throw error;
	}
}

// Save custom APIs to storage
async function saveCustomApis(apis: CustomApiConfig[]): Promise<void> {
	try {
		// Filter out system APIs
		const userApis = apis.filter((api) => !api.isSystem);
		await browser.storage.local.set({ [SETTINGS_KEYS.CUSTOM_APIS]: userApis });

		// Update store with all APIs
		customApis.set(apis);
		logger.debug('Saved custom APIs:', { total: apis.length, userApis: userApis.length });
	} catch (error) {
		logger.error('Failed to save custom APIs:', error);
		throw error;
	}
}

// Add a new custom API
export async function addCustomApi(
	config: Omit<CustomApiConfig, 'id' | 'order' | 'createdAt'>
): Promise<CustomApiConfig> {
	const current = get(customApis);

	// Count only user-created APIs
	const userApiCount = current.filter((api) => !api.isSystem).length;
	if (userApiCount >= MAX_CUSTOM_APIS) {
		throw new Error(`Maximum of ${MAX_CUSTOM_APIS} custom APIs allowed`);
	}

	// Check permissions before enabling API
	let finalEnabled = config.enabled;
	if (config.enabled) {
		const origins = extractApiOrigins(config as CustomApiConfig);
		if (origins.length === 0) {
			logger.error('Failed to extract origins from API URLs');
			finalEnabled = false;
		} else {
			const hasPermissions = await hasPermissionsForOrigins(origins);
			if (!hasPermissions) {
				finalEnabled = false;
				logger.info('Auto-disabled custom API due to missing permissions:', {
					name: config.name,
					origins
				});
			}
		}
	}

	const newApi: CustomApiConfig = {
		...config,
		enabled: finalEnabled,
		id: generateCustomApiId(),
		order: current.length,
		createdAt: Date.now()
	};

	const updated = [...current, newApi];
	await saveCustomApis(updated);

	logger.info('Added custom API:', { id: newApi.id, name: newApi.name, enabled: finalEnabled });
	return newApi;
}

// Update an existing custom API
export async function updateCustomApi(
	id: string,
	updates: Partial<Omit<CustomApiConfig, 'id' | 'order' | 'createdAt'>>
): Promise<void> {
	const current = get(customApis);

	const index = current.findIndex((api) => api.id === id);
	if (index === -1) {
		throw new Error(`Custom API not found: ${id}`);
	}

	// Prevent updating system APIs
	if (current[index].isSystem) {
		throw new Error('Cannot modify system APIs');
	}

	// Check permissions when enabling a custom API
	if (updates.enabled === true && !current[index].isSystem) {
		const merged = { ...current[index], ...updates };
		const origins = extractApiOrigins(merged);
		if (origins.length === 0) {
			throw new Error('INVALID_URL');
		}

		const hasPermissions = await hasPermissionsForOrigins(origins);
		if (!hasPermissions) {
			throw new Error('PERMISSIONS_REQUIRED');
		}
	}

	const updated = [...current];
	updated[index] = { ...updated[index], ...updates };

	await saveCustomApis(updated);
	logger.info('Updated custom API:', { id, updates });
}

// Delete a custom API
export async function deleteCustomApi(id: string): Promise<void> {
	const current = get(customApis);

	const api = current.find((api) => api.id === id);
	if (!api) {
		throw new Error(`Custom API not found: ${id}`);
	}

	// Prevent deleting system APIs
	if (api.isSystem) {
		throw new Error('Cannot delete system APIs');
	}

	const filtered = current.filter((api) => api.id !== id);

	// Reorder remaining APIs
	const reordered = filtered.map((api, index) => ({
		...api,
		order: index
	}));

	await saveCustomApis(reordered);
	logger.info('Deleted custom API:', { id });
}

// Reorder a custom API (move up or down)
export async function reorderCustomApi(id: string, direction: 'up' | 'down'): Promise<void> {
	const current = get(customApis);

	const index = current.findIndex((api) => api.id === id);
	if (index === -1) {
		throw new Error(`Custom API not found: ${id}`);
	}

	// Prevent reordering system APIs
	if (current[index].isSystem) {
		throw new Error('Cannot reorder system APIs');
	}

	const newIndex = direction === 'up' ? index - 1 : index + 1;

	// Prevent moving into system API positions
	if (newIndex < 0 || newIndex >= current.length || current[newIndex].isSystem) {
		return;
	}

	const updated = [...current];
	[updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];

	// Update order values
	const reordered = updated.map((api, idx) => ({
		...api,
		order: idx
	}));

	await saveCustomApis(reordered);
	logger.info('Reordered custom API:', { id, direction, from: index, to: newIndex });
}

// Test custom API connection with user queries
export async function testCustomApiConnection(
	singleUrl: string,
	batchUrl: string,
	apiKey?: string
): Promise<boolean> {
	const testUserId = '1';
	const authHeaders: HeadersInit = apiKey?.trim() ? { 'X-Auth-Token': apiKey.trim() } : {};

	try {
		// Test 1: Single user lookup (GET)
		const singleTestUrl = singleUrl.replace('{userId}', testUserId);
		const singleResponse = await fetch(singleTestUrl, {
			method: 'GET',
			headers: authHeaders,
			signal: AbortSignal.timeout(5000)
		});

		if (!singleResponse.ok) {
			logger.debug('Single user lookup test failed:', {
				url: singleTestUrl,
				status: singleResponse.status
			});
			return false;
		}

		const singleData = (await singleResponse.json()) as unknown;

		// Validate wrapper format
		if (
			!singleData ||
			typeof singleData !== 'object' ||
			!('success' in singleData) ||
			!('data' in singleData)
		) {
			logger.debug('Single user lookup returned invalid wrapper format:', { url: singleTestUrl });
			return false;
		}

		const singleWrapped = singleData as { success: boolean; data?: unknown };
		if (!singleWrapped.success || !singleWrapped.data) {
			logger.debug('Single user lookup returned unsuccessful response:', { url: singleTestUrl });
			return false;
		}

		// Validate user status schema
		const singleValidation = validateUserStatusResponse(singleWrapped.data);
		if (!singleValidation.valid) {
			logger.debug('Single user lookup returned invalid schema:', {
				url: singleTestUrl,
				errors: singleValidation.errors
			});
			return false;
		}

		// Test 2: Batch user lookup (POST)
		const batchResponse = await fetch(batchUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...authHeaders
			},
			body: JSON.stringify({ ids: [1] }),
			signal: AbortSignal.timeout(5000)
		});

		if (!batchResponse.ok) {
			logger.debug('Batch user lookup test failed:', {
				url: batchUrl,
				status: batchResponse.status
			});
			return false;
		}

		const batchData = (await batchResponse.json()) as unknown;

		// Validate wrapper format
		if (
			!batchData ||
			typeof batchData !== 'object' ||
			!('success' in batchData) ||
			!('data' in batchData)
		) {
			logger.debug('Batch user lookup returned invalid wrapper format:', { url: batchUrl });
			return false;
		}

		const batchWrapped = batchData as { success: boolean; data?: unknown };
		if (!batchWrapped.success || !batchWrapped.data) {
			logger.debug('Batch user lookup returned unsuccessful response:', { url: batchUrl });
			return false;
		}

		// Validate batch response is an object with user IDs as keys
		if (
			typeof batchWrapped.data !== 'object' ||
			Array.isArray(batchWrapped.data) ||
			batchWrapped.data === null
		) {
			logger.debug('Batch user lookup returned invalid data format:', { url: batchUrl });
			return false;
		}

		// Validate each user status in the batch
		const batchStatuses = Object.values(batchWrapped.data);
		for (const status of batchStatuses) {
			const validation = validateUserStatusResponse(status);
			if (!validation.valid) {
				logger.debug('Batch user lookup returned invalid status schema:', {
					url: batchUrl,
					errors: validation.errors
				});
				return false;
			}
		}

		logger.debug('Custom API connection test passed:', { singleUrl, batchUrl });
		return true;
	} catch (error) {
		logger.error('Custom API connection test failed:', { singleUrl, batchUrl, error });
		return false;
	}
}

// Update test result for a custom API
export async function updateTestResult(id: string, success: boolean): Promise<void> {
	await updateCustomApi(id, {
		lastTested: Date.now(),
		lastTestSuccess: success
	});
}

// Validate UserStatus response schema
export function validateUserStatusResponse(response: unknown): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	if (!response || typeof response !== 'object') {
		errors.push('Response must be an object');
		return { valid: false, errors };
	}

	const data = response as Record<string, unknown>;

	// Required fields
	if (typeof data.id !== 'number') {
		errors.push('Missing or invalid "id" field (must be number)');
	}

	if (typeof data.flagType !== 'number') {
		errors.push('Missing or invalid "flagType" field (must be number)');
	}

	// Confidence is optional
	if (data.confidence !== undefined && typeof data.confidence !== 'number') {
		errors.push('Invalid "confidence" field (must be number if present)');
	}

	// Optional fields validation
	if (data.reasons !== undefined) {
		if (typeof data.reasons !== 'object' || data.reasons === null) {
			errors.push('Invalid "reasons" field (must be object)');
		}
	}

	if (data.badges !== undefined) {
		if (!Array.isArray(data.badges)) {
			errors.push('Invalid "badges" field (must be array)');
		} else {
			if (data.badges.length > 3) {
				errors.push('Too many badges (maximum 3 allowed)');
			}

			// Validate each badge object
			data.badges.forEach((badge, index) => {
				if (!badge || typeof badge !== 'object') {
					errors.push(`Badge at index ${index} must be an object`);
					return;
				}

				const badgeObj = badge as Record<string, unknown>;

				if (typeof badgeObj.text !== 'string') {
					errors.push(`Badge at index ${index} missing required "text" field (must be string)`);
				}

				if (badgeObj.color !== undefined && typeof badgeObj.color !== 'string') {
					errors.push(
						`Badge at index ${index} has invalid "color" field (must be string if present)`
					);
				}

				if (badgeObj.textColor !== undefined && typeof badgeObj.textColor !== 'string') {
					errors.push(
						`Badge at index ${index} has invalid "textColor" field (must be string if present)`
					);
				}
			});
		}
	}

	return {
		valid: errors.length === 0,
		errors
	};
}

// Export a custom API configuration to a compressed string
export function exportApi(id: string): string {
	const current = get(customApis);

	const api = current.find((api) => api.id === id);
	if (!api) {
		throw new Error(`Custom API not found: ${id}`);
	}

	// Prevent exporting system APIs
	if (api.isSystem) {
		throw new Error('Cannot export system APIs');
	}

	return exportCustomApi(api);
}

// Import a custom API configuration from a compressed string
export async function importApi(encodedData: string): Promise<CustomApiConfig> {
	// Decode and validate the imported data
	const decodedConfig = importCustomApi(encodedData);

	// Check for duplicate names and auto-rename if needed
	const current = get(customApis);
	let newName = decodedConfig.name;
	let counter = 1;

	while (current.some((api) => api.name === newName)) {
		newName = `${decodedConfig.name} (${counter})`;
		counter++;
	}

	// Apply the new name and force disabled for safety
	const configToAdd = {
		...decodedConfig,
		name: newName,
		enabled: false
	};

	// Add the API using existing function
	const newApi = await addCustomApi(configToAdd);

	logger.info('Imported custom API:', {
		id: newApi.id,
		originalName: decodedConfig.name,
		finalName: newName,
		wasRenamed: newName !== decodedConfig.name
	});

	return newApi;
}
