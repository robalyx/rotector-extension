import { get } from 'svelte/store';
import type { OutfitSnapshotResponse, OutfitSnapshotResult } from '../types/api';
import { apiClient } from './api-client';
import { settings } from '../stores/settings';
import { SETTINGS_KEYS } from '../types/settings';

type SnapshotMap = Map<string, OutfitSnapshotResult>;

interface SnapshotCacheEntry {
	map: SnapshotMap;
	timestamp: number;
}

interface SnapshotCache {
	[userId: string]: SnapshotCacheEntry;
}

class OutfitSnapshotService {
	private cache: SnapshotCache = {};
	private pendingRequests: Record<string, Promise<SnapshotMap>> = {};

	async getSnapshots(userId: string | number, names: string[]): Promise<SnapshotMap> {
		const normalizedUserId = this.normalizeUserId(userId);

		if (names.length === 0) {
			return new Map();
		}

		// Return cached subset if every requested name is already resolved
		const cached = this.getCachedEntry(normalizedUserId);
		if (cached && names.every((name) => cached.map.has(name))) {
			return this.buildSubset(cached.map, names);
		}

		// Deduplicate concurrent requests against the same user + name set
		const pendingKey = this.buildPendingKey(normalizedUserId, names);
		const existingPromise = this.pendingRequests[pendingKey];
		if (existingPromise !== undefined) {
			const fullMap = await existingPromise;
			return this.buildSubset(fullMap, names);
		}

		// Issue a fresh fetch and publish the in-flight promise for dedupe
		const promise = this.fetchAndCache(normalizedUserId, names);
		this.pendingRequests[pendingKey] = promise;

		try {
			const fullMap = await promise;
			return this.buildSubset(fullMap, names);
		} finally {
			delete this.pendingRequests[pendingKey];
		}
	}

	// Null slots in the returned array indicate per-URL fetch failures
	async fetchAdditionalImages(urls: string[]): Promise<Array<string | null>> {
		if (urls.length === 0) return [];
		return apiClient.fetchOutfitImages(urls);
	}

	// Fetches snapshots from the backend and persists cleanly-resolved entries
	private async fetchAndCache(userId: string, names: string[]): Promise<SnapshotMap> {
		const response: OutfitSnapshotResponse = await apiClient.lookupOutfitsByName(userId, names);

		// Return every fetched entry to the caller, including failures
		const fetchedMap: SnapshotMap = new Map();
		for (const entry of response.results) {
			fetchedMap.set(entry.name, entry);
		}

		// Merge successful entries into an existing cache bucket within TTL,
		// otherwise start a new bucket. Failures skip the cache entirely.
		const now = Date.now();
		const existing = this.cache[userId];
		const withinTtl = existing !== undefined && now - existing.timestamp <= this.getCacheTTL();

		if (withinTtl) {
			for (const [name, result] of fetchedMap) {
				if (!result.primaryFailed) {
					existing.map.set(name, result);
				}
			}
			existing.timestamp = now;
		} else {
			const bucket = new Map<string, OutfitSnapshotResult>();
			for (const [name, result] of fetchedMap) {
				if (!result.primaryFailed) {
					bucket.set(name, result);
				}
			}
			if (bucket.size > 0) {
				this.cache[userId] = { map: bucket, timestamp: now };
			}
		}

		return fetchedMap;
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

	// Projects a cached map down to the subset of names the caller requested
	private buildSubset(source: SnapshotMap, names: string[]): SnapshotMap {
		const subset: SnapshotMap = new Map();
		for (const name of names) {
			const entry = source.get(name);
			if (entry) {
				subset.set(name, entry);
			}
		}
		return subset;
	}

	// Deterministic dedup key so two concurrent callers with identical inputs
	// share the same in-flight promise instead of firing parallel requests
	private buildPendingKey(userId: string, names: string[]): string {
		const sorted = [...names].sort();
		return `${userId}:${sorted.join('|')}`;
	}

	private normalizeUserId(userId: string | number): string {
		return String(userId);
	}

	private getCacheTTL(): number {
		const currentSettings = get(settings);
		return currentSettings[SETTINGS_KEYS.CACHE_DURATION_MINUTES] * 60 * 1000;
	}
}

export const outfitSnapshotService = new OutfitSnapshotService();
