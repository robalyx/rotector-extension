import {
  API_ACTIONS,
  API_CONFIG,
  VOTE_TYPES,
  type VoteType,
} from "../types/constants";
import type {
  ApiClientConfig,
  ApiResponse,
  BatchOptions,
  ContentMessage,
  ExtensionReportsResponse,
  ExtensionStatistics,
  ExtensionUserProfile,
  ExtensionUserReport,
  GlobalHistoricalStats,
  GroupStatus,
  LeaderboardResponse,
  MajorOrder,
  QueueLimitsData,
  QueueResult,
  ReportableUserResponse,
  RequestOptions,
  UserStatus,
  VoteData,
  VoteResult,
  WarMapState,
  ZoneDetails,
  ZoneHistoricalStats,
} from "../types/api";
import type { Statistics } from "../types/statistics";
import { logger } from "../utils/logger";
import { sanitizeEntityId } from "../utils/sanitizer";

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

  // Checks the status of a single user
  async checkUser(
    userId: string | number,
    options?: RequestOptions,
  ): Promise<UserStatus> {
    const sanitizedUserId = sanitizeEntityId(userId);
    if (!sanitizedUserId) {
      throw new Error("Invalid user ID provided.");
    }
    return this.sendMessage<UserStatus>(
      API_ACTIONS.CHECK_USER_STATUS,
      { userId: sanitizedUserId },
      options,
    );
  }

  // Checks the status of a single group
  async checkGroup(
    groupId: string | number,
    options?: RequestOptions,
  ): Promise<GroupStatus> {
    const sanitizedGroupId = sanitizeEntityId(groupId);
    if (!sanitizedGroupId) {
      throw new Error("Invalid group ID");
    }
    return this.sendMessage<GroupStatus>(
      API_ACTIONS.CHECK_GROUP_STATUS,
      { groupId: sanitizedGroupId },
      options,
    );
  }

  // Checks the status of multiple users with automatic batching
  async checkMultipleUsers(
    userIds: Array<string | number>,
    batchOptions: BatchOptions = {},
  ): Promise<UserStatus[]> {
    // Validate and sanitize all IDs
    const sanitizedUserIds = userIds
      .map((id) => sanitizeEntityId(id))
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
          { userIds: batch },
          {
            maxRetries: batchOptions.maxRetries,
            retryDelay: batchOptions.retryDelay,
          },
        );

        if (Array.isArray(batchData)) {
          results.push(...batchData);
        } else {
          logger.warn("Unexpected batch response format:", batchData);
        }

        // Add delay between batches if not the last batch
        if (i < batches.length - 1) {
          await this.sleep(batchDelay);
        }
      } catch (error) {
        logger.error(
          `Failed to process batch ${i + 1}/${batches.length}:`,
          error,
        );
        throw error;
      }
    }

    return results;
  }

  // Checks the status of multiple groups with automatic batching
  async checkMultipleGroups(
    groupIds: Array<string | number>,
    batchOptions: BatchOptions = {},
  ): Promise<GroupStatus[]> {
    // Validate and sanitize all IDs
    const sanitizedGroupIds = groupIds
      .map((id) => sanitizeEntityId(id))
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
          { groupIds: batch },
          {
            maxRetries: batchOptions.maxRetries,
            retryDelay: batchOptions.retryDelay,
          },
        );

        if (Array.isArray(batchData)) {
          results.push(...batchData);
        } else {
          logger.warn("Unexpected batch response format:", batchData);
        }

        // Add delay between batches if not the last batch
        if (i < batches.length - 1) {
          await this.sleep(batchDelay);
        }
      } catch (error) {
        logger.error(
          `Failed to process group batch ${i + 1}/${batches.length}:`,
          error,
        );
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
    options?: RequestOptions,
  ): Promise<QueueResult> {
    const sanitizedUserId = sanitizeEntityId(userId);
    if (!sanitizedUserId) {
      throw new Error("Invalid user ID provided.");
    }
    return this.sendMessage<QueueResult>(
      API_ACTIONS.QUEUE_USER,
      {
        userId: sanitizedUserId,
        inappropriateOutfit,
        inappropriateProfile,
        inappropriateFriends,
        inappropriateGroups,
      },
      { maxRetries: 2, retryDelay: 2000, ...options },
    );
  }

  // Gets queue limits for the current IP address
  async getQueueLimits(options?: RequestOptions): Promise<QueueLimitsData> {
    return this.sendMessage<QueueLimitsData>(
      API_ACTIONS.GET_QUEUE_LIMITS,
      {},
      options,
    );
  }

  // Submits a vote for a user
  async submitVote(
    userId: string | number,
    voteType: VoteType,
    options?: RequestOptions,
  ): Promise<VoteResult> {
    const sanitizedUserId = sanitizeEntityId(userId);
    if (!sanitizedUserId) {
      throw new Error("Invalid user ID provided.");
    }

    if (voteType !== VOTE_TYPES.UPVOTE && voteType !== VOTE_TYPES.DOWNVOTE) {
      throw new Error("Invalid vote type. Must be 1 (upvote) or -1 (downvote)");
    }

    return this.sendMessage<VoteResult>(
      API_ACTIONS.SUBMIT_VOTE,
      { userId: sanitizedUserId, voteType },
      { maxRetries: 2, retryDelay: 1000, ...options },
    );
  }

  // Gets vote data for a single user
  async getVotes(
    userId: string | number,
    options?: RequestOptions,
  ): Promise<VoteData> {
    const sanitizedUserId = sanitizeEntityId(userId);
    if (!sanitizedUserId) {
      throw new Error("Invalid user ID provided.");
    }
    return this.sendMessage<VoteData>(
      API_ACTIONS.GET_VOTES,
      { userId: sanitizedUserId },
      options,
    );
  }

  // Gets vote data for multiple users with batching
  async getMultipleVotes(
    userIds: Array<string | number>,
    batchOptions: BatchOptions = {},
  ): Promise<VoteData[]> {
    // Validate and sanitize all IDs
    const sanitizedUserIds = userIds
      .map((id) => sanitizeEntityId(id))
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
          { userIds: batch },
          {
            maxRetries: batchOptions.maxRetries,
            retryDelay: batchOptions.retryDelay,
          },
        );

        if (Array.isArray(batchData)) {
          results.push(...batchData);
        }

        // Add delay between batches if not the last batch
        if (i < batches.length - 1) {
          await this.sleep(batchDelay);
        }
      } catch (error) {
        logger.error(
          `Failed to process vote batch ${i + 1}/${batches.length}:`,
          error,
        );
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
      options,
    );
  }

  // Initiates Discord OAuth login flow
  async initiateDiscordLogin(options?: RequestOptions): Promise<void> {
    await this.sendMessage(
      API_ACTIONS.INITIATE_DISCORD_LOGIN,
      {},
      { maxRetries: 2, retryDelay: 2000, ...options },
    );
  }

  // Gets the current user's profile
  async getExtensionProfile(
    options?: RequestOptions,
  ): Promise<ExtensionUserProfile> {
    return this.sendMessage<ExtensionUserProfile>(
      API_ACTIONS.EXTENSION_GET_PROFILE,
      {},
      options,
    );
  }

  // Updates the current user's anonymous status
  async updateExtensionAnonymous(
    isAnonymous: boolean,
    options?: RequestOptions,
  ): Promise<ExtensionUserProfile> {
    return this.sendMessage<ExtensionUserProfile>(
      API_ACTIONS.EXTENSION_UPDATE_ANONYMOUS,
      { isAnonymous },
      { maxRetries: 2, retryDelay: 1000, ...options },
    );
  }

  // Resets the current user's UUID
  async resetUuid(
    options?: RequestOptions,
  ): Promise<{ uuid: string; message: string }> {
    return this.sendMessage<{ uuid: string; message: string }>(
      API_ACTIONS.EXTENSION_RESET_UUID,
      {},
      { maxRetries: 2, retryDelay: 1000, ...options },
    );
  }

  // Submits a user report
  async submitExtensionReport(
    reportedUserId: number,
    reportReason?: string,
    options?: RequestOptions,
  ): Promise<ExtensionUserReport> {
    if (!reportedUserId || reportedUserId <= 0) {
      throw new Error("Invalid user ID provided.");
    }
    return this.sendMessage<ExtensionUserReport>(
      API_ACTIONS.EXTENSION_SUBMIT_REPORT,
      { reportedUserId, reportReason },
      { maxRetries: 2, retryDelay: 2000, ...options },
    );
  }

  // Gets user's historical reports
  async getExtensionReports(
    limit = 20,
    offset = 0,
    status?: "pending" | "confirmed" | "rejected",
    options?: RequestOptions,
  ): Promise<ExtensionReportsResponse> {
    return this.sendMessage<ExtensionReportsResponse>(
      API_ACTIONS.EXTENSION_GET_REPORTS,
      { limit, offset, status },
      options,
    );
  }

  // Gets extension statistics
  async getExtensionStatistics(
    options?: RequestOptions,
  ): Promise<ExtensionStatistics> {
    return this.sendMessage<ExtensionStatistics>(
      API_ACTIONS.EXTENSION_GET_STATISTICS,
      {},
      options,
    );
  }

  // Gets a random reportable user for the authenticated extension user
  async getReportableUser(
    options?: RequestOptions,
  ): Promise<ReportableUserResponse> {
    return this.sendMessage<ReportableUserResponse>(
      API_ACTIONS.EXTENSION_GET_REPORTABLE_USER,
      {},
      options,
    );
  }

  // Gets 30 days of historical statistics for a specific zone
  async getWarZoneStatistics(
    zoneId: number,
    options?: RequestOptions,
  ): Promise<ZoneHistoricalStats> {
    if (typeof zoneId !== "number" || zoneId < 0) {
      throw new Error("Invalid zone ID provided.");
    }
    return this.sendMessage<ZoneHistoricalStats>(
      API_ACTIONS.WAR_GET_ZONE_STATS,
      { zoneId },
      options,
    );
  }

  // Gets all currently active major orders
  async getWarOrders(options?: RequestOptions): Promise<MajorOrder[]> {
    return this.sendMessage<MajorOrder[]>(
      API_ACTIONS.WAR_GET_ORDERS,
      {},
      options,
    );
  }

  // Gets detailed information about a specific major order
  async getWarOrder(
    orderId: number,
    options?: RequestOptions,
  ): Promise<MajorOrder> {
    if (!orderId || orderId <= 0) {
      throw new Error("Invalid order ID provided.");
    }
    return this.sendMessage<MajorOrder>(
      API_ACTIONS.WAR_GET_ORDER,
      { orderId },
      options,
    );
  }

  // Gets 30 days of global historical statistics
  async getGlobalStatisticsHistory(
    options?: RequestOptions,
  ): Promise<GlobalHistoricalStats> {
    return this.sendMessage<GlobalHistoricalStats>(
      API_ACTIONS.WAR_GET_STATS_HISTORY,
      {},
      options,
    );
  }

  // Gets the complete war map state
  async getWarMap(options?: RequestOptions): Promise<WarMapState> {
    return this.sendMessage<WarMapState>(API_ACTIONS.WAR_GET_MAP, {}, options);
  }

  // Gets detailed information about a specific zone
  async getWarZone(
    zoneId: number,
    options?: RequestOptions,
  ): Promise<ZoneDetails> {
    if (typeof zoneId !== "number" || zoneId < 0) {
      throw new Error("Invalid zone ID provided.");
    }
    return this.sendMessage<ZoneDetails>(
      API_ACTIONS.WAR_GET_ZONE,
      { zoneId },
      options,
    );
  }

  // Gets the leaderboard
  async getLeaderboard(
    limit = 50,
    includeAnonymous = true,
    options?: RequestOptions,
  ): Promise<LeaderboardResponse> {
    if (limit < 1 || limit > 100) {
      throw new Error("Limit must be between 1 and 100.");
    }
    return this.sendMessage<LeaderboardResponse>(
      API_ACTIONS.EXTENSION_GET_LEADERBOARD,
      { limit, includeAnonymous },
      options,
    );
  }

  // Sends a message to the background script with retry logic
  private async sendMessage<T = unknown>(
    action: string,
    data: Record<string, unknown> = {},
    options: RequestOptions = {},
  ): Promise<T> {
    const maxRetries =
      options.maxRetries ?? this.config.maxRetries ?? API_CONFIG.MAX_RETRIES;
    const retryDelay =
      options.retryDelay ?? this.config.retryDelay ?? API_CONFIG.RETRY_DELAY;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const message: ContentMessage = { action, ...data };
        const response: ApiResponse<T> =
          await browser.runtime.sendMessage(message);

        if (response?.success) {
          return response.data as T;
        } else {
          // Create structured error with additional properties
          const error = new Error(
            response.error ?? "An error occurred. Please try again.",
          ) as Error & {
            requestId?: string;
            code?: string;
            type?: string;
          };
          const responseWithError = response as ApiResponse & {
            requestId?: string;
            code?: string;
            type?: string;
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
          logger.warn(
            `API request failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries}):`,
            error,
          );
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw new Error("An error occurred. Please try again.");
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
