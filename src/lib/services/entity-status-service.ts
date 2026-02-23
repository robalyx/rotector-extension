import { get } from 'svelte/store';
import type { GroupStatus, UserStatus } from '../types/api';
import { API_CONFIG } from '../types/constants';
import { settings } from '../stores/settings';
import { SETTINGS_KEYS } from '../types/settings';
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

type EntityStatus = UserStatus | GroupStatus;

class EntityStatusService<T extends EntityStatus> {
	private readonly cache = new Map<string, CacheEntry<T>>();
	private readonly pendingRequests = new Map<string, Array<StatusRequest<T>>>();

	constructor(
		private readonly entityType: 'user' | 'group',
		private readonly fetchSingle: (id: string) => Promise<T>,
		private readonly fetchMultiple?: (ids: string[], lookupContext?: string) => Promise<T[]>
	) {}

	// Gets entity status from cache or fetches from API
	public async getStatus(entityId: string): Promise<T | null> {
		const cached = this.getCachedStatus(entityId);
		if (cached) {
			logger.info(`${this.entityType}StatusService`, 'Returning cached status', { entityId });
			return cached;
		}

		const pending = this.pendingRequests.get(entityId);
		if (pending) {
			logger.info(`${this.entityType}StatusService`, 'Request already pending, waiting...', {
				entityId
			});
			return new Promise((resolve, reject) => {
				pending.push({ resolve, reject });
			});
		}

		logger.info(`${this.entityType}StatusService`, 'Fetching fresh status', {
			entityId
		});
		return this.fetchStatus(entityId);
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
		lookupContext?: string
	): Promise<Map<string, T | null>> {
		if (!this.fetchMultiple) {
			const results = new Map<string, T | null>();
			for (const id of entityIds) {
				results.set(id, await this.getStatus(id));
			}
			return results;
		}

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

			for (let i = 0; i < chunks.length; i++) {
				const chunk = chunks[i];

				// Delay between batches
				if (i > 0) {
					await new Promise((resolve) => setTimeout(resolve, API_CONFIG.BATCH_DELAY));
				}

				try {
					const batchStatuses = await this.fetchMultiple(chunk, lookupContext);

					batchStatuses.forEach((status) => {
						if (status && status.id) {
							const entityId = status.id.toString();
							this.cache.set(entityId, {
								data: status,
								timestamp: Date.now()
							});
							results.set(entityId, status);
						}
					});
				} catch (error) {
					logger.error(`${this.entityType}StatusService`, 'Batch fetch failed', {
						error,
						chunkIndex: i,
						chunkSize: chunk.length
					});
				}
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
		const cacheDurationMinutes = currentSettings[SETTINGS_KEYS.CACHE_DURATION_MINUTES] || 5;
		return cacheDurationMinutes * 60 * 1000;
	}

	// Fetches status from API with request deduplication
	private async fetchStatus(entityId: string): Promise<T | null> {
		const requestQueue: Array<StatusRequest<T>> = [];
		this.pendingRequests.set(entityId, requestQueue);

		try {
			const status = await this.fetchSingle(entityId);

			if (status) {
				this.cache.set(entityId, {
					data: status,
					timestamp: Date.now()
				});

				requestQueue.forEach(({ resolve }) => {
					resolve(status);
				});
				return status;
			} else {
				requestQueue.forEach(({ resolve }) => {
					resolve(null);
				});
				return null;
			}
		} catch (error) {
			const err = error instanceof Error ? error : new Error('Unknown error');
			requestQueue.forEach(({ reject }) => {
				reject(err);
			});
			throw err;
		} finally {
			this.pendingRequests.delete(entityId);
		}
	}
}

// Create service instances
export const userStatusService = new EntityStatusService<UserStatus>(
	'user',
	async (id: string) => apiClient.checkUser(id),
	async (ids: string[]) => apiClient.checkMultipleUsers(ids)
);

export const groupStatusService = new EntityStatusService<GroupStatus>(
	'group',
	async (id: string) => apiClient.checkGroup(id),
	async (ids: string[], lookupContext?: string) =>
		apiClient.checkMultipleGroups(ids, { lookupContext })
);
