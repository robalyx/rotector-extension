import { get } from 'svelte/store';
import type { RobloxUserDiscordLookup } from '../types/api';
import { apiClient } from './api-client';
import { settings } from '../stores/settings';
import { SETTINGS_KEYS } from '../types/settings';

interface CacheEntry {
	data: RobloxUserDiscordLookup;
	timestamp: number;
}

class DiscordDataService {
	private cache: Record<string, CacheEntry> = {};
	private pendingRequests: Record<string, Promise<RobloxUserDiscordLookup>> = {};

	async getDiscordData(userId: string | number): Promise<RobloxUserDiscordLookup> {
		const key = String(userId);

		// Return cached data if still valid
		const cached = this.cache[key];
		if (cached && Date.now() - cached.timestamp <= this.getCacheTTL()) {
			return cached.data;
		}

		// Deduplicate concurrent requests
		if (key in this.pendingRequests) {
			return this.pendingRequests[key];
		}

		const promise = apiClient.lookupRobloxUserDiscord(key);
		this.pendingRequests[key] = promise;

		try {
			const data = await promise;
			this.cache[key] = { data, timestamp: Date.now() };
			return data;
		} finally {
			delete this.pendingRequests[key];
		}
	}

	private getCacheTTL(): number {
		const currentSettings = get(settings);
		const cacheDurationMinutes = currentSettings[SETTINGS_KEYS.CACHE_DURATION_MINUTES] || 5;
		return cacheDurationMinutes * 60 * 1000;
	}
}

export const discordDataService = new DiscordDataService();
