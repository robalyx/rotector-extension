import LZString from 'lz-string';
import * as v from 'valibot';
import type { CustomApiConfig } from '../../types/custom-api';
import { type ImportedApiConfig, parseImportedApiConfig } from '../../schemas/custom-api';

// Whitelists exportable fields then LZ-compresses to a base64 share string
export function exportCustomApi(config: CustomApiConfig): string {
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
