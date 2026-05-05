import type {
	OutfitSnapshotByIdResponse,
	OutfitSnapshotByNameResponse,
	OutfitSnapshotResult
} from '../../types/api';
import { apiClient } from '../rotector/api-client';
import { getCacheTtlMs } from '../../stores/settings';

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

	// Serves cached subset when complete, otherwise dedupes concurrent fetches by sorted-key signature and merges results
	async getSnapshots(userId: string | number, keys: SnapshotKey[]): Promise<SnapshotMaps> {
		const normalizedUserId = String(userId);

		if (keys.length === 0) {
			return emptyMaps();
		}

		const ids: string[] = [];
		const names: string[] = [];
		for (const key of keys) {
			if (key.kind === 'id') ids.push(key.id);
			else names.push(key.name);
		}

		const ttl = getCacheTtlMs();
		const existing = this.cache[normalizedUserId];
		const cached = existing && Date.now() - existing.timestamp <= ttl ? existing : null;
		if (!cached && existing) delete this.cache[normalizedUserId];

		if (
			cached &&
			ids.every((id) => cached.maps.byId.has(id)) &&
			names.every((name) => cached.maps.byName.has(name))
		) {
			return this.buildSubset(cached.maps, ids, names);
		}

		const sortedIds = [...ids].sort();
		const sortedNames = [...names].sort();
		const pendingKey = `${normalizedUserId}:ids=${sortedIds.join(',')}:names=${sortedNames.join(',')}`;
		const existingPromise = this.pendingRequests[pendingKey];
		if (existingPromise !== undefined) {
			const fullMaps = await existingPromise;
			return this.buildSubset(fullMaps, ids, names);
		}

		const promise = this.fetchAndCache(normalizedUserId, ids, names);
		this.pendingRequests[pendingKey] = promise;

		try {
			const fullMaps = await promise;
			return this.buildSubset(fullMaps, ids, names);
		} finally {
			delete this.pendingRequests[pendingKey];
		}
	}

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

		const now = Date.now();
		const ttl = getCacheTtlMs();
		const existing = this.cache[userId];
		const withinTtl = existing !== undefined && now - existing.timestamp <= ttl;

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
