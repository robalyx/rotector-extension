import { derived } from 'svelte/store';
import {
	TRACE_CATEGORIES,
	type CategoryStats,
	type PerformanceEntry,
	type TraceCategory
} from '../types/performance';
import { createPersistentListStore } from './persistent-list-store';

const {
	store: performanceEntriesStore,
	load,
	add,
	clear
} = createPersistentListStore<PerformanceEntry>({
	storageKey: 'performanceEntries',
	maxEntries: 200
});

export const performanceEntries = performanceEntriesStore;

// Aggregate stats by category
export const categoryStats = derived(performanceEntries, ($entries): CategoryStats[] => {
	const categories = Object.values(TRACE_CATEGORIES) as TraceCategory[];

	return categories
		.map((category) => {
			const categoryEntries = $entries.filter((e) => e.category === category);
			if (categoryEntries.length === 0) {
				return null;
			}

			const durations = categoryEntries.map((e) => e.duration);
			const total = durations.reduce((a, b) => a + b, 0);

			return {
				category,
				count: categoryEntries.length,
				totalDuration: total,
				avgDuration: total / durations.length,
				minDuration: Math.min(...durations),
				maxDuration: Math.max(...durations)
			};
		})
		.filter((s): s is CategoryStats => s !== null);
});

// Top 10 slowest operations
export const slowestOperations = derived(performanceEntries, ($entries): PerformanceEntry[] => {
	return [...$entries].sort((a, b) => b.duration - a.duration).slice(0, 10);
});

export const loadPerformanceEntries = load;
export const clearPerformanceEntries = clear;

// Add a new entry with auto-generated ID
export async function addPerformanceEntry(entry: Omit<PerformanceEntry, 'id'>): Promise<void> {
	const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	return add({ ...entry, id });
}
