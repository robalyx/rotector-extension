/**
 * Data validation and sanitization utilities
 * Note: HTML escaping is handled by Svelte's XSS protection in {expression} syntax
 */
class Sanitizer {
	private static readonly ALLOWED_PROTOCOLS = ['http:', 'https:'];

	// Sanitizes entity ID input (users, groups)
	static sanitizeEntityId(entityId: string | number): string | null {
		try {
			const parsed = typeof entityId === 'string' ? parseInt(entityId, 10) : entityId;

			// Validate range (Roblox IDs are positive integers)
			if (isNaN(parsed) || parsed <= 0 || parsed > Number.MAX_SAFE_INTEGER) {
				return null;
			}

			return parsed.toString();
		} catch {
			return null;
		}
	}

	// Sanitizes URL for security validation
	static sanitizeUrl(url: string): string | null {
		if (!url) return null;

		try {
			const parsed = new URL(url);

			// Only allow http/https protocols
			if (!this.ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
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
	static extractErrorMessage(error: unknown): string {
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
}

export const sanitizeEntityId = (entityId: string | number) => Sanitizer.sanitizeEntityId(entityId);
export const sanitizeUrl = (url: string) => Sanitizer.sanitizeUrl(url);
export const extractErrorMessage = (error: unknown) => Sanitizer.extractErrorMessage(error);
