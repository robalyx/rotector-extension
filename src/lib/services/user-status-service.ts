import {derived, get, writable} from 'svelte/store';
import type {UserStatus} from '../types/api';
import {settings} from '../stores/settings';
import {SETTINGS_KEYS} from '../types/settings';
import {logger} from '../utils/logger';
import {apiClient} from './api-client';

interface CacheEntry {
    data: UserStatus;
    timestamp: number;
}

interface StatusRequest {
    resolve: (value: UserStatus | null) => void;
    reject: (error: Error) => void;
}

class UserStatusService {
    private static instance: UserStatusService;
    private cache = new Map<string, CacheEntry>();
    private pendingRequests = new Map<string, StatusRequest[]>();
    private statusStore = writable<Map<string, UserStatus>>(new Map());

    public readonly statuses = derived(this.statusStore, ($store) => $store);

    private constructor() {
        // Private constructor for singleton
    }

    public static getInstance(): UserStatusService {
        if (!UserStatusService.instance) {
            UserStatusService.instance = new UserStatusService();
        }
        return UserStatusService.instance;
    }

    // Get user status with caching and deduplication
    public async getStatus(userId: string): Promise<UserStatus | null> {
        // Check cache for status
        const cached = this.getCachedStatus(userId);
        if (cached) {
            logger.info('UserStatusService', 'Returning cached status', {userId});
            return cached;
        }

        // Check if request is already pending
        const pending = this.pendingRequests.get(userId);
        if (pending) {
            logger.info('UserStatusService', 'Request already pending, waiting...', {userId});
            return new Promise((resolve, reject) => {
                pending.push({resolve, reject});
            });
        }

        // Start new request
        logger.info('UserStatusService', 'Fetching fresh status', {userId});
        return this.fetchStatus(userId);
    }

    // Get cached status without making API call
    public getCachedStatus(userId: string): UserStatus | null {
        const entry = this.cache.get(userId);
        if (!entry) return null;

        // Get cache duration from settings
        const currentSettings = get(settings);
        const cacheDurationMinutes = currentSettings[SETTINGS_KEYS.CACHE_DURATION_MINUTES] || 5;
        const cacheTTL = cacheDurationMinutes * 60 * 1000;

        const isExpired = Date.now() - entry.timestamp > cacheTTL;
        if (isExpired) {
            this.cache.delete(userId);
            this.updateStore();
            return null;
        }

        return entry.data;
    }

    // Batch fetch multiple user statuses
    public async getStatuses(userIds: string[]): Promise<Map<string, UserStatus | null>> {
        const results = new Map<string, UserStatus | null>();
        const toFetch: string[] = [];

        // Check cache for each user
        for (const userId of userIds) {
            const cached = this.getCachedStatus(userId);
            if (cached) {
                results.set(userId, cached);
            } else {
                toFetch.push(userId);
            }
        }

        // Fetch missing users
        if (toFetch.length > 0) {
            logger.info('UserStatusService', 'Batch fetching statuses', {count: toFetch.length});

            try {
                const batchStatuses = await apiClient.checkMultipleUsers(toFetch, {
                    batchSize: 50,
                    batchDelay: 100
                });

                // Process batch results
                batchStatuses.forEach(status => {
                    if (status && status.id) {
                        const userId = status.id.toString();
                        this.cache.set(userId, {
                            data: status,
                            timestamp: Date.now()
                        });
                        results.set(userId, status);
                    }
                });

                // Handle any users that weren't in the batch response
                toFetch.forEach(userId => {
                    if (!results.has(userId)) {
                        results.set(userId, null);
                    }
                });

                this.updateStore();
            } catch (error) {
                logger.error('UserStatusService', 'Batch fetch failed - returning null results to maintain batch-only approach', {
                    error,
                    userCount: toFetch.length,
                    userIds: toFetch.slice(0, 5)
                });

                toFetch.forEach(userId => {
                    results.set(userId, null);
                });
            }
        }

        return results;
    }

    // Manually update status (e.g., after successful report)
    public updateStatus(userId: string, status: UserStatus): void {
        this.cache.set(userId, {
            data: status,
            timestamp: Date.now()
        });
        this.updateStore();
        logger.info('UserStatusService', 'Status manually updated', {userId});
    }

    /**
     * Warm cache with user data (e.g., on page load)
     */
    public async warmCache(userIds: string[]): Promise<void> {
        logger.info('UserStatusService', 'Warming cache', {count: userIds.length});
        await this.getStatuses(userIds);
    }

    private async fetchStatus(userId: string): Promise<UserStatus | null> {
        const requestQueue: StatusRequest[] = [];
        this.pendingRequests.set(userId, requestQueue);

        try {
            const status = await apiClient.checkUser(userId);

            if (status) {
                // Cache the result
                this.cache.set(userId, {
                    data: status,
                    timestamp: Date.now()
                });
                this.updateStore();

                // Resolve all pending requests
                requestQueue.forEach(({resolve}) => resolve(status));

                return status;
            } else {
                // Resolve with null for all pending requests
                requestQueue.forEach(({resolve}) => resolve(null));
                return null;
            }
        } catch (error) {
            // Reject all pending requests
            const err = error instanceof Error ? error : new Error('Unknown error');
            requestQueue.forEach(({reject}) => reject(err));
            throw err;
        } finally {
            // Clean up pending requests
            this.pendingRequests.delete(userId);
        }
    }

    private updateStore(): void {
        const storeData = new Map<string, UserStatus>();
        for (const [userId, entry] of this.cache.entries()) {
            storeData.set(userId, entry.data);
        }
        this.statusStore.set(storeData);
    }
}

export const userStatusService = UserStatusService.getInstance();