import type {
	MeProfile,
	MeRefreshResult,
	MeSession,
	MeSettingsPatch,
	MeSettingsResponse
} from '@/lib/types/api';
import { API_CONFIG } from '@/lib/types/constants';
import {
	parseMeProfile,
	parseMeRefresh,
	parseMeSessions,
	parseMeSettingsResponse
} from '@/lib/schemas/rotector';
import { makeHttpRequest } from '../http-client';

export async function getMeProfile(): Promise<MeProfile> {
	return makeHttpRequest(API_CONFIG.ENDPOINTS.ME_PROFILE, {
		method: 'GET',
		parse: parseMeProfile
	});
}

export async function updateMeSettings(patch: MeSettingsPatch): Promise<MeSettingsResponse> {
	const body: Record<string, unknown> = {};
	if ('alias' in patch) body['alias'] = patch.alias ?? null;
	if (patch.show_username !== undefined) body['show_username'] = patch.show_username;
	if (patch.show_thumbnail !== undefined) body['show_thumbnail'] = patch.show_thumbnail;
	return makeHttpRequest(API_CONFIG.ENDPOINTS.ME_SETTINGS, {
		method: 'PATCH',
		body: JSON.stringify(body),
		maxRetries: 1,
		parse: parseMeSettingsResponse
	});
}

export async function refreshMeIdentity(): Promise<MeRefreshResult> {
	return makeHttpRequest(API_CONFIG.ENDPOINTS.ME_REFRESH, {
		method: 'POST',
		maxRetries: 1,
		parse: parseMeRefresh
	});
}

export async function listMeSessions(): Promise<MeSession[]> {
	return makeHttpRequest(API_CONFIG.ENDPOINTS.ME_SESSIONS, {
		method: 'GET',
		parse: parseMeSessions
	});
}

export async function revokeMeSession(sessionId: string): Promise<void> {
	await makeHttpRequest(`${API_CONFIG.ENDPOINTS.ME_SESSIONS}/${sessionId}`, {
		method: 'DELETE',
		maxRetries: 1
	});
}
