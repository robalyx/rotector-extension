import { writable } from 'svelte/store';
import type { MembershipBadgeUpdatePayload, MembershipStatus } from '../types/api';
import { apiClient } from '../services/rotector/api-client';
import { SETTINGS_KEYS } from '../types/settings';
import { asApiError } from '../utils/api/api-error';
import { logger } from '../utils/logging/logger';
import { subscribeStorageKey } from '../utils/storage';
import { createTtlCache } from '../utils/caching/ttl-cache';
import { getStoredApiKey } from './settings';

type MembershipStoreState =
	| { kind: 'unknown' | 'no-key' | 'not-member' | 'invalid-key'; status: null }
	| { kind: 'member'; status: MembershipStatus };

const MEMBERSHIP_CACHE_DURATION = 5 * 60 * 1000;
const cache = createTtlCache<MembershipStoreState>(
	'local',
	'membershipStatusCache',
	MEMBERSHIP_CACHE_DURATION,
	'membership'
);

const INITIAL_STATE: MembershipStoreState = { kind: 'unknown', status: null };

export const membershipStore = writable<MembershipStoreState>(INITIAL_STATE);
export const membershipLoading = writable<boolean>(false);

let pendingLoad: Promise<void> | null = null;

function errorToState(error: unknown): MembershipStoreState {
	const status = asApiError(error).status;
	if (status === 403) return { kind: 'not-member', status: null };
	if (status === 401) return { kind: 'invalid-key', status: null };
	logger.error('Membership status request failed with unexpected error:', error);
	return { kind: 'unknown', status: null };
}

// Load membership status: cache hit wins, else fetch fresh from the backend
async function doLoad(forceRefresh: boolean): Promise<void> {
	const [apiKey, cached] = await Promise.all([
		getStoredApiKey(),
		forceRefresh ? Promise.resolve(null) : cache.read()
	]);
	if (!apiKey) {
		membershipStore.set({ kind: 'no-key', status: null });
		await cache.clear();
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
		await cache.write(state);
	} catch (error) {
		const state = errorToState(error);
		membershipStore.set(state);
		if (state.kind === 'not-member' || state.kind === 'invalid-key') {
			await cache.write(state);
		}
	} finally {
		membershipLoading.set(false);
	}
}

// Load membership status, deduping concurrent callers via an in-flight promise
export async function loadMembershipStatus(forceRefresh = false): Promise<void> {
	if (pendingLoad && !forceRefresh) return pendingLoad;

	// A forced refresh must wait for any in-flight load to settle as reusing the
	// existing promise would let the old key's stale response win
	const priorLoad = pendingLoad;
	const task = (async () => {
		if (priorLoad) await priorLoad.catch(() => {});
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
	await cache.write(state);
	return status;
}

// Clear the member's Roblox user assignment, leaving design fields intact
export async function clearBadge(): Promise<MembershipStatus> {
	const status = await apiClient.clearMembershipBadge();
	const state: MembershipStoreState = { kind: 'member', status };
	membershipStore.set(state);
	await cache.write(state);
	return status;
}

// Confirm the verification phrase is in the Roblox bio and link the account
export async function confirmVerification(robloxUserId: number): Promise<MembershipStatus> {
	const status = await apiClient.confirmMembershipVerification(robloxUserId);
	const state: MembershipStoreState = { kind: 'member', status };
	membershipStore.set(state);
	await cache.write(state);
	return status;
}

// Invalidate cache on API-key change because the oldValue/newValue guard dedups same-value writes
subscribeStorageKey<string>('sync', SETTINGS_KEYS.API_KEY, (newValue, oldValue) => {
	if (oldValue === newValue) return;
	void (async () => {
		await cache.clear();
		await loadMembershipStatus(true);
	})();
});
