import * as v from 'valibot';
import type { RobloxAuthProfile } from '@/lib/types/api';
import { RobloxAuthProfileSchema } from '@/lib/schemas/rotector';
import { getStorage, removeStorage, setStorage, setStorageMulti } from './storage';

export const LOCAL_KEY_ROBLOX_AUTH_TOKEN = 'robloxAuthToken';
export const LOCAL_KEY_ROBLOX_AUTH_EXPIRES_AT = 'robloxAuthExpiresAt';
export const LOCAL_KEY_ROBLOX_AUTH_PROFILE = 'robloxAuthProfile';

const MIN_BUMP_SECONDS = 60;

export async function getStoredAuthToken(): Promise<string | null> {
	return (await getStorage<string>('local', LOCAL_KEY_ROBLOX_AUTH_TOKEN, '')) || null;
}

export async function getStoredAuthExpiresAt(): Promise<number | null> {
	return (await getStorage<number>('local', LOCAL_KEY_ROBLOX_AUTH_EXPIRES_AT, 0)) || null;
}

export async function setStoredAuthToken(token: string, expiresAt: number): Promise<void> {
	await setStorageMulti('local', {
		[LOCAL_KEY_ROBLOX_AUTH_TOKEN]: token,
		[LOCAL_KEY_ROBLOX_AUTH_EXPIRES_AT]: expiresAt
	});
}

export async function clearStoredAuthToken(): Promise<void> {
	await removeStorage('local', [
		LOCAL_KEY_ROBLOX_AUTH_TOKEN,
		LOCAL_KEY_ROBLOX_AUTH_EXPIRES_AT,
		LOCAL_KEY_ROBLOX_AUTH_PROFILE
	]);
}

// Only writes when the new expiry beats the stored value by at least MIN_BUMP_SECONDS
// because the server may bump the same value on every authed request
export async function bumpStoredAuthExpires(newExpiresAt: number): Promise<void> {
	const current = await getStoredAuthExpiresAt();
	if (current !== null && newExpiresAt - current < MIN_BUMP_SECONDS) return;
	await setStorage('local', LOCAL_KEY_ROBLOX_AUTH_EXPIRES_AT, newExpiresAt);
}

export async function getStoredAuthProfile(): Promise<RobloxAuthProfile | null> {
	const stored = await getStorage<unknown>('local', LOCAL_KEY_ROBLOX_AUTH_PROFILE, undefined);
	if (stored === undefined) return null;
	const result = v.safeParse(RobloxAuthProfileSchema, stored);
	return result.success ? result.output : null;
}

export async function setStoredAuthProfile(profile: RobloxAuthProfile): Promise<void> {
	await setStorage('local', LOCAL_KEY_ROBLOX_AUTH_PROFILE, profile);
}
