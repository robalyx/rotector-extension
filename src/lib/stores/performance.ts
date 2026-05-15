import { derived } from 'svelte/store';
import { STORAGE_KEYS } from '../types/constants';
import {
	TRACE_CATEGORIES,
	type CategoryStats,
	type PerformanceEntry,
	type TraceCategory
} from '../types/performance';
import { generateLocalId } from '../utils/id';
import { createPersistentListStore } from './persistent-list-store';

const {
	store: performanceEntries,
	load: loadPerformanceEntries,
	add,
	clear: clearPerformanceEntries
} = createPersistentListStore<PerformanceEntry>({
	storageKey: STORAGE_KEYS.PERFORMANCE_ENTRIES,
	maxEntries: 200
});

export { performanceEntries, loadPerformanceEntries, clearPerformanceEntries };

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

export const slowestOperations = derived(performanceEntries, ($entries): PerformanceEntry[] => {
	return $entries.toSorted((a, b) => b.duration - a.duration).slice(0, 10);
});

// ID is auto-generated and callers pass everything else
export async function addPerformanceEntry(entry: Omit<PerformanceEntry, 'id'>): Promise<void> {
	return add({ ...entry, id: generateLocalId() });
}
