import LZString from 'lz-string';
import type { CustomApiAuthHeaderType, CustomApiConfig } from '../types/custom-api';

const AUTH_HEADER_TYPES: readonly CustomApiAuthHeaderType[] = [
	'x-auth-token',
	'authorization-bearer',
	'authorization-plain'
];

// Exportable API configuration
interface ExportableApiConfig {
	name: string;
	singleUrl: string;
	batchUrl: string;
	enabled: boolean;
	timeout: number;
	reasonFormat?: 'numeric' | 'string' | undefined;
	landscapeImageDataUrl?: string | undefined;
	authHeaderType?: CustomApiAuthHeaderType | undefined;
}

// Export a custom API configuration to a compressed base64 string
export function exportCustomApi(config: CustomApiConfig): string {
	// Strip runtime fields
	const exportable: ExportableApiConfig = {
		name: config.name,
		singleUrl: config.singleUrl,
		batchUrl: config.batchUrl,
		enabled: config.enabled,
		timeout: config.timeout,
		reasonFormat: config.reasonFormat,
		landscapeImageDataUrl: config.landscapeImageDataUrl,
		authHeaderType: config.authHeaderType
	};

	// Serialize to JSON
	const json = JSON.stringify(exportable);

	// Compress with lz-string
	return LZString.compressToBase64(json);
}

// Decompress + parse JSON payload, throw helpful error on malformed input
function decodeImportPayload(encodedData: string): Record<string, unknown> {
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

	if (!parsed || typeof parsed !== 'object') {
		throw new Error('Invalid API data: Expected an object');
	}

	return parsed as Record<string, unknown>;
}

type ImportedApiConfig = Omit<CustomApiConfig, 'id' | 'order' | 'createdAt'>;

// Parse + validate required fields, returning a narrowed object
function parseRequiredFields(data: Record<string, unknown>): {
	name: string;
	singleUrl: string;
	batchUrl: string;
	enabled: boolean;
	timeout: number;
} {
	if (typeof data['name'] !== 'string') {
		throw new Error('Invalid API data: Missing or invalid "name" field');
	}
	if (typeof data['singleUrl'] !== 'string') {
		throw new Error('Invalid API data: Missing or invalid "singleUrl" field');
	}
	if (typeof data['batchUrl'] !== 'string') {
		throw new Error('Invalid API data: Missing or invalid "batchUrl" field');
	}
	if (typeof data['enabled'] !== 'boolean') {
		throw new Error('Invalid API data: Missing or invalid "enabled" field');
	}
	if (typeof data['timeout'] !== 'number') {
		throw new Error('Invalid API data: Missing or invalid "timeout" field');
	}
	return {
		name: data['name'],
		singleUrl: data['singleUrl'],
		batchUrl: data['batchUrl'],
		enabled: data['enabled'],
		timeout: data['timeout']
	};
}

// Throw on constraint violations (length, URL protocol, timeout range)
function assertConstraints(required: ReturnType<typeof parseRequiredFields>): void {
	const { name, singleUrl, batchUrl, timeout } = required;

	if (name.length === 0 || name.length > 12) {
		throw new Error('Invalid API data: Name must be between 1 and 12 characters');
	}
	if (!singleUrl.startsWith('https://')) {
		throw new Error('Invalid API data: Single URL must use HTTPS protocol');
	}
	if (!singleUrl.includes('{userId}')) {
		throw new Error('Invalid API data: Single URL must contain {userId} placeholder');
	}
	if (!batchUrl.startsWith('https://')) {
		throw new Error('Invalid API data: Batch URL must use HTTPS protocol');
	}
	if (timeout < 1000 || timeout > 60000) {
		throw new Error('Invalid API data: Timeout must be between 1000 and 60000 milliseconds');
	}
}

// Parse + validate optional fields, returning a narrowed object
function parseOptionalFields(data: Record<string, unknown>): {
	reasonFormat: 'numeric' | 'string' | undefined;
	landscapeImageDataUrl: string | undefined;
	authHeaderType: CustomApiAuthHeaderType | undefined;
} {
	const reasonFormat = data['reasonFormat'];
	if (reasonFormat !== undefined && reasonFormat !== 'numeric' && reasonFormat !== 'string') {
		throw new Error('Invalid API data: reasonFormat must be "numeric" or "string"');
	}

	const landscapeImageDataUrl = data['landscapeImageDataUrl'];
	if (landscapeImageDataUrl !== undefined && typeof landscapeImageDataUrl !== 'string') {
		throw new Error('Invalid API data: landscapeImageDataUrl must be a string');
	}

	const authHeaderType = data['authHeaderType'];
	if (
		authHeaderType !== undefined &&
		(typeof authHeaderType !== 'string' ||
			!AUTH_HEADER_TYPES.includes(authHeaderType as CustomApiAuthHeaderType))
	) {
		throw new Error(
			'Invalid API data: authHeaderType must be one of x-auth-token, authorization-bearer, authorization-plain'
		);
	}

	return {
		reasonFormat,
		landscapeImageDataUrl,
		authHeaderType: authHeaderType as CustomApiAuthHeaderType | undefined
	};
}

// Import a custom API configuration from a compressed base64 string
export function importCustomApi(encodedData: string): ImportedApiConfig {
	const data = decodeImportPayload(encodedData);
	const required = parseRequiredFields(data);
	assertConstraints(required);
	const optional = parseOptionalFields(data);

	return { ...required, ...optional };
}
