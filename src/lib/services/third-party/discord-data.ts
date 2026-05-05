import type { RobloxUserDiscordLookup } from '../../types/api';
import { apiClient } from '../rotector/api-client';
import { getCacheTtlMs } from '../../stores/settings';
import { DedupeCache } from '../../utils/caching/dedupe-cache';

const cache = new DedupeCache<string, RobloxUserDiscordLookup>(getCacheTtlMs);

export async function getDiscordData(userId: string | number): Promise<RobloxUserDiscordLookup> {
	const key = String(userId);
	return cache.get(key, () => apiClient.lookupRobloxUserDiscord(key));
}
