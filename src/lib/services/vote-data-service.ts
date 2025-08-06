import {get, writable} from 'svelte/store';
import type {VoteData} from '../types/api';
import {apiClient} from './api-client';
import {logger} from '../utils/logger';
import {settings} from '../stores/settings';
import {SETTINGS_KEYS} from '../types/settings';

interface VoteDataCache {
    [userId: string]: {
        data: VoteData;
        timestamp: number;
    };
}

interface PendingRequest {
    promise: Promise<VoteData>;
    timestamp: number;
}

interface PendingRequests {
    [userId: string]: PendingRequest;
}

class VoteDataService {
    private cache: VoteDataCache = {};
    private pendingRequests: PendingRequests = {};
    private readonly REQUEST_TIMEOUT = 10 * 1000; // 10 seconds

    // Store for reactive updates
    private voteDataStore = writable<VoteDataCache>({});

    constructor() {
        setInterval(() => {
            this.cleanupCache();
            this.cleanupPendingRequests();
        }, 60 * 1000); // Every minute
    }

    // Get vote data for a user, with automatic deduplication and caching
    async getVoteData(userId: string): Promise<VoteData> {
        const numericUserId = this.normalizeUserId(userId);

        logger.debug('VoteDataService.getVoteData called', {
            userId: numericUserId,
            hasCached: !!this.cache[numericUserId],
            hasPending: !!this.pendingRequests[numericUserId]
        });

        // Check if we have cached data that's still valid
        const cachedData = this.getCachedVoteData(numericUserId);
        if (cachedData) {
            logger.debug('VoteDataService: returning cached data', {userId: numericUserId});
            return cachedData;
        }

        // Check if there's already a pending request for this user
        if (this.pendingRequests[numericUserId]) {
            logger.debug('VoteDataService: reusing pending request', {userId: numericUserId});
            return this.pendingRequests[numericUserId].promise;
        }

        // Create new request
        logger.debug('VoteDataService: creating new request', {userId: numericUserId});
        const promise = apiClient.getVotes(numericUserId);

        this.pendingRequests[numericUserId] = {
            promise,
            timestamp: Date.now()
        };

        try {
            const data = await promise;

            // Cache the result
            this.cache[numericUserId] = {
                data,
                timestamp: Date.now()
            };

            // Update the store for reactive updates
            this.voteDataStore.set({...this.cache});

            logger.debug('VoteDataService: successfully cached vote data', {
                userId: numericUserId,
                data
            });

            return data;
        } catch (error) {
            logger.error('VoteDataService: failed to fetch vote data', {
                userId: numericUserId,
                error
            });
            throw error;
        } finally {
            // Clean up pending request
            delete this.pendingRequests[numericUserId];
        }
    }

    // Get cached vote data if available
    getCachedVoteData(userId: string): VoteData | null {
        const numericUserId = this.normalizeUserId(userId);
        const cached = this.cache[numericUserId];

        if (!cached) return null;

        const isExpired = Date.now() - cached.timestamp > this.getCacheTTL();
        if (isExpired) {
            delete this.cache[numericUserId];
            return null;
        }

        return cached.data;
    }

    // Update vote data in cache after a vote submission
    updateCachedVoteData(userId: string, newData: VoteData): void {
        const numericUserId = this.normalizeUserId(userId);

        this.cache[numericUserId] = {
            data: newData,
            timestamp: Date.now()
        };

        // Update the store for reactive updates
        this.voteDataStore.set({...this.cache});

        logger.debug('VoteDataService: updated cached vote data', {
            userId: numericUserId,
            newData
        });
    }

    // Subscribe to vote data changes for a specific user
    subscribeToVoteData(userId: string, callback: (data: VoteData | null) => void): () => void {
        const numericUserId = this.normalizeUserId(userId);

        return this.voteDataStore.subscribe((cache) => {
            const cached = cache[numericUserId];
            if (!cached) {
                callback(null);
                return;
            }

            const isExpired = Date.now() - cached.timestamp > this.getCacheTTL();
            if (isExpired) {
                delete this.cache[numericUserId];
                callback(null);
                return;
            }

            callback(cached.data);
        });
    }

    // Check if vote data is currently being loaded
    isLoading(userId: string): boolean {
        const numericUserId = this.normalizeUserId(userId);
        return !!this.pendingRequests[numericUserId];
    }

    // Clear all cached data
    clearCache(): void {
        this.cache = {};
        this.voteDataStore.set({});
        logger.debug('VoteDataService: cleared all cache');
    }

    // Clear cache for a specific user
    clearUserCache(userId: string): void {
        const numericUserId = this.normalizeUserId(userId);
        delete this.cache[numericUserId];
        this.voteDataStore.set({...this.cache});
        logger.debug('VoteDataService: cleared cache for user', {userId: numericUserId});
    }

    // Get cache TTL from settings
    private getCacheTTL(): number {
        const currentSettings = get(settings);
        const cacheDurationMinutes = currentSettings[SETTINGS_KEYS.CACHE_DURATION_MINUTES] || 5;
        return cacheDurationMinutes * 60 * 1000;
    }

    // Convert userId to string format for consistent cache keys
    private normalizeUserId(userId: string | number): string {
        return String(userId);
    }

    // Remove expired entries from cache
    private cleanupCache(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [userId, cached] of Object.entries(this.cache)) {
            if (now - cached.timestamp > this.getCacheTTL()) {
                delete this.cache[userId];
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.voteDataStore.set({...this.cache});
            logger.debug('VoteDataService: cleaned expired cache entries', {count: cleaned});
        }
    }

    // Remove stale pending requests that exceeded timeout
    private cleanupPendingRequests(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [userId, pending] of Object.entries(this.pendingRequests)) {
            if (now - pending.timestamp > this.REQUEST_TIMEOUT) {
                delete this.pendingRequests[userId];
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.debug('VoteDataService: cleaned expired pending requests', {count: cleaned});
        }
    }
}

export const voteDataService = new VoteDataService();