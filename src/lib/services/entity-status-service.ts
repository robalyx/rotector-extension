import { get } from 'svelte/store';
import type { GroupStatus, UserStatus } from '../types/api';
import { API_CONFIG } from '../types/constants';
import { settings } from '../stores/settings';
import { SETTINGS_KEYS } from '../types/settings';
import { abortableSleep, getAbortError } from '../utils/abort';
import { logger } from '../utils/logger';
import { chunkArray } from '../utils/array';
import { apiClient } from './api-client';

interface CacheEntry<T> {
	data: T;
	timestamp: number;
}

interface StatusRequest<T> {
	resolve: (value: T | null) => void;
	reject: (error: Error) => void;
}

interface GetStatusOptions {
	signal?: AbortSignal | undefined;
}

interface GetStatusesOptions {
	lookupContext?: string | undefined;
	signal?: AbortSignal | undefined;
}

// The controller short-circuits the shared fetch only when every queued waiter has aborted,
// so one caller's cancel can never reject another caller's still-active request.
interface PendingEntry<T> {
	queue: Array<StatusRequest<T>>;
	controller: AbortController;
}

type EntityStatus = UserStatus | GroupStatus;

class EntityStatusService<T extends EntityStatus> {
	private readonly cache = new Map<string, CacheEntry<T>>();
	private readonly pendingRequests = new Map<string, PendingEntry<T>>();

	constructor(
		private readonly entityType: 'user' | 'group',
		private readonly fetchSingle: (id: string, options?: GetStatusOptions) => Promise<T>,
		private readonly fetchMultiple: (ids: string[], lookupContext?: string) => Promise<T[]>
	) {}

	// Gets entity status from cache or fetches from API
	public async getStatus(entityId: string, options?: GetStatusOptions): Promise<T | null> {
		if (options?.signal?.aborted) {
			throw getAbortError(options.signal);
		}

		const cached = this.getCachedStatus(entityId);
		if (cached) {
			logger.info(`${this.entityType}StatusService`, 'Returning cached status', { entityId });
			return cached;
		}

		return new Promise<T | null>((resolve, reject) => {
			const signal = options?.signal;
			let onAbort: (() => void) | undefined;

			// Manually remove the abort listener on settle
			const request: StatusRequest<T> = {
				resolve: (value) => {
					if (onAbort) signal?.removeEventListener('abort', onAbort);
					resolve(value);
				},
				reject: (error) => {
					if (onAbort) signal?.removeEventListener('abort', onAbort);
					reject(error);
				}
			};

			// Join an existing pending fetch or create a new one
			let entry = this.pendingRequests.get(entityId);
			const isPrimary = !entry;
			if (!entry) {
				entry = { queue: [], controller: new AbortController() };
				this.pendingRequests.set(entityId, entry);
			}
			const pendingEntry = entry;

			if (signal) {
				onAbort = () => {
					const idx = pendingEntry.queue.indexOf(request);
					if (idx !== -1) pendingEntry.queue.splice(idx, 1);
					// Short-circuit the shared fetch only when every caller has abandoned it
					if (pendingEntry.queue.length === 0) {
						pendingEntry.controller.abort();
					}
					reject(getAbortError(signal));
				};
				signal.addEventListener('abort', onAbort, { once: true });
			}

			pendingEntry.queue.push(request);

			if (isPrimary) {
				logger.info(`${this.entityType}StatusService`, 'Fetching fresh status', { entityId });
				void this.runFetch(entityId, pendingEntry);
			} else {
				logger.info(`${this.entityType}StatusService`, 'Request already pending, waiting...', {
					entityId
				});
			}
		});
	}

	// Returns cached status if valid, null if expired or not found
	public getCachedStatus(entityId: string): T | null {
		const entry = this.cache.get(entityId);
		if (!entry) return null;

		if (Date.now() - entry.timestamp > this.getCacheTTL()) {
			this.cache.delete(entityId);
			return null;
		}

		return entry.data;
	}

	// Gets multiple entity statuses with batch fetching optimization
	public async getStatuses(
		entityIds: string[],
		options?: GetStatusesOptions
	): Promise<Map<string, T | null>> {
		if (options?.signal?.aborted) {
			throw getAbortError(options.signal);
		}

		// Partition requests into cached and uncached
		const results = new Map<string, T | null>();
		const toFetch: string[] = [];

		for (const entityId of entityIds) {
			const cached = this.getCachedStatus(entityId);
			if (cached) {
				results.set(entityId, cached);
			} else {
				toFetch.push(entityId);
			}
		}

		if (toFetch.length > 0) {
			const chunks = chunkArray(toFetch, API_CONFIG.BATCH_SIZE);

			logger.info(`${this.entityType}StatusService`, 'Batch fetching statuses', {
				count: toFetch.length,
				chunks: chunks.length
			});

			for (const [i, chunk] of chunks.entries()) {
				// Delay between batches
				if (i > 0) {
					await abortableSleep(API_CONFIG.BATCH_DELAY, options?.signal);
				}

				if (options?.signal?.aborted) {
					throw getAbortError(options.signal);
				}

				await this.fetchChunk(chunk, i, results, options);
			}

			// Set null for any IDs that weren't returned
			toFetch.forEach((entityId) => {
				if (!results.has(entityId)) {
					results.set(entityId, null);
				}
			});
		}

		return results;
	}

	// Fetch one batch, populate cache + results. Rethrow on abort, log otherwise
	private async fetchChunk(
		chunk: string[],
		chunkIndex: number,
		results: Map<string, T | null>,
		options: GetStatusesOptions | undefined
	): Promise<void> {
		try {
			const batchStatuses = await this.fetchMultiple(chunk, options?.lookupContext);

			// Drop results if the caller aborted while the request was in flight. Otherwise a
			// superseded scan could still populate the cache and let stale indicators win.
			if (options?.signal?.aborted) {
				throw getAbortError(options.signal);
			}

			batchStatuses.forEach((status) => {
				if (status.id) {
					const entityId = status.id.toString();
					this.cache.set(entityId, {
						data: status,
						timestamp: Date.now()
					});
					results.set(entityId, status);
				}
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				throw error;
			}
			logger.error(`${this.entityType}StatusService`, 'Batch fetch failed', {
				error,
				chunkIndex,
				chunkSize: chunk.length
			});
		}
	}

	// Manually updates cache with new status data
	public updateStatus(entityId: string, status: T): void {
		this.cache.set(entityId, {
			data: status,
			timestamp: Date.now()
		});
		logger.info(`${this.entityType}StatusService`, 'Status manually updated', {
			entityId
		});
	}

	// Removes cached status to fetch fresh data from API
	public invalidateCache(entityId: string): void {
		this.cache.delete(entityId);
	}

	private getCacheTTL(): number {
		const currentSettings = get(settings);
		return currentSettings[SETTINGS_KEYS.CACHE_DURATION_MINUTES] * 60 * 1000;
	}

	// Runs the shared fetch for a pending entry and distributes the result to every queued waiter
	private async runFetch(entityId: string, entry: PendingEntry<T>): Promise<void> {
		try {
			const status = await this.fetchSingle(entityId, { signal: entry.controller.signal });
			const snapshot = [...entry.queue];
			this.pendingRequests.delete(entityId);
			this.cache.set(entityId, { data: status, timestamp: Date.now() });
			for (const request of snapshot) request.resolve(status);
		} catch (error) {
			const err = error instanceof Error ? error : new Error('Unknown error');
			const snapshot = [...entry.queue];
			this.pendingRequests.delete(entityId);
			for (const request of snapshot) request.reject(err);
		}
	}
}

// Create service instances
export const userStatusService = new EntityStatusService<UserStatus>(
	'user',
	async (id, options) => apiClient.checkUser(id, options),
	async (ids: string[]) => apiClient.checkMultipleUsers(ids)
);

export const groupStatusService = new EntityStatusService<GroupStatus>(
	'group',
	async (id, options) => apiClient.checkGroup(id, options),
	async (ids: string[], lookupContext?: string) =>
		apiClient.checkMultipleGroups(ids, { lookupContext })
);
