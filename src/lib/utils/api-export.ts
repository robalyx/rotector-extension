import LZString from 'lz-string';
import type { CustomApiConfig } from '../types/custom-api';

// Exportable API configuration
interface ExportableApiConfig {
	name: string;
	url: string;
	enabled: boolean;
	timeout: number;
	reasonFormat?: 'numeric' | 'string';
	landscapeImageDataUrl?: string;
}

// Export a custom API configuration to a compressed base64 string
export function exportCustomApi(config: CustomApiConfig): string {
	// Strip runtime fields
	const exportable: ExportableApiConfig = {
		name: config.name,
		url: config.url,
		enabled: config.enabled,
		timeout: config.timeout,
		reasonFormat: config.reasonFormat,
		landscapeImageDataUrl: config.landscapeImageDataUrl
	};

	// Serialize to JSON
	const json = JSON.stringify(exportable);

	// Compress with lz-string
	const compressed = LZString.compressToBase64(json);

	return compressed;
}

// Import a custom API configuration from a compressed base64 string
export function importCustomApi(
	encodedData: string
): Omit<CustomApiConfig, 'id' | 'order' | 'createdAt'> {
	// Decompress
	const decompressed = LZString.decompressFromBase64(encodedData);

	if (!decompressed) {
		throw new Error('Failed to decompress API data. The encoded string may be corrupted.');
	}

	// Parse JSON
	let parsed: unknown;
	try {
		parsed = JSON.parse(decompressed);
	} catch (error) {
		throw new Error(
			`Failed to parse API data: ${error instanceof Error ? error.message : 'Invalid JSON'}`
		);
	}

	// Validate structure
	if (!parsed || typeof parsed !== 'object') {
		throw new Error('Invalid API data: Expected an object');
	}

	const data = parsed as Record<string, unknown>;

	// Validate required fields
	if (typeof data.name !== 'string') {
		throw new Error('Invalid API data: Missing or invalid "name" field');
	}

	if (typeof data.url !== 'string') {
		throw new Error('Invalid API data: Missing or invalid "url" field');
	}

	if (typeof data.enabled !== 'boolean') {
		throw new Error('Invalid API data: Missing or invalid "enabled" field');
	}

	if (typeof data.timeout !== 'number') {
		throw new Error('Invalid API data: Missing or invalid "timeout" field');
	}

	// Validate constraints
	if (data.name.length === 0 || data.name.length > 12) {
		throw new Error('Invalid API data: Name must be between 1 and 12 characters');
	}

	if (!data.url.startsWith('https://')) {
		throw new Error('Invalid API data: URL must use HTTPS protocol');
	}

	if (data.timeout < 1000 || data.timeout > 60000) {
		throw new Error('Invalid API data: Timeout must be between 1000 and 60000 milliseconds');
	}

	// Validate optional fields
	if (data.reasonFormat !== undefined) {
		if (data.reasonFormat !== 'numeric' && data.reasonFormat !== 'string') {
			throw new Error('Invalid API data: reasonFormat must be "numeric" or "string"');
		}
	}

	if (data.landscapeImageDataUrl !== undefined) {
		if (typeof data.landscapeImageDataUrl !== 'string') {
			throw new Error('Invalid API data: landscapeImageDataUrl must be a string');
		}
	}

	// Return validated config
	return {
		name: data.name,
		url: data.url,
		enabled: data.enabled,
		timeout: data.timeout,
		reasonFormat: data.reasonFormat,
		landscapeImageDataUrl: data.landscapeImageDataUrl
	};
}
