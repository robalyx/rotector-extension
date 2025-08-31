import {API_ACTIONS, API_CONFIG, VOTE_TYPES, type VoteType} from '../types/constants';
import type {
    ApiClientConfig,
    ApiResponse,
    BatchOptions,
    ContentMessage,
    GroupStatus,
    QueueResult,
    RequestOptions,
    UserStatus,
    VoteData,
    VoteResult
} from '../types/api';
import type {Statistics} from '../types/statistics';
import {sanitizeEntityId} from '../utils/sanitizer';

// API client for backend communication
class RotectorApiClient {
    private readonly config: ApiClientConfig;

    constructor(config: Partial<ApiClientConfig> = {}) {
        this.config = {
            baseUrl: API_CONFIG.BASE_URL,
            timeout: API_CONFIG.TIMEOUT,
            maxRetries: API_CONFIG.MAX_RETRIES,
            retryDelay: API_CONFIG.RETRY_DELAY,
            ...config,
        };
    }

    // Sets the API key for authenticated requests
    setApiKey(apiKey: string): void {
        this.config.apiKey = apiKey;
    }

    // Checks the status of a single user
    async checkUser(userId: string | number, options?: RequestOptions): Promise<UserStatus> {
        const sanitizedUserId = sanitizeEntityId(userId);
        if (!sanitizedUserId) {
            throw new Error('Invalid user ID provided.');
        }
        return this.sendMessage<UserStatus>(
            API_ACTIONS.CHECK_USER_STATUS,
            {userId: sanitizedUserId},
            options
        );
    }

    // Checks the status of a single group
    async checkGroup(groupId: string | number, options?: RequestOptions): Promise<GroupStatus> {
        const sanitizedGroupId = sanitizeEntityId(groupId);
        if (!sanitizedGroupId) {
            throw new Error('Invalid group ID');
        }
        return this.sendMessage<GroupStatus>(
            API_ACTIONS.CHECK_GROUP_STATUS,
            {groupId: sanitizedGroupId},
            options
        );
    }

    // Checks the status of multiple users with automatic batching
    async checkMultipleUsers(
        userIds: Array<string | number>,
        batchOptions: BatchOptions = {}
    ): Promise<UserStatus[]> {
        // Validate and sanitize all IDs
        const sanitizedUserIds = userIds
            .map(id => sanitizeEntityId(id))
            .filter((id): id is string => id !== null);

        if (sanitizedUserIds.length === 0) {
            throw new Error("No valid user IDs provided for batch check");
        }

        const batchSize = batchOptions.batchSize ?? API_CONFIG.BATCH_SIZE;
        const batchDelay = batchOptions.batchDelay ?? API_CONFIG.BATCH_DELAY;

        // Split into batches
        const batches = this.chunkArray(sanitizedUserIds, batchSize);
        const results: UserStatus[] = [];

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];

            try {
                const batchData = await this.sendMessage<UserStatus[]>(
                    API_ACTIONS.CHECK_MULTIPLE_USERS,
                    {userIds: batch},
                    {
                        maxRetries: batchOptions.maxRetries,
                        retryDelay: batchOptions.retryDelay
                    }
                );

                if (Array.isArray(batchData)) {
                    results.push(...batchData);
                } else {
                    console.warn("Unexpected batch response format:", batchData);
                }

                // Add delay between batches if not the last batch
                if (i < batches.length - 1) {
                    await this.sleep(batchDelay);
                }
            } catch (error) {
                console.error(`Failed to process batch ${i + 1}/${batches.length}:`, error);
                throw error;
            }
        }

        return results;
    }

    // Checks the status of multiple groups with automatic batching
    async checkMultipleGroups(
        groupIds: Array<string | number>,
        batchOptions: BatchOptions = {}
    ): Promise<GroupStatus[]> {
        // Validate and sanitize all IDs
        const sanitizedGroupIds = groupIds
            .map(id => sanitizeEntityId(id))
            .filter((id): id is string => id !== null);

        if (sanitizedGroupIds.length === 0) {
            throw new Error("No valid group IDs provided for batch check");
        }

        const batchSize = batchOptions.batchSize ?? API_CONFIG.BATCH_SIZE;
        const batchDelay = batchOptions.batchDelay ?? API_CONFIG.BATCH_DELAY;

        // Split into batches
        const batches = this.chunkArray(sanitizedGroupIds, batchSize);
        const results: GroupStatus[] = [];

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];

            try {
                const batchData = await this.sendMessage<GroupStatus[]>(
                    API_ACTIONS.CHECK_MULTIPLE_GROUPS,
                    {groupIds: batch},
                    {
                        maxRetries: batchOptions.maxRetries,
                        retryDelay: batchOptions.retryDelay
                    }
                );

                if (Array.isArray(batchData)) {
                    results.push(...batchData);
                } else {
                    console.warn("Unexpected batch response format:", batchData);
                }

                // Add delay between batches if not the last batch
                if (i < batches.length - 1) {
                    await this.sleep(batchDelay);
                }
            } catch (error) {
                console.error(`Failed to process group batch ${i + 1}/${batches.length}:`, error);
                throw error;
            }
        }

        return results;
    }

    // Queues a user for manual review
    async queueUser(
        userId: string | number,
        inappropriateOutfit: boolean = false,
        inappropriateProfile: boolean = false,
        inappropriateFriends: boolean = false,
        inappropriateGroups: boolean = false,
        options?: RequestOptions
    ): Promise<QueueResult> {
        const sanitizedUserId = sanitizeEntityId(userId);
        if (!sanitizedUserId) {
            throw new Error('Invalid user ID provided.');
        }
        return this.sendMessage<QueueResult>(
            API_ACTIONS.QUEUE_USER,
            {
                userId: sanitizedUserId,
                inappropriateOutfit,
                inappropriateProfile,
                inappropriateFriends,
                inappropriateGroups
            },
            {maxRetries: 2, retryDelay: 2000, ...options}
        );
    }

    // Submits a vote for a user
    async submitVote(
        userId: string | number,
        voteType: VoteType,
        options?: RequestOptions
    ): Promise<VoteResult> {
        const sanitizedUserId = sanitizeEntityId(userId);
        if (!sanitizedUserId) {
            throw new Error('Invalid user ID provided.');
        }

        if (voteType !== VOTE_TYPES.UPVOTE && voteType !== VOTE_TYPES.DOWNVOTE) {
            throw new Error("Invalid vote type. Must be 1 (upvote) or -1 (downvote)");
        }

        return this.sendMessage<VoteResult>(
            API_ACTIONS.SUBMIT_VOTE,
            {userId: sanitizedUserId, voteType},
            {maxRetries: 2, retryDelay: 1000, ...options}
        );
    }

    // Gets vote data for a single user
    async getVotes(userId: string | number, options?: RequestOptions): Promise<VoteData> {
        const sanitizedUserId = sanitizeEntityId(userId);
        if (!sanitizedUserId) {
            throw new Error('Invalid user ID provided.');
        }
        return this.sendMessage<VoteData>(
            API_ACTIONS.GET_VOTES,
            {userId: sanitizedUserId},
            options
        );
    }

    // Gets vote data for multiple users with batching
    async getMultipleVotes(
        userIds: Array<string | number>,
        batchOptions: BatchOptions = {}
    ): Promise<VoteData[]> {
        // Validate and sanitize all IDs first
        const sanitizedUserIds = userIds
            .map(id => sanitizeEntityId(id))
            .filter((id): id is string => id !== null);

        if (sanitizedUserIds.length === 0) {
            throw new Error("No valid user IDs provided for vote batch check");
        }

        const batchSize = batchOptions.batchSize ?? API_CONFIG.BATCH_SIZE;
        const batchDelay = batchOptions.batchDelay ?? API_CONFIG.BATCH_DELAY;

        // Split into batches
        const batches = this.chunkArray(sanitizedUserIds, batchSize);
        const results: VoteData[] = [];

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];

            try {
                const batchData = await this.sendMessage<VoteData[]>(
                    API_ACTIONS.GET_MULTIPLE_VOTES,
                    {userIds: batch},
                    {
                        maxRetries: batchOptions.maxRetries,
                        retryDelay: batchOptions.retryDelay
                    }
                );

                if (Array.isArray(batchData)) {
                    results.push(...batchData);
                }

                // Add delay between batches if not the last batch
                if (i < batches.length - 1) {
                    await this.sleep(batchDelay);
                }
            } catch (error) {
                console.error(`Failed to process vote batch ${i + 1}/${batches.length}:`, error);
                throw error;
            }
        }

        return results;
    }

    // Gets system statistics
    async getStatistics(options?: RequestOptions): Promise<Statistics> {
        return this.sendMessage<Statistics>(
            API_ACTIONS.GET_STATISTICS,
            {},
            options
        );
    }

    // Sends a message to the background script with retry logic
    private async sendMessage<T = unknown>(
        action: string,
        data: Record<string, unknown> = {},
        options: RequestOptions = {}
    ): Promise<T> {
        const maxRetries = options.maxRetries ?? this.config.maxRetries ?? API_CONFIG.MAX_RETRIES;
        const retryDelay = options.retryDelay ?? this.config.retryDelay ?? API_CONFIG.RETRY_DELAY;
        let attempt = 0;

        while (attempt <= maxRetries) {
            try {
                const message: ContentMessage = {action, ...data};
                const response: ApiResponse<T> = await browser.runtime.sendMessage(message);

                if (response?.success) {
                    return response.data as T;
                } else {
                    // Create structured error with additional properties
                    const error = new Error(response.error ?? 'An error occurred. Please try again.') as Error & {
                        requestId?: string;
                        code?: string;
                        type?: string;
                    };
                    const responseWithError = response as ApiResponse & {
                        requestId?: string;
                        code?: string;
                        type?: string
                    };

                    // Add structured error properties if available
                    if (responseWithError.requestId) {
                        error.requestId = responseWithError.requestId;
                    }
                    if (responseWithError.code) {
                        error.code = responseWithError.code;
                    }
                    if (responseWithError.type) {
                        error.type = responseWithError.type;
                    }

                    throw error;
                }
            } catch (error) {
                attempt++;

                // Check if we should retry
                if (attempt <= maxRetries && this.isRetryableError(error as Error)) {
                    const delay = retryDelay * attempt;
                    console.warn(
                        `API request failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries}):`,
                        error
                    );
                    await this.sleep(delay);
                    continue;
                }

                throw error;
            }
        }

        throw new Error('An error occurred. Please try again.');
    }

    // Determines if an error should trigger a retry attempt
    private isRetryableError(error: Error & { status?: number }): boolean {
        if (error.status !== undefined) {
            // Rate limits and server errors
            if (error.status === 429 || (error.status >= 500 && error.status < 600)) {
                return true;
            }
            // Request timeout
            if (error.status === 408) {
                return true;
            }
        }

        return false;
    }

    // Utility function to pause execution
    private async sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // Splits an array into chunks of specified size
    private chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}

export const apiClient = new RotectorApiClient(); 