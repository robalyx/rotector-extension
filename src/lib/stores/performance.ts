import { derived, writable } from 'svelte/store';
import {
	TRACE_CATEGORIES,
	type CategoryStats,
	type PerformanceEntry,
	type TraceCategory
} from '../types/performance';

const PERFORMANCE_STORAGE_KEY = 'performanceEntries';
const MAX_ENTRIES = 200;

let writeQueue = Promise.resolve();

export const performanceEntries = writable<PerformanceEntry[]>([]);

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

// Load from storage
export async function loadPerformanceEntries(): Promise<void> {
	try {
		const result = await browser.storage.local.get([PERFORMANCE_STORAGE_KEY]);
		const stored = result[PERFORMANCE_STORAGE_KEY] as PerformanceEntry[] | undefined;
		performanceEntries.set(stored ?? []);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn('[Rotector] Failed to load performance entries:', error);
		performanceEntries.set([]);
	}
}

// Save to storage
async function savePerformanceEntries(entries: PerformanceEntry[]): Promise<void> {
	try {
		await browser.storage.local.set({ [PERFORMANCE_STORAGE_KEY]: entries });
		performanceEntries.set(entries);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn('[Rotector] Failed to save performance entries:', error);
	}
}

// Add a new entry
export async function addPerformanceEntry(entry: Omit<PerformanceEntry, 'id'>): Promise<void> {
	const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const newEntry: PerformanceEntry = { ...entry, id };

	writeQueue = writeQueue.then(async () => {
		const result = await browser.storage.local.get([PERFORMANCE_STORAGE_KEY]);
		const current = (result[PERFORMANCE_STORAGE_KEY] as PerformanceEntry[] | undefined) ?? [];
		const updated = [newEntry, ...current].slice(0, MAX_ENTRIES);
		await savePerformanceEntries(updated);
	});

	return writeQueue;
}

// Clear all entries
export async function clearPerformanceEntries(): Promise<void> {
	writeQueue = writeQueue.then(async () => savePerformanceEntries([]));
	return writeQueue;
}

// Listen for storage changes from other contexts
browser.storage.onChanged.addListener((changes, namespace) => {
	if (namespace === 'local' && changes[PERFORMANCE_STORAGE_KEY]) {
		const newValue = changes[PERFORMANCE_STORAGE_KEY].newValue as PerformanceEntry[] | undefined;
		performanceEntries.set(newValue ?? []);
	}
});
