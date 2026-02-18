import { get } from 'svelte/store';
import type { VoteData } from '../types/api';
import { apiClient } from './api-client';
import { logger } from '../utils/logger';
import { settings } from '../stores/settings';
import { SETTINGS_KEYS } from '../types/settings';

interface VoteDataCache {
	[userId: string]: {
		data: VoteData;
		timestamp: number;
	};
}

class VoteDataService {
	private cache: VoteDataCache = {};
	private pendingRequests: Record<string, Promise<VoteData>> = {};

	async getVoteData(userId: string): Promise<VoteData> {
		const numericUserId = this.normalizeUserId(userId);

		// Return cached data if still valid
		const cachedData = this.getCachedVoteData(numericUserId);
		if (cachedData) {
			return cachedData;
		}

		// Deduplicate concurrent requests
		if (numericUserId in this.pendingRequests) {
			return this.pendingRequests[numericUserId];
		}

		const promise = apiClient.getVotes(numericUserId);
		this.pendingRequests[numericUserId] = promise;

		try {
			const data = await promise;
			this.cache[numericUserId] = { data, timestamp: Date.now() };
			return data;
		} catch (error) {
			logger.error('VoteDataService: failed to fetch vote data', {
				userId: numericUserId,
				error
			});
			throw error;
		} finally {
			delete this.pendingRequests[numericUserId];
		}
	}

	// Returns cached vote data if still within TTL, null otherwise
	getCachedVoteData(userId: string): VoteData | null {
		const numericUserId = this.normalizeUserId(userId);
		const cached = this.cache[numericUserId];

		if (!cached) return null;

		if (Date.now() - cached.timestamp > this.getCacheTTL()) {
			delete this.cache[numericUserId];
			return null;
		}

		return cached.data;
	}

	// Updates cache after a vote submission
	updateCachedVoteData(userId: string, newData: VoteData): void {
		const numericUserId = this.normalizeUserId(userId);
		this.cache[numericUserId] = { data: newData, timestamp: Date.now() };
	}

	private getCacheTTL(): number {
		const currentSettings = get(settings);
		const cacheDurationMinutes = currentSettings[SETTINGS_KEYS.CACHE_DURATION_MINUTES] || 5;
		return cacheDurationMinutes * 60 * 1000;
	}

	private normalizeUserId(userId: string | number): string {
		return String(userId);
	}
}

export const voteDataService = new VoteDataService();
