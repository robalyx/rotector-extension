import LZString from 'lz-string';
import * as v from 'valibot';
import { get } from 'svelte/store';
import type { CustomApiConfig } from '../../types/custom-api';
import { type ImportedApiConfig, parseImportedApiConfig } from '../../schemas/custom-api';
import { addCustomApi, customApis } from '../../stores/custom-apis';
import { logger } from '../logging/logger';

// Whitelists exportable fields then LZ-compresses to a base64 share string
function exportCustomApi(config: CustomApiConfig): string {
	const exportable: ImportedApiConfig = {
		name: config.name,
		singleUrl: config.singleUrl,
		batchUrl: config.batchUrl,
		enabled: config.enabled,
		timeout: config.timeout,
		reasonFormat: config.reasonFormat,
		landscapeImageDataUrl: config.landscapeImageDataUrl,
		authHeaderType: config.authHeaderType
	};
	return LZString.compressToBase64(JSON.stringify(exportable));
}

// Throws with a user-readable message on bad base64, bad JSON, or schema mismatch
export function importCustomApi(encodedData: string): ImportedApiConfig {
	const decompressed = LZString.decompressFromBase64(encodedData);
	if (!decompressed) {
		throw new Error('Failed to decompress API data. The encoded string may be corrupted.');
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(decompressed);
	} catch {
		throw new Error('Failed to parse API data: Invalid JSON');
	}

	try {
		return parseImportedApiConfig(parsed);
	} catch (error) {
		if (v.isValiError(error)) {
			throw new Error(`Invalid API data: ${error.issues[0].message}`, { cause: error });
		}
		throw error;
	}
}

// Compresses to a base64 string for share/transfer
export function exportApi(id: string): string {
	const current = get(customApis);

	const api = current.find((api) => api.id === id);
	if (!api) {
		throw new Error(`Custom API not found: ${id}`);
	}

	if (api.isSystem) {
		throw new Error('Cannot export system APIs');
	}

	return exportCustomApi(api);
}

// Imported APIs are forced to disabled so the user must opt in before traffic flows
export async function importApi(encodedData: string): Promise<CustomApiConfig> {
	const decodedConfig = importCustomApi(encodedData);

	const current = get(customApis);
	let newName = decodedConfig.name;
	let counter = 1;

	while (current.some((api) => api.name === newName)) {
		newName = `${decodedConfig.name} (${String(counter)})`;
		counter++;
	}

	const configToAdd = {
		...decodedConfig,
		name: newName,
		enabled: false
	};

	const newApi = await addCustomApi(configToAdd);

	logger.info('Imported custom API:', {
		id: newApi.id,
		originalName: decodedConfig.name,
		finalName: newName,
		wasRenamed: newName !== decodedConfig.name
	});

	return newApi;
}
