import { get, writable } from 'svelte/store';
import type {
	MeProfile,
	MeSession,
	MeSettingsPatch,
	RobloxAuthChallenge,
	RobloxAuthProfile,
	RobloxAuthSessionToken
} from '../types/api';
import { SETTINGS_KEYS } from '../types/settings';
import { apiClient } from '../services/rotector/api-client';
import { asApiError, getErrorDetailCode } from '../utils/api/api-error';
import { logger } from '../utils/logging/logger';
import {
	LOCAL_KEY_ROBLOX_AUTH_EXPIRES_AT,
	LOCAL_KEY_ROBLOX_AUTH_PROFILE,
	LOCAL_KEY_ROBLOX_AUTH_TOKEN,
	getStoredAuthExpiresAt,
	getStoredAuthProfile,
	getStoredAuthToken,
	setStoredAuthProfile
} from '../utils/roblox-auth-storage';
import { subscribeStorageKey } from '../utils/storage';
import { settings } from './settings';

type RobloxAuthState =
	| { kind: 'loading' }
	| { kind: 'signed-out' }
	| {
			kind: 'signed-in';
			expiresAt: number;
			profile: MeProfile | null; // null until first /me/profile fetch hydrates it
			cachedProfile: RobloxAuthProfile | null;
	  };

const INITIAL_STATE: RobloxAuthState = { kind: 'loading' };
const SIGNED_OUT: RobloxAuthState = { kind: 'signed-out' };

export const robloxAuthStore = writable<RobloxAuthState>(INITIAL_STATE);

let initialized = false;
let pendingExchangeOnce = false;

function toCachedProfile(profile: MeProfile): RobloxAuthProfile {
	return {
		roblox_user_id: profile.roblox_user_id,
		username: profile.username,
		display_name: profile.display_name,
		thumbnail_url: profile.thumbnail_url,
		alias: profile.alias
	};
}

// Mirror the in-memory cached profile to local storage so the next popup boot
// renders the user's current alias and thumbnail on first paint instead of
// flashing the version that was cached on the original sign-in.
function persistCachedProfile(cached: RobloxAuthProfile): void {
	void setStoredAuthProfile(cached).catch((error: unknown) => {
		logger.debug('Failed to persist cached Roblox profile:', error);
	});
}

async function hydrateFromStorage(): Promise<void> {
	const [token, expiresAt, cachedProfile] = await Promise.all([
		getStoredAuthToken(),
		getStoredAuthExpiresAt(),
		getStoredAuthProfile()
	]);
	if (!token || !expiresAt) {
		robloxAuthStore.set(SIGNED_OUT);
		return;
	}
	robloxAuthStore.set({
		kind: 'signed-in',
		expiresAt,
		profile: null,
		cachedProfile
	});
}

// Initial load + subscribe to cross-context storage changes (e.g. content
// script logs the user out while the popup is open).
async function initRobloxAuth(): Promise<void> {
	if (initialized) return;
	initialized = true;

	await hydrateFromStorage();

	subscribeStorageKey<string>('local', LOCAL_KEY_ROBLOX_AUTH_TOKEN, (newValue) => {
		void (async () => {
			if (!newValue) {
				robloxAuthStore.set(SIGNED_OUT);
				return;
			}
			await hydrateFromStorage();
		})();
	});

	subscribeStorageKey<number>('local', LOCAL_KEY_ROBLOX_AUTH_EXPIRES_AT, (newValue) => {
		if (newValue === undefined) return;
		robloxAuthStore.update((state) =>
			state.kind === 'signed-in' ? { ...state, expiresAt: newValue } : state
		);
	});

	subscribeStorageKey<unknown>('local', LOCAL_KEY_ROBLOX_AUTH_PROFILE, () => {
		void (async () => {
			const cachedProfile = await getStoredAuthProfile();
			robloxAuthStore.update((state) =>
				state.kind === 'signed-in' ? { ...state, cachedProfile } : state
			);
		})();
	});
}

// Hydrate from storage, try a silent membership-exchange when signed-out,
// then refresh the cached /me/profile when signed-in. Idempotent — safe to
// call from any surface that needs the auth store warm before rendering.
let pendingBootstrap: Promise<void> | null = null;
export function bootstrapRobloxAuth(): Promise<void> {
	if (pendingBootstrap) return pendingBootstrap;
	pendingBootstrap = (async () => {
		await initRobloxAuth();
		if (get(robloxAuthStore).kind === 'signed-out') {
			await tryExchangeFromMembership();
		}
		if (get(robloxAuthStore).kind === 'signed-in') {
			await refreshProfile().catch((error: unknown) => {
				logger.debug('Failed to refresh Roblox auth profile:', error);
			});
		}
	})();
	return pendingBootstrap;
}

export async function requestChallenge(robloxUserId: number): Promise<RobloxAuthChallenge> {
	return apiClient.requestRobloxAuthChallenge(robloxUserId);
}

export async function confirmChallenge(challengeId: string): Promise<RobloxAuthSessionToken> {
	const session = await apiClient.verifyRobloxAuth(challengeId);
	robloxAuthStore.set({
		kind: 'signed-in',
		expiresAt: session.expires_at,
		profile: null,
		cachedProfile: session.profile
	});
	return session;
}

// Best-effort exchange: if the user has a membership API key linked to Roblox,
// trade it for a session token silently. Called once per popup session.
async function tryExchangeFromMembership(): Promise<boolean> {
	if (pendingExchangeOnce) return false;
	pendingExchangeOnce = true;

	const state = get(robloxAuthStore);
	if (state.kind === 'signed-in') return true;
	if (!hasMembershipApiKey()) return false;

	try {
		const session = await apiClient.exchangeMembershipForSession();
		robloxAuthStore.set({
			kind: 'signed-in',
			expiresAt: session.expires_at,
			profile: null,
			cachedProfile: session.profile
		});
		return true;
	} catch (error) {
		const err = asApiError(error);
		if (
			getErrorDetailCode(err) === 'MEMBERSHIP_NOT_LINKED' ||
			err.status === 401 ||
			err.status === 403
		) {
			return false;
		}
		logger.debug('Roblox auth exchange failed:', err);
		return false;
	}
}

export async function refreshProfile(): Promise<MeProfile | null> {
	const state = get(robloxAuthStore);
	if (state.kind !== 'signed-in') return null;

	try {
		const profile = await apiClient.getMeProfile();
		const cachedProfile = toCachedProfile(profile);
		persistCachedProfile(cachedProfile);
		robloxAuthStore.update((s) => (s.kind === 'signed-in' ? { ...s, profile, cachedProfile } : s));
		return profile;
	} catch (error) {
		const err = asApiError(error);
		if (err.status === 401) {
			robloxAuthStore.set(SIGNED_OUT);
			return null;
		}
		throw err;
	}
}

export async function refreshIdentity(): Promise<MeProfile | null> {
	const state = get(robloxAuthStore);
	if (state.kind !== 'signed-in') return null;

	const refreshed = await apiClient.refreshMeIdentity();
	robloxAuthStore.update((s) => {
		if (s.kind !== 'signed-in') return s;
		const robloxUserId = s.cachedProfile?.roblox_user_id ?? s.profile?.roblox_user_id;
		// No anchored user id means the signed-in state is incomplete so bail rather
		// than fabricate a zero id that would corrupt the cached profile downstream.
		if (!robloxUserId) return s;
		const merged: MeProfile | null = s.profile
			? {
					...s.profile,
					username: refreshed.username,
					display_name: refreshed.display_name,
					thumbnail_url: refreshed.thumbnail_url
				}
			: null;
		const cachedProfile: RobloxAuthProfile = {
			roblox_user_id: robloxUserId,
			username: refreshed.username,
			display_name: refreshed.display_name,
			thumbnail_url: refreshed.thumbnail_url,
			alias: merged?.alias ?? s.cachedProfile?.alias ?? null
		};
		return { ...s, profile: merged, cachedProfile };
	});
	const after = get(robloxAuthStore);
	if (after.kind === 'signed-in' && after.cachedProfile) {
		persistCachedProfile(after.cachedProfile);
	}
	return after.kind === 'signed-in' ? after.profile : null;
}

export async function updateSettings(patch: MeSettingsPatch): Promise<void> {
	const updated = await apiClient.updateMeSettings(patch);
	// Server echoes only the three settings fields; merge them into the cached
	// profile so the rest of MeProfile (stats, fetched_at, identity) stays intact.
	robloxAuthStore.update((s) => {
		if (s.kind !== 'signed-in' || !s.profile) return s;
		const profile = { ...s.profile, ...updated };
		return { ...s, profile, cachedProfile: toCachedProfile(profile) };
	});
	const after = get(robloxAuthStore);
	if (after.kind === 'signed-in' && after.cachedProfile) {
		persistCachedProfile(after.cachedProfile);
	}
}

export async function signOut(): Promise<void> {
	try {
		await apiClient.logoutRobloxAuth();
	} catch (error) {
		logger.warn('Roblox auth logout call failed:', error);
	}
	robloxAuthStore.set(SIGNED_OUT);
}

export async function signOutAll(): Promise<number> {
	const result = await apiClient.logoutAllRobloxAuth();
	robloxAuthStore.set(SIGNED_OUT);
	return result.revoked_sessions;
}

export async function listSessions(): Promise<MeSession[]> {
	return apiClient.listMeSessions();
}

export async function revokeSession(sessionId: string): Promise<void> {
	await apiClient.revokeMeSession(sessionId);
}

function hasMembershipApiKey(): boolean {
	const value = get(settings)[SETTINGS_KEYS.API_KEY];
	return typeof value === 'string' && value.trim().length > 0;
}
