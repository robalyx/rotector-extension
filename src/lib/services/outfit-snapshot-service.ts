import { get } from 'svelte/store';
import type {
	OutfitSnapshotByIdResponse,
	OutfitSnapshotByNameResponse,
	OutfitSnapshotResult
} from '../types/api';
import { apiClient } from './api-client';
import { settings } from '../stores/settings';
import { SETTINGS_KEYS } from '../types/settings';

export type SnapshotKey = { kind: 'id'; id: string } | { kind: 'name'; name: string };

export interface SnapshotMaps {
	byId: Map<string, OutfitSnapshotResult>;
	byName: Map<string, OutfitSnapshotResult>;
}

interface SnapshotCacheEntry {
	maps: SnapshotMaps;
	timestamp: number;
}

interface SnapshotCache {
	[userId: string]: SnapshotCacheEntry;
}

class OutfitSnapshotService {
	private cache: SnapshotCache = {};
	private pendingRequests: Record<string, Promise<SnapshotMaps>> = {};

	async getSnapshots(userId: string | number, keys: SnapshotKey[]): Promise<SnapshotMaps> {
		const normalizedUserId = this.normalizeUserId(userId);

		if (keys.length === 0) {
			return emptyMaps();
		}

		const { ids, names } = this.splitKeys(keys);

		// Return cached subset if every requested id and name is already resolved
		const cached = this.getCachedEntry(normalizedUserId);
		if (
			cached &&
			ids.every((id) => cached.maps.byId.has(id)) &&
			names.every((name) => cached.maps.byName.has(name))
		) {
			return this.buildSubset(cached.maps, ids, names);
		}

		// Deduplicate concurrent requests against the same user + key set
		const pendingKey = this.buildPendingKey(normalizedUserId, ids, names);
		const existingPromise = this.pendingRequests[pendingKey];
		if (existingPromise !== undefined) {
			const fullMaps = await existingPromise;
			return this.buildSubset(fullMaps, ids, names);
		}

		// Issue a fresh fetch and publish the in-flight promise for dedupe
		const promise = this.fetchAndCache(normalizedUserId, ids, names);
		this.pendingRequests[pendingKey] = promise;

		try {
			const fullMaps = await promise;
			return this.buildSubset(fullMaps, ids, names);
		} finally {
			delete this.pendingRequests[pendingKey];
		}
	}

	// Null slots in the returned array indicate per-URL fetch failures
	async fetchAdditionalImages(urls: string[]): Promise<Array<string | null>> {
		if (urls.length === 0) return [];
		return apiClient.fetchOutfitImages(urls);
	}

	// Fetches snapshots from the backend and persists cleanly-resolved entries.
	// Only the actually-requested endpoints are called; any rejection propagates
	// so the caller's catch block surfaces the failure instead of silently
	// returning a partial result.
	private async fetchAndCache(
		userId: string,
		ids: string[],
		names: string[]
	): Promise<SnapshotMaps> {
		type FetchPart =
			| { kind: 'name'; response: OutfitSnapshotByNameResponse }
			| { kind: 'id'; response: OutfitSnapshotByIdResponse };

		const tasks: Array<Promise<FetchPart>> = [];
		if (names.length > 0) {
			tasks.push(
				apiClient
					.lookupOutfitsByName(userId, names)
					.then((response): FetchPart => ({ kind: 'name', response }))
			);
		}
		if (ids.length > 0) {
			tasks.push(
				apiClient
					.lookupOutfitsById(userId, ids)
					.then((response): FetchPart => ({ kind: 'id', response }))
			);
		}

		const parts = await Promise.all(tasks);

		const fetched = emptyMaps();
		for (const part of parts) {
			if (part.kind === 'name') {
				for (const entry of part.response.results) fetched.byName.set(entry.name, entry);
			} else {
				for (const entry of part.response.results) fetched.byId.set(entry.outfitId, entry);
			}
		}

		// Merge successful entries into an existing cache bucket within TTL,
		// otherwise start a new bucket. Failures skip the cache entirely.
		const now = Date.now();
		const existing = this.cache[userId];
		const withinTtl = existing !== undefined && now - existing.timestamp <= this.getCacheTTL();

		if (withinTtl) {
			mergeSuccess(existing.maps, fetched);
			existing.timestamp = now;
		} else {
			const bucket = emptyMaps();
			mergeSuccess(bucket, fetched);
			if (bucket.byId.size > 0 || bucket.byName.size > 0) {
				this.cache[userId] = { maps: bucket, timestamp: now };
			}
		}

		return fetched;
	}

	// Returns cached entry if still within TTL or null otherwise
	private getCachedEntry(userId: string): SnapshotCacheEntry | null {
		const entry = this.cache[userId];
		if (!entry) return null;

		if (Date.now() - entry.timestamp > this.getCacheTTL()) {
			delete this.cache[userId];
			return null;
		}

		return entry;
	}

	// Projects cached maps down to the subset of keys the caller requested
	private buildSubset(source: SnapshotMaps, ids: string[], names: string[]): SnapshotMaps {
		const subset = emptyMaps();
		for (const id of ids) {
			const entry = source.byId.get(id);
			if (entry) subset.byId.set(id, entry);
		}
		for (const name of names) {
			const entry = source.byName.get(name);
			if (entry) subset.byName.set(name, entry);
		}
		return subset;
	}

	// Deterministic dedup key so two concurrent callers with identical inputs
	// share the same in-flight promise instead of firing parallel requests
	private buildPendingKey(userId: string, ids: string[], names: string[]): string {
		const sortedIds = [...ids].sort();
		const sortedNames = [...names].sort();
		return `${userId}:ids=${sortedIds.join(',')}:names=${sortedNames.join(',')}`;
	}

	private splitKeys(keys: SnapshotKey[]): { ids: string[]; names: string[] } {
		const ids: string[] = [];
		const names: string[] = [];
		for (const key of keys) {
			if (key.kind === 'id') ids.push(key.id);
			else names.push(key.name);
		}
		return { ids, names };
	}

	private normalizeUserId(userId: string | number): string {
		return String(userId);
	}

	private getCacheTTL(): number {
		const currentSettings = get(settings);
		return currentSettings[SETTINGS_KEYS.CACHE_DURATION_MINUTES] * 60 * 1000;
	}
}

function emptyMaps(): SnapshotMaps {
	return { byId: new Map(), byName: new Map() };
}

function mergeSuccess(target: SnapshotMaps, source: SnapshotMaps): void {
	for (const [id, result] of source.byId) {
		if (!result.primaryFailed) target.byId.set(id, result);
	}
	for (const [name, result] of source.byName) {
		if (!result.primaryFailed) target.byName.set(name, result);
	}
}

export const outfitSnapshotService = new OutfitSnapshotService();
