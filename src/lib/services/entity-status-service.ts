import {derived, get, writable} from 'svelte/store';
import type {UserStatus, GroupStatus} from '../types/api';
import {settings} from '../stores/settings';
import {SETTINGS_KEYS} from '../types/settings';
import {logger} from '../utils/logger';
import {apiClient} from './api-client';

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
    private cache = new Map<string, CacheEntry<T>>();
    private pendingRequests = new Map<string, StatusRequest<T>[]>();
    private statusStore = writable<Map<string, T>>(new Map());

    public readonly statuses = derived(this.statusStore, ($store) => $store);

    constructor(
        private entityType: 'user' | 'group',
        private fetchSingle: (id: string) => Promise<T>,
        private fetchMultiple?: (ids: string[]) => Promise<T[]>
    ) {}

    // Gets entity status from cache or fetches from API
    public async getStatus(entityId: string): Promise<T | null> {
        const cached = this.getCachedStatus(entityId);
        if (cached) {
            logger.info(`${this.entityType}StatusService`, 'Returning cached status', {entityId});
            return cached;
        }

        const pending = this.pendingRequests.get(entityId);
        if (pending) {
            logger.info(`${this.entityType}StatusService`, 'Request already pending, waiting...', {entityId});
            return new Promise((resolve, reject) => {
                pending.push({resolve, reject});
            });
        }

        logger.info(`${this.entityType}StatusService`, 'Fetching fresh status', {entityId});
        return this.fetchStatus(entityId);
    }

    // Returns cached status if valid, null if expired or not found
    public getCachedStatus(entityId: string): T | null {
        const entry = this.cache.get(entityId);
        if (!entry) return null;

        const currentSettings = get(settings);
        const cacheDurationMinutes = currentSettings[SETTINGS_KEYS.CACHE_DURATION_MINUTES] || 5;
        const cacheTTL = cacheDurationMinutes * 60 * 1000;

        const isExpired = Date.now() - entry.timestamp > cacheTTL;
        if (isExpired) {
            this.cache.delete(entityId);
            this.updateStore();
            return null;
        }

        return entry.data;
    }

    // Gets multiple entity statuses with batch fetching optimization
    public async getStatuses(entityIds: string[]): Promise<Map<string, T | null>> {
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
            logger.info(`${this.entityType}StatusService`, 'Batch fetching statuses', {count: toFetch.length});

            try {
                const batchStatuses = await this.fetchMultiple(toFetch);

                batchStatuses.forEach(status => {
                    if (status && status.id) {
                        const entityId = status.id.toString();
                        this.cache.set(entityId, {
                            data: status,
                            timestamp: Date.now()
                        });
                        results.set(entityId, status);
                    }
                });

                toFetch.forEach(entityId => {
                    if (!results.has(entityId)) {
                        results.set(entityId, null);
                    }
                });

                this.updateStore();
            } catch (error) {
                logger.error(`${this.entityType}StatusService`, 'Batch fetch failed', {
                    error,
                    entityCount: toFetch.length,
                    entityIds: toFetch.slice(0, 5)
                });

                toFetch.forEach(entityId => {
                    results.set(entityId, null);
                });
            }
        }

        return results;
    }

    // Manually updates cache with new status data
    public updateStatus(entityId: string, status: T): void {
        this.cache.set(entityId, {
            data: status,
            timestamp: Date.now()
        });
        this.updateStore();
        logger.info(`${this.entityType}StatusService`, 'Status manually updated', {entityId});
    }

    // Preloads cache with entity statuses
    public async warmCache(entityIds: string[]): Promise<void> {
        logger.info(`${this.entityType}StatusService`, 'Warming cache', {count: entityIds.length});
        await this.getStatuses(entityIds);
    }

    // Clears entire cache
    public clearCache(): void {
        this.cache.clear();
        this.updateStore();
        logger.info(`${this.entityType}StatusService`, 'Cache cleared');
    }

    // Clears cache for specific entity
    public clearEntityCache(entityId: string): void {
        this.cache.delete(entityId);
        this.updateStore();
        logger.info(`${this.entityType}StatusService`, 'Cache cleared for entity', {entityId});
    }

    // Returns cache size and entry age statistics
    public getCacheStats(): {size: number; entries: Array<{entityId: string; age: number}>} {
        const entries = Array.from(this.cache.entries()).map(([entityId, entry]) => ({
            entityId,
            age: Date.now() - entry.timestamp
        }));

        return {
            size: this.cache.size,
            entries
        };
    }

    // Fetches status from API with request deduplication
    private async fetchStatus(entityId: string): Promise<T | null> {
        const requestQueue: StatusRequest<T>[] = [];
        this.pendingRequests.set(entityId, requestQueue);

        try {
            const status = await this.fetchSingle(entityId);

            if (status) {
                this.cache.set(entityId, {
                    data: status,
                    timestamp: Date.now()
                });
                this.updateStore();

                requestQueue.forEach(({resolve}) => resolve(status));
                return status;
            } else {
                requestQueue.forEach(({resolve}) => resolve(null));
                return null;
            }
        } catch (error) {
            const err = error instanceof Error ? error : new Error('Unknown error');
            requestQueue.forEach(({reject}) => reject(err));
            throw err;
        } finally {
            this.pendingRequests.delete(entityId);
        }
    }

    // Updates Svelte store with current cache data
    private updateStore(): void {
        const storeData = new Map<string, T>();
        for (const [entityId, entry] of this.cache.entries()) {
            storeData.set(entityId, entry.data);
        }
        this.statusStore.set(storeData);
    }
}

// Create service instances
export const userStatusService = new EntityStatusService<UserStatus>(
    'user',
    (id: string) => apiClient.checkUser(id),
    (ids: string[]) => apiClient.checkMultipleUsers(ids, {batchSize: 50, batchDelay: 100})
);

export const groupStatusService = new EntityStatusService<GroupStatus>(
    'group',
    (id: string) => apiClient.checkGroup(id),
    (ids: string[]) => apiClient.checkMultipleGroups(ids, {batchSize: 50, batchDelay: 100})
);