import type * as v from 'valibot';
import type { QueueStatusItemSchema } from '../schemas/rotector';

// Queue history entry stored locally
export interface QueueHistoryEntry {
	userId: number;
	queuedAt: number; // Unix timestamp (ms) when user was queued
	processed: boolean; // Whether processing is complete
	processedAt: number | null; // Unix timestamp (ms) when processed
	processing: boolean; // Currently being processed
	flagged: boolean; // Result: was user flagged
	notified: boolean; // Whether notification was sent for this entry
}

// API response format for queue status endpoint
export type QueueStatusItem = v.InferOutput<typeof QueueStatusItemSchema>;

export type QueueStatusResponse = Record<string, QueueStatusItem>;
