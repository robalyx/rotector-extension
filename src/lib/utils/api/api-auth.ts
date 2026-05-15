import type { CustomApiConfig } from '../../types/custom-api';

// Returns the auth header pair for the configured scheme, empty when no key is set
export function buildCustomApiAuthHeaders(
	api: Pick<CustomApiConfig, 'apiKey' | 'authHeaderType'>
): Record<string, string> {
	const key = api.apiKey?.trim();
	if (!key) return {};

	switch (api.authHeaderType ?? 'x-auth-token') {
		case 'authorization-bearer': {
			return { Authorization: `Bearer ${key}` };
		}
		case 'authorization-plain': {
			return { Authorization: key };
		}
		case 'x-auth-token': {
			return { 'X-Auth-Token': key };
		}
	}
}
