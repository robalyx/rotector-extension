import { derived, writable } from 'svelte/store';
import type { MetricsSnapshot } from '../types/performance';

const METRICS_STORAGE_KEY = 'metricsSnapshots';
const MAX_SNAPSHOTS = 100;

let writeQueue = Promise.resolve();

const metricsSnapshots = writable<MetricsSnapshot[]>([]);

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

// Load from storage
export async function loadMetricsSnapshots(): Promise<void> {
	try {
		const result = await browser.storage.local.get([METRICS_STORAGE_KEY]);
		const stored = result[METRICS_STORAGE_KEY] as MetricsSnapshot[] | undefined;
		metricsSnapshots.set(stored ?? []);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn('[Rotector] Failed to load metrics snapshots:', error);
		metricsSnapshots.set([]);
	}
}

// Save to storage
async function saveMetricsSnapshots(snapshots: MetricsSnapshot[]): Promise<void> {
	try {
		await browser.storage.local.set({ [METRICS_STORAGE_KEY]: snapshots });
		metricsSnapshots.set(snapshots);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn('[Rotector] Failed to save metrics snapshots:', error);
	}
}

// Add a new snapshot
export async function addMetricsSnapshot(snapshot: MetricsSnapshot): Promise<void> {
	writeQueue = writeQueue.then(async () => {
		const result = await browser.storage.local.get([METRICS_STORAGE_KEY]);
		const current = (result[METRICS_STORAGE_KEY] as MetricsSnapshot[] | undefined) ?? [];
		const updated = [snapshot, ...current].slice(0, MAX_SNAPSHOTS);
		await saveMetricsSnapshots(updated);
	});

	return writeQueue;
}

// Clear all snapshots
export async function clearMetricsSnapshots(): Promise<void> {
	writeQueue = writeQueue.then(async () => saveMetricsSnapshots([]));
	return writeQueue;
}

// Listen for storage changes from other contexts
browser.storage.onChanged.addListener((changes, namespace) => {
	if (namespace === 'local' && changes[METRICS_STORAGE_KEY]) {
		const newValue = changes[METRICS_STORAGE_KEY].newValue as MetricsSnapshot[] | undefined;
		metricsSnapshots.set(newValue ?? []);
	}
});
