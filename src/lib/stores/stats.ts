import { get, writable } from 'svelte/store';
import {
	STATS_CACHE_DURATION,
	STATS_CACHE_KEY_PREFIX,
	type ActivityHours,
	type StatsResponse,
	type StatsState
} from '../types/stats';
import { apiClient } from '../services/rotector/api-client';
import { logger } from '../utils/logging/logger';
import { createTtlCache } from '../utils/caching/ttl-cache';

export const stats = writable<StatsResponse | null>(null);
export const statsState = writable<StatsState>('loading');
export const statsRange = writable<ActivityHours>(24);

function cacheFor(hours: ActivityHours) {
	return createTtlCache<StatsResponse>(
		'local',
		`${STATS_CACHE_KEY_PREFIX}${String(hours)}`,
		STATS_CACHE_DURATION,
		`stats(${String(hours)}h)`
	);
}

// Drops the response if the user switched range mid-fetch and skips the null-flash on poll refreshes
export async function loadStats(hours: ActivityHours, forceRefresh = false): Promise<void> {
	statsState.set('loading');

	const cache = cacheFor(hours);
	try {
		let data: StatsResponse | null = null;

		if (!forceRefresh) {
			data = await cache.read();
		}

		if (!data) {
			// Clear displayed stats before a network fetch so components don't render
			// values from a different range. Poll refreshes keep data to avoid flashing.
			if (!forceRefresh) {
				stats.set(null);
			}
			data = await apiClient.getStats(hours);
			await cache.write(data);
		}

		// Drop stale response if the user switched range while we awaited
		if (get(statsRange) !== hours) return;

		stats.set(data);
		statsState.set(data.activity.entries.length === 0 ? 'empty' : 'loaded');
	} catch (error) {
		if (get(statsRange) !== hours) return;
		logger.error('Failed to load stats:', error);
		const currentStats = get(stats);
		statsState.set(
			currentStats ? (currentStats.activity.entries.length === 0 ? 'empty' : 'loaded') : 'error'
		);
	}
}
