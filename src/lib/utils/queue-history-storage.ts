import type { QueueHistoryEntry, QueueStatusItem } from '@/lib/types/queue-history';
import { getStorage, setStorage } from '@/lib/utils/storage';
import { incrementSuccessfulFlagCount } from '@/lib/utils/review-prompt-storage';

export const QUEUE_HISTORY_KEY = 'queueHistory';
const MAX_QUEUE_HISTORY_SIZE = 50;

export async function readQueueHistory(): Promise<QueueHistoryEntry[]> {
	return getStorage<QueueHistoryEntry[]>('local', QUEUE_HISTORY_KEY, []);
}

async function writeQueueHistory(entries: QueueHistoryEntry[]): Promise<void> {
	await setStorage('local', QUEUE_HISTORY_KEY, entries);
}

// Dedupes any prior entry for the same userId and trims to MAX_QUEUE_HISTORY_SIZE
export async function addQueueEntry(userId: number): Promise<void> {
	const current = await readQueueHistory();
	const newEntry: QueueHistoryEntry = {
		userId,
		queuedAt: Date.now(),
		processed: false,
		processedAt: null,
		processing: false,
		flagged: false,
		notified: false
	};
	const updated = [newEntry, ...current.filter((e) => e.userId !== userId)].slice(
		0,
		MAX_QUEUE_HISTORY_SIZE
	);
	await writeQueueHistory(updated);
}

// Removes the entry for the given userId, no-op if absent
export async function removeQueueEntry(userId: number): Promise<void> {
	const current = await readQueueHistory();
	const updated = current.filter((e) => e.userId !== userId);
	await writeQueueHistory(updated);
}

export async function clearQueueHistory(): Promise<void> {
	await writeQueueHistory([]);
}

export async function readUnprocessedEntries(): Promise<QueueHistoryEntry[]> {
	const all = await readQueueHistory();
	return all.filter((e) => !e.processed);
}

export async function isUserBeingProcessedInStorage(userId: number): Promise<boolean> {
	const all = await readQueueHistory();
	const entry = all.find((e) => e.userId === userId);
	return entry !== undefined && !entry.processed;
}

export async function getUnprocessedUserIdsFromStorage(userIds: number[]): Promise<number[]> {
	const all = await readQueueHistory();
	const unprocessed = new Set(all.filter((e) => !e.processed).map((e) => e.userId));
	return userIds.filter((id) => unprocessed.has(id));
}

// Applies a status update to the persisted queue history. Returns the entry
// that just transitioned to "processed", or null if no transition occurred.
export async function applyQueueStatusUpdate(
	userId: number,
	status: QueueStatusItem
): Promise<QueueHistoryEntry | null> {
	const current = await readQueueHistory();
	const index = current.findIndex((e) => e.userId === userId);
	const entry = current[index];
	if (!entry) return null;

	if (
		entry.processed === status.processed &&
		entry.processing === status.processing &&
		entry.flagged === status.flagged
	) {
		return null;
	}

	const crossingProcessed = !entry.processed && status.processed;

	const updated = [...current];
	updated[index] = {
		...entry,
		processed: status.processed,
		processedAt: status.processed_at ? status.processed_at * 1000 : null,
		processing: status.processing,
		flagged: status.flagged,
		notified: crossingProcessed ? true : entry.notified
	};

	await writeQueueHistory(updated);

	if (crossingProcessed && status.flagged) {
		await incrementSuccessfulFlagCount();
	}

	return crossingProcessed ? (updated[index] ?? null) : null;
}
