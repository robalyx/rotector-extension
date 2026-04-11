import { get, writable } from 'svelte/store';
import {
	STATS_CACHE_DURATION,
	STATS_CACHE_KEY_PREFIX,
	type ActivityHours,
	type StatsCache,
	type StatsResponse,
	type StatsState
} from '../types/stats';
import { logger } from '@/lib/utils/logger';

export const stats = writable<StatsResponse | null>(null);
export const statsState = writable<StatsState>('loading');
export const statsRange = writable<ActivityHours>(24);

function cacheKey(hours: ActivityHours): string {
	return `${STATS_CACHE_KEY_PREFIX}${hours}`;
}

async function getCachedStats(hours: ActivityHours): Promise<StatsResponse | null> {
	try {
		const key = cacheKey(hours);
		const result = await browser.storage.local.get([key]);
		const cache = result[key] as StatsCache | undefined;

		if (!cache) return null;
		if (Date.now() - cache.timestamp > STATS_CACHE_DURATION) return null;
		return cache.data;
	} catch (error) {
		logger.error('Failed to read stats cache:', error);
		return null;
	}
}

async function cacheStats(hours: ActivityHours, data: StatsResponse): Promise<void> {
	try {
		const key = cacheKey(hours);
		const cache: StatsCache = { data, timestamp: Date.now() };
		await browser.storage.local.set({ [key]: cache });
	} catch (error) {
		logger.error('Failed to cache stats:', error);
	}
}

async function fetchStatsFromAPI(hours: ActivityHours): Promise<StatsResponse> {
	const response: { success: boolean; error?: string; data?: StatsResponse } =
		await browser.runtime.sendMessage({
			action: 'getStats',
			hours
		});

	if (!response.success) {
		throw new Error(response.error ?? 'Failed to fetch stats');
	}
	if (!response.data) {
		throw new Error('No data returned from stats API');
	}
	return response.data;
}

export async function loadStats(
	hours: ActivityHours,
	forceRefresh: boolean = false
): Promise<void> {
	statsState.set('loading');

	try {
		let data: StatsResponse | null = null;

		if (!forceRefresh) {
			data = await getCachedStats(hours);
		}

		if (!data) {
			// Clear displayed stats before a network fetch so components don't render
			// values from a different range. Poll refreshes keep data to avoid flashing.
			if (!forceRefresh) {
				stats.set(null);
			}
			data = await fetchStatsFromAPI(hours);
			await cacheStats(hours, data);
		}

		// Drop stale response if the user switched range while we awaited
		if (get(statsRange) !== hours) return;

		stats.set(data);
		statsState.set(data.activity.entries.length === 0 ? 'empty' : 'loaded');
	} catch (error) {
		if (get(statsRange) !== hours) return;
		logger.error('Failed to load stats:', error);
		const currentStats = get(stats);
		if (!currentStats) {
			statsState.set('error');
		} else {
			statsState.set(currentStats.activity.entries.length === 0 ? 'empty' : 'loaded');
		}
	}
}
