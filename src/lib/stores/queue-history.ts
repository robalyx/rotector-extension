import { derived, get, writable } from 'svelte/store';
import type { QueueHistoryEntry, QueueStatusItem } from '../types/queue-history';
import { logger } from '@/lib/utils/logger';

const QUEUE_HISTORY_KEY = 'queueHistory';
const MAX_HISTORY_SIZE = 50;

export const queueHistory = writable<QueueHistoryEntry[]>([]);

// Entries that are still being processed
export const unprocessedEntries = derived(queueHistory, ($history) =>
	$history.filter((entry) => !entry.processed)
);

// Count of unprocessed entries
export const unprocessedCount = derived(unprocessedEntries, ($unprocessed) => $unprocessed.length);

// Read current entries from persistent storage
async function readFromStorage(): Promise<QueueHistoryEntry[]> {
	const result = await browser.storage.local.get([QUEUE_HISTORY_KEY]);
	return (result[QUEUE_HISTORY_KEY] as QueueHistoryEntry[] | undefined) ?? [];
}

// Load history from storage into the in-memory store
export async function loadQueueHistory(): Promise<void> {
	try {
		queueHistory.set(await readFromStorage());
	} catch (error) {
		logger.error('Failed to load queue history:', error);
		queueHistory.set([]);
	}
}

// Save history to storage
async function saveQueueHistory(entries: QueueHistoryEntry[]): Promise<void> {
	try {
		await browser.storage.local.set({ [QUEUE_HISTORY_KEY]: entries });
		queueHistory.set(entries);
	} catch (error) {
		logger.error('Failed to save queue history:', error);
		throw error;
	}
}

// Add new entry when user is queued
export async function addQueueEntry(userId: number): Promise<void> {
	const current = await readFromStorage();

	const existingIndex = current.findIndex((e) => e.userId === userId);

	const newEntry: QueueHistoryEntry = {
		userId,
		queuedAt: Date.now(),
		processed: false,
		processedAt: null,
		processing: false,
		flagged: false,
		notified: false
	};

	let updated: QueueHistoryEntry[];

	if (existingIndex !== -1) {
		// Update existing entry with new queue time and move to front
		updated = [...current];
		updated[existingIndex] = newEntry;
		updated = [
			updated[existingIndex],
			...updated.slice(0, existingIndex),
			...updated.slice(existingIndex + 1)
		];
	} else {
		// Add new entry at front and remove oldest if at limit
		updated = [newEntry, ...current];
		if (updated.length > MAX_HISTORY_SIZE) {
			updated = updated.slice(0, MAX_HISTORY_SIZE);
		}
	}

	await saveQueueHistory(updated);
	logger.debug('Added queue history entry:', { userId });
}

// Update entry status from API response
export async function updateEntryStatus(
	userId: number,
	status: QueueStatusItem
): Promise<QueueHistoryEntry | null> {
	const current = await readFromStorage();
	const index = current.findIndex((e) => e.userId === userId);
	const entry = current[index];
	if (!entry) return null;

	// Skip save if nothing changed
	if (
		entry.processed === status.processed &&
		entry.processing === status.processing &&
		entry.flagged === status.flagged
	) {
		return null;
	}

	const wasProcessed = entry.processed;

	const updated = [...current];
	updated[index] = {
		...entry,
		processed: status.processed,
		processedAt: status.processed_at ? status.processed_at * 1000 : null, // Convert seconds to ms
		processing: status.processing,
		flagged: status.flagged
	};

	await saveQueueHistory(updated);

	if (!wasProcessed && status.processed) {
		return updated[index];
	}

	return null;
}

// Mark entry as notified to prevent duplicate notifications
export async function markAsNotified(userId: number): Promise<void> {
	const current = await readFromStorage();
	const index = current.findIndex((e) => e.userId === userId);
	const entry = current[index];
	if (!entry) return;

	const updated = [...current];
	updated[index] = { ...entry, notified: true };

	await saveQueueHistory(updated);
}

// Remove single entry
export async function removeQueueEntry(userId: number): Promise<void> {
	const current = await readFromStorage();
	const updated = current.filter((e) => e.userId !== userId);
	await saveQueueHistory(updated);
	logger.debug('Removed queue history entry:', { userId });
}

// Clear all history
export async function clearQueueHistory(): Promise<void> {
	await saveQueueHistory([]);
	logger.debug('Cleared all queue history');
}

// Check if a user is in the queue and not yet processed
export function isUserBeingProcessed(userId: number): boolean {
	const current = get(queueHistory);
	const entry = current.find((e) => e.userId === userId);
	return entry !== undefined && !entry.processed;
}

// Check if any of the given user IDs are being processed
export function getUnprocessedUserIds(userIds: number[]): number[] {
	const current = get(queueHistory);
	const unprocessedSet = new Set(current.filter((e) => !e.processed).map((e) => e.userId));
	return userIds.filter((id) => unprocessedSet.has(id));
}

// Listen for storage changes from other contexts
browser.storage.onChanged.addListener((changes, namespace) => {
	if (namespace === 'local' && changes[QUEUE_HISTORY_KEY]) {
		const newValue = changes[QUEUE_HISTORY_KEY].newValue as QueueHistoryEntry[] | undefined;
		queueHistory.set(newValue ?? []);
	}
});
