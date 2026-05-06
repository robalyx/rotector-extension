import { derived } from 'svelte/store';
import { STORAGE_KEYS } from '../types/constants';
import type { MetricsSnapshot } from '../types/performance';
import { createPersistentListStore } from './persistent-list-store';

const {
	store: metricsSnapshots,
	load: loadMetricsSnapshots,
	add: addMetricsSnapshot,
	clear: clearMetricsSnapshots
} = createPersistentListStore<MetricsSnapshot>({
	storageKey: STORAGE_KEYS.METRICS_SNAPSHOTS,
	maxEntries: 100
});

export { loadMetricsSnapshots, addMetricsSnapshot, clearMetricsSnapshots };

export const latestSnapshot = derived(metricsSnapshots, ($snapshots): MetricsSnapshot | null => {
	const periodic = $snapshots.find((s) => s.type !== 'longtask');
	return periodic ?? null;
});

export const longTaskCount = derived(
	metricsSnapshots,
	($snapshots) => $snapshots.filter((s) => s.type === 'longtask').length
);

export const recentLongTasks = derived(metricsSnapshots, ($snapshots): MetricsSnapshot[] =>
	$snapshots.filter((s) => s.type === 'longtask').slice(0, 10)
);
