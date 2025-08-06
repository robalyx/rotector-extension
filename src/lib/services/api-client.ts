import {API_ACTIONS, API_CONFIG, MESSAGES, VOTE_TYPES, type VoteType} from '../types/constants';
import type {
    ApiClientConfig,
    ApiResponse,
    BatchOptions,
    ContentMessage,
    QueueResult,
    RequestOptions,
    UserStatus,
    VoteData,
    VoteResult
} from '../types/api';
import type {Statistics} from '../types/statistics';

// API client for backend communication
class RotectorApiClient {
    private config: ApiClientConfig;

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
        const parsedUserId = this.parseUserId(userId);
        return this.sendMessage<UserStatus>(
            API_ACTIONS.CHECK_USER_STATUS,
            {userId: parsedUserId},
            options
        );
    }

    // Checks the status of multiple users with automatic batching
    async checkMultipleUsers(
        userIds: (string | number)[],
        batchOptions: BatchOptions = {}
    ): Promise<UserStatus[]> {
        // Validate and parse all IDs first
        const parsedUserIds = userIds
            .map(id => {
                try {
                    return this.parseUserId(id);
                } catch {
                    return null;
                }
            })
            .filter((id): id is number => id !== null);

        if (parsedUserIds.length === 0) {
            throw new Error("No valid user IDs provided for batch check");
        }

        const batchSize = batchOptions.batchSize ?? API_CONFIG.BATCH_SIZE;
        const batchDelay = batchOptions.batchDelay ?? API_CONFIG.BATCH_DELAY;

        // Split into batches
        const batches = this.chunkArray(parsedUserIds, batchSize);
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

    // Queues a user for manual review
    async queueUser(
        userId: string | number,
        inappropriateOutfit: boolean = false,
        inappropriateProfile: boolean = false,
        inappropriateFriends: boolean = false,
        inappropriateGroups: boolean = false,
        options?: RequestOptions
    ): Promise<QueueResult> {
        const parsedUserId = this.parseUserId(userId);
        return this.sendMessage<QueueResult>(
            API_ACTIONS.QUEUE_USER,
            {
                userId: parsedUserId,
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
        const parsedUserId = this.parseUserId(userId);

        if (voteType !== VOTE_TYPES.UPVOTE && voteType !== VOTE_TYPES.DOWNVOTE) {
            throw new Error("Invalid vote type. Must be 1 (upvote) or -1 (downvote)");
        }

        return this.sendMessage<VoteResult>(
            API_ACTIONS.SUBMIT_VOTE,
            {userId: parsedUserId, voteType},
            {maxRetries: 2, retryDelay: 1000, ...options}
        );
    }

    // Gets vote data for a single user
    async getVotes(userId: string | number, options?: RequestOptions): Promise<VoteData> {
        const parsedUserId = this.parseUserId(userId);
        return this.sendMessage<VoteData>(
            API_ACTIONS.GET_VOTES,
            {userId: parsedUserId},
            options
        );
    }

    // Gets vote data for multiple users with batching
    async getMultipleVotes(
        userIds: (string | number)[],
        batchOptions: BatchOptions = {}
    ): Promise<VoteData[]> {
        // Validate and parse all IDs first
        const parsedUserIds = userIds
            .map(id => {
                try {
                    return this.parseUserId(id);
                } catch {
                    return null;
                }
            })
            .filter((id): id is number => id !== null);

        if (parsedUserIds.length === 0) {
            throw new Error("No valid user IDs provided for vote batch check");
        }

        const batchSize = batchOptions.batchSize ?? API_CONFIG.BATCH_SIZE;
        const batchDelay = batchOptions.batchDelay ?? API_CONFIG.BATCH_DELAY;

        // Split into batches
        const batches = this.chunkArray(parsedUserIds, batchSize);
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
                const response = await browser.runtime.sendMessage(message) as ApiResponse<T>;

                if (response && response.success) {
                    return response.data as T;
                } else {
                    // Create structured error with additional properties
                    const error = new Error(response.error || MESSAGES.ERROR.GENERIC) as Error & {
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

        throw new Error(MESSAGES.ERROR.GENERIC);
    }

    // Determines if an error should trigger a retry attempt
    private isRetryableError(error: Error): boolean {
        const errorStr = error.message?.toLowerCase() || '';

        // Network errors, timeouts, and rate limits are retryable
        return errorStr.includes('network') ||
            errorStr.includes('timeout') ||
            errorStr.includes('fetch') ||
            errorStr.includes('rate limit') ||
            errorStr.includes('429');
    }

    // Utility function to pause execution
    private sleep(ms: number): Promise<void> {
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

    // Validates and parses user ID to number
    private parseUserId(userId: string | number): number {
        const parsed = typeof userId === 'string' ? parseInt(userId, 10) : userId;
        if (isNaN(parsed) || parsed <= 0) {
            throw new Error(MESSAGES.ERROR.INVALID_USER_ID);
        }
        return parsed;
    }
}

export const apiClient = new RotectorApiClient(); 