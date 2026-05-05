import { derived, writable } from 'svelte/store';
import type { QueueHistoryEntry } from '../types/queue-history';
import { logger } from '../utils/logging/logger';
import { subscribeStorageKey } from '../utils/storage';
import { QUEUE_HISTORY_KEY, readQueueHistory } from '../utils/queue-history-storage';

export const queueHistory = writable<QueueHistoryEntry[]>([]);

const unprocessedEntries = derived(queueHistory, ($history) =>
	$history.filter((entry) => !entry.processed)
);

export const unprocessedCount = derived(unprocessedEntries, ($unprocessed) => $unprocessed.length);

export async function loadQueueHistory(): Promise<void> {
	try {
		queueHistory.set(await readQueueHistory());
	} catch (error) {
		logger.error('Failed to load queue history:', error);
		queueHistory.set([]);
	}
}

subscribeStorageKey<QueueHistoryEntry[]>('local', QUEUE_HISTORY_KEY, (newValue) => {
	queueHistory.set(newValue ?? []);
});
