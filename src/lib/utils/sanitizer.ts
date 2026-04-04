/**
 * Data validation and sanitization utilities
 * Note: HTML escaping is handled by Svelte's XSS protection in {expression} syntax
 */

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

// Sanitizes entity ID input
export function sanitizeEntityId(entityId: string | number): string | null {
	const parsed = typeof entityId === 'string' ? parseInt(entityId, 10) : entityId;

	// Validate range
	if (isNaN(parsed) || parsed <= 0 || parsed > Number.MAX_SAFE_INTEGER) {
		return null;
	}

	return parsed.toString();
}

// Sanitizes URL for security validation
export function sanitizeUrl(url: string): string | null {
	if (!url) return null;

	try {
		const parsed = new URL(url);

		// Allow http/https protocols only
		if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
			return null;
		}

		// Check for roblox domain
		if (!parsed.hostname.includes('roblox.com')) {
			return null;
		}

		return parsed.href;
	} catch {
		return null;
	}
}

// Extracts error message from error objects
export function extractErrorMessage(error: unknown): string {
	if (!error) return 'An unknown error occurred';

	let message: string;

	if (typeof error === 'string') {
		message = error;
	} else if (error && typeof error === 'object') {
		const errorObj = error as Record<string, unknown>;
		if (typeof errorObj.message === 'string') {
			message = errorObj.message;
		} else if (typeof errorObj.error === 'string') {
			message = errorObj.error;
		} else {
			message = 'An unknown error occurred';
		}
	} else {
		message = 'An unknown error occurred';
	}

	return message.length > 200 ? `${message.slice(0, 200)}...` : message;
}
