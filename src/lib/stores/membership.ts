import { writable } from 'svelte/store';
import type { MembershipBadgeUpdatePayload, MembershipStatus } from '../types/api';
import { apiClient } from '../services/api-client';
import { SETTINGS_KEYS } from '../types/settings';
import { logger } from '../utils/logger';
import { getStoredApiKey } from './settings';

type MembershipStoreState =
	| { kind: 'unknown' | 'no-key' | 'not-member' | 'invalid-key'; status: null }
	| { kind: 'member'; status: MembershipStatus };

interface MembershipCache {
	state: MembershipStoreState;
	timestamp: number;
}

const MEMBERSHIP_CACHE_KEY = 'membershipStatusCache';
const MEMBERSHIP_CACHE_DURATION = 5 * 60 * 1000;

const INITIAL_STATE: MembershipStoreState = { kind: 'unknown', status: null };

export const membershipStore = writable<MembershipStoreState>(INITIAL_STATE);
export const membershipLoading = writable<boolean>(false);

let pendingLoad: Promise<void> | null = null;

// Read the cached membership state, returning null if missing or past the TTL
async function readCache(): Promise<MembershipStoreState | null> {
	try {
		const result = await browser.storage.local.get([MEMBERSHIP_CACHE_KEY]);
		const cache = result[MEMBERSHIP_CACHE_KEY] as MembershipCache | undefined;
		if (!cache) return null;
		if (Date.now() - cache.timestamp > MEMBERSHIP_CACHE_DURATION) return null;
		return cache.state;
	} catch (error) {
		logger.error('Failed to read membership cache:', error);
		return null;
	}
}

// Persist the current membership state under the TTL-stamped cache key
async function writeCache(state: MembershipStoreState): Promise<void> {
	try {
		const cache: MembershipCache = { state, timestamp: Date.now() };
		await browser.storage.local.set({ [MEMBERSHIP_CACHE_KEY]: cache });
	} catch (error) {
		logger.error('Failed to write membership cache:', error);
	}
}

// Drop the cached membership state (used on sign-out and API-key change)
async function clearCache(): Promise<void> {
	try {
		await browser.storage.local.remove([MEMBERSHIP_CACHE_KEY]);
	} catch (error) {
		logger.error('Failed to clear membership cache:', error);
	}
}

// Translate API errors into store states
function errorToState(error: unknown): MembershipStoreState {
	const err = error as Error & { status?: number };
	if (err.status === 403) return { kind: 'not-member', status: null };
	if (err.status === 401) return { kind: 'invalid-key', status: null };
	logger.error('Membership status request failed with unexpected error:', error);
	return { kind: 'unknown', status: null };
}

// Load membership status: cache hit wins, else fetch fresh from the backend
async function doLoad(forceRefresh: boolean): Promise<void> {
	const [apiKey, cached] = await Promise.all([
		getStoredApiKey(),
		forceRefresh ? Promise.resolve(null) : readCache()
	]);
	if (!apiKey) {
		membershipStore.set({ kind: 'no-key', status: null });
		await clearCache();
		return;
	}
	if (cached) {
		membershipStore.set(cached);
		return;
	}

	membershipLoading.set(true);
	try {
		const status = await apiClient.getMembershipStatus();
		const state: MembershipStoreState = { kind: 'member', status };
		membershipStore.set(state);
		await writeCache(state);
	} catch (error) {
		const state = errorToState(error);
		membershipStore.set(state);
		if (state.kind === 'not-member' || state.kind === 'invalid-key') {
			await writeCache(state);
		}
	} finally {
		membershipLoading.set(false);
	}
}

// Load membership status, deduping concurrent callers via an in-flight promise
export async function loadMembershipStatus(forceRefresh: boolean = false): Promise<void> {
	if (pendingLoad && !forceRefresh) return pendingLoad;

	// A forced refresh must wait for any in-flight load to settle as reusing the
	// existing promise would let the old key's stale response win.
	const priorLoad = pendingLoad;
	const task = (async () => {
		if (priorLoad) await priorLoad.catch(() => undefined);
		await doLoad(forceRefresh);
	})();
	pendingLoad = task.finally(() => {
		if (pendingLoad === task) pendingLoad = null;
	});
	return pendingLoad;
}

// Update one or more axes of the member's badge design via the Rotector API
export async function updateBadge(
	payload: MembershipBadgeUpdatePayload
): Promise<MembershipStatus> {
	const status = await apiClient.updateMembershipBadge(payload);
	const state: MembershipStoreState = { kind: 'member', status };
	membershipStore.set(state);
	await writeCache(state);
	return status;
}

// Clear the member's Roblox user assignment, leaving design fields intact
export async function clearBadge(): Promise<MembershipStatus> {
	const status = await apiClient.clearMembershipBadge();
	const state: MembershipStoreState = { kind: 'member', status };
	membershipStore.set(state);
	await writeCache(state);
	return status;
}

// Invalidate cache on API-key change; the oldValue/newValue guard dedups same-value writes.
browser.storage.onChanged.addListener((changes, namespace) => {
	if (namespace !== 'sync') return;
	const change = changes[SETTINGS_KEYS.API_KEY];
	if (!change) return;
	if (change.oldValue === change.newValue) return;
	void (async () => {
		await clearCache();
		await loadMembershipStatus(true);
	})();
});
