import type {
	RobloxAuthChallenge,
	RobloxAuthLogoutAll,
	RobloxAuthSessionToken
} from '@/lib/types/api';
import { API_CONFIG } from '@/lib/types/constants';
import {
	parseRobloxAuthChallenge,
	parseRobloxAuthLogoutAll,
	parseRobloxAuthSessionToken
} from '@/lib/schemas/rotector';
import {
	clearStoredAuthToken,
	setStoredAuthProfile,
	setStoredAuthToken
} from '@/lib/utils/roblox-auth-storage';
import { makeHttpRequest } from '../http-client';

export async function requestRobloxAuthChallenge(
	robloxUserId: number
): Promise<RobloxAuthChallenge> {
	return makeHttpRequest(API_CONFIG.ENDPOINTS.AUTH_ROBLOX_CHALLENGE, {
		method: 'POST',
		body: JSON.stringify({ roblox_user_id: robloxUserId }),
		bearerOverride: { kind: 'none' },
		maxRetries: 1,
		parse: parseRobloxAuthChallenge
	});
}

async function persistSession(result: RobloxAuthSessionToken): Promise<RobloxAuthSessionToken> {
	await setStoredAuthToken(result.token, result.expires_at);
	await setStoredAuthProfile(result.profile);
	return result;
}

export async function verifyRobloxAuth(challengeId: string): Promise<RobloxAuthSessionToken> {
	const result = await makeHttpRequest(API_CONFIG.ENDPOINTS.AUTH_ROBLOX_VERIFY, {
		method: 'POST',
		body: JSON.stringify({ challenge_id: challengeId }),
		bearerOverride: { kind: 'none' },
		maxRetries: 1,
		parse: parseRobloxAuthSessionToken
	});
	return persistSession(result);
}

// Exchange a membership API key for a session token. Server requires the key
// in Authorization, so we route the membership key into Authorization via the
// override and skip the (absent) session bearer.
export async function exchangeMembershipForSession(): Promise<RobloxAuthSessionToken> {
	const result = await makeHttpRequest(API_CONFIG.ENDPOINTS.AUTH_ROBLOX_EXCHANGE, {
		method: 'POST',
		bearerOverride: { kind: 'membership' },
		maxRetries: 1,
		parse: parseRobloxAuthSessionToken
	});
	return persistSession(result);
}

export async function logoutRobloxAuth(): Promise<void> {
	try {
		await makeHttpRequest(API_CONFIG.ENDPOINTS.AUTH_ROBLOX_LOGOUT, {
			method: 'POST',
			maxRetries: 1
		});
	} finally {
		await clearStoredAuthToken();
	}
}

export async function logoutAllRobloxAuth(): Promise<RobloxAuthLogoutAll> {
	try {
		return await makeHttpRequest(API_CONFIG.ENDPOINTS.AUTH_ROBLOX_LOGOUT_ALL, {
			method: 'POST',
			maxRetries: 1,
			parse: parseRobloxAuthLogoutAll
		});
	} finally {
		await clearStoredAuthToken();
	}
}
