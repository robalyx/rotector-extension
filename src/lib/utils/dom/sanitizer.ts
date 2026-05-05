const ALLOWED_PROTOCOLS = ['http:', 'https:'];

// Returns null for non-positive, NaN, or beyond-safe-integer ids so callers can fail closed
export function sanitizeEntityId(entityId: string | number): string | null {
	const parsed = typeof entityId === 'string' ? parseInt(entityId, 10) : entityId;

	if (isNaN(parsed) || parsed <= 0 || parsed > Number.MAX_SAFE_INTEGER) {
		return null;
	}

	return parsed.toString();
}

// Throws on invalid input so background endpoint handlers fail-fast at the boundary
export function validateEntityId(entityId: string | number): string {
	const sanitized = sanitizeEntityId(entityId);
	if (!sanitized) {
		throw new Error('Invalid entity ID');
	}
	return sanitized;
}

// Sanitizes a batch and throws if nothing survives
export function processBatchEntityIds(entityIds: Array<string | number>): string[] {
	const sanitized = entityIds
		.map((id) => sanitizeEntityId(id))
		.filter((id): id is string => id !== null);

	if (sanitized.length === 0) {
		throw new Error('No valid entity IDs provided for batch check');
	}
	return sanitized;
}

// Runs `pattern` against `url` and returns the first capture group as a sanitized entity ID
export function extractIdFromUrl(url: string, pattern: RegExp): string | null {
	const id = pattern.exec(url)?.[1];
	return id ? sanitizeEntityId(id) : null;
}

// Returns null unless the url parses, is http or https, and resolves to a roblox.com host
export function sanitizeUrl(url: string): string | null {
	if (!url) return null;

	try {
		const parsed = new URL(url);

		if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
			return null;
		}

		if (!parsed.hostname.includes('roblox.com')) {
			return null;
		}

		return parsed.href;
	} catch {
		return null;
	}
}

export function extractErrorMessage(error: unknown): string {
	const message =
		error instanceof Error
			? error.message
			: typeof error === 'string'
				? error
				: 'An unknown error occurred';

	return message.length > 200 ? `${message.slice(0, 200)}...` : message;
}
