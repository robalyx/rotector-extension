import { derived } from 'svelte/store';
import type { MetricsSnapshot } from '../types/performance';
import { createPersistentListStore } from './persistent-list-store';

const {
	store: metricsSnapshots,
	load,
	add,
	clear
} = createPersistentListStore<MetricsSnapshot>({
	storageKey: 'metricsSnapshots',
	maxEntries: 100
});

// Latest snapshot for current values display
export const latestSnapshot = derived(metricsSnapshots, ($snapshots): MetricsSnapshot | null => {
	const periodic = $snapshots.find((s) => s.type !== 'longtask');
	return periodic ?? null;
});

// Count of long task events
export const longTaskCount = derived(
	metricsSnapshots,
	($snapshots) => $snapshots.filter((s) => s.type === 'longtask').length
);

// Recent long tasks for display
export const recentLongTasks = derived(metricsSnapshots, ($snapshots): MetricsSnapshot[] =>
	$snapshots.filter((s) => s.type === 'longtask').slice(0, 10)
);

export const loadMetricsSnapshots = load;
export const addMetricsSnapshot = add;
export const clearMetricsSnapshots = clear;
