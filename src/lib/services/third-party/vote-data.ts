import type { VoteData } from '../../types/api';
import { apiClient } from '../rotector/api-client';
import { getCacheTtlMs } from '../../stores/settings';
import { DedupeCache } from '../../utils/caching/dedupe-cache';

const cache = new DedupeCache<string, VoteData>(getCacheTtlMs);

export async function getVoteData(userId: string | number): Promise<VoteData> {
	const key = String(userId);
	return cache.get(key, () => apiClient.getVotes(key));
}

export function updateCachedVoteData(userId: string | number, newData: VoteData): void {
	cache.set(String(userId), newData);
}
