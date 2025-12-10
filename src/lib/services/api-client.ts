import { API_ACTIONS, API_CONFIG, type VoteType } from '../types/constants';
import type {
	ApiResponse,
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
	TranslationResult,
	UserStatus,
	VoteData,
	VoteResult,
	WarMapState,
	ZoneDetails,
	ZoneHistoricalStats
} from '../types/api';
import type { Statistics } from '../types/statistics';
import { restrictedAccessStore } from '../stores/restricted-access';
import { getLoggedInUserId } from '../utils/client-id';
import { logger } from '../utils/logger';
import { get } from 'svelte/store';

// Send message to background script with retry logic
async function sendMessage<T>(
	action: string,
	data: Record<string, unknown> = {},
	options: RequestOptions = {}
): Promise<T> {
	const maxRetries = options.maxRetries ?? API_CONFIG.MAX_RETRIES;
	const retryDelay = options.retryDelay ?? API_CONFIG.RETRY_DELAY;
	let attempt = 0;

	while (attempt <= maxRetries) {
		try {
			const clientId = getLoggedInUserId();
			const message: ContentMessage = { action, ...(clientId && { clientId }), ...data };
			const response: ApiResponse<T> = await browser.runtime.sendMessage(message);

			if (response?.success) {
				return response.data as T;
			}

			// Create structured error with additional properties
			const error = new Error(response.error ?? 'An error occurred. Please try again.') as Error & {
				requestId?: string;
				code?: string;
				type?: string;
				status?: number;
			};
			const responseWithError = response as ApiResponse & {
				requestId?: string;
				code?: string;
				type?: string;
				status?: number;
			};

			if (responseWithError.requestId) error.requestId = responseWithError.requestId;
			if (responseWithError.code) error.code = responseWithError.code;
			if (responseWithError.type) error.type = responseWithError.type;
			if (responseWithError.status !== undefined) error.status = responseWithError.status;

			throw error;
		} catch (error) {
			attempt++;

			// Check if we should retry
			const structuredError = error as Error & { status?: number; type?: string };
			const status = structuredError.status;
			const errorType = structuredError.type;

			if (errorType === 'AbuseDetectionError') {
				throw error;
			}

			const isRetryable =
				status === 429 || status === 408 || (status !== undefined && status >= 500 && status < 600);

			if (attempt <= maxRetries && isRetryable) {
				const delay = retryDelay * attempt;
				logger.warn(
					`API request failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries}):`,
					error
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}

			throw error;
		}
	}

	throw new Error('An error occurred. Please try again.');
}

// API client for backend communication
class RotectorApiClient {
	async checkUser(userId: string | number, options?: RequestOptions): Promise<UserStatus> {
		return sendMessage<UserStatus>(
			API_ACTIONS.CHECK_USER_STATUS,
			{ userId, ...(options?.apiConfig && { apiConfig: options.apiConfig }) },
			options
		);
	}

	async checkGroup(groupId: string | number, options?: RequestOptions): Promise<GroupStatus> {
		return sendMessage<GroupStatus>(API_ACTIONS.CHECK_GROUP_STATUS, { groupId }, options);
	}

	async checkMultipleUsers(
		userIds: Array<string | number>,
		options: RequestOptions = {}
	): Promise<UserStatus[]> {
		return sendMessage<UserStatus[]>(
			API_ACTIONS.CHECK_MULTIPLE_USERS,
			{
				userIds,
				...(options.apiConfig && { apiConfig: options.apiConfig }),
				...(options.lookupContext && { lookupContext: options.lookupContext })
			},
			options
		);
	}

	async checkMultipleGroups(groupIds: Array<string | number>): Promise<GroupStatus[]> {
		return sendMessage<GroupStatus[]>(API_ACTIONS.CHECK_MULTIPLE_GROUPS, { groupIds });
	}

	async queueUser(
		userId: string | number,
		inappropriateOutfit = false,
		inappropriateProfile = false,
		inappropriateFriends = false,
		inappropriateGroups = false
	): Promise<QueueResult> {
		// Block queueing other users when restricted
		const { isRestricted } = get(restrictedAccessStore);
		if (isRestricted) {
			const loggedInUserId = getLoggedInUserId();
			if (loggedInUserId !== userId.toString()) {
				throw new Error('Cannot queue users while access is restricted');
			}
		}

		return sendMessage<QueueResult>(
			API_ACTIONS.QUEUE_USER,
			{
				userId,
				inappropriateOutfit,
				inappropriateProfile,
				inappropriateFriends,
				inappropriateGroups
			},
			{ maxRetries: 2, retryDelay: 2000 }
		);
	}

	async getQueueLimits(): Promise<QueueLimitsData> {
		return sendMessage<QueueLimitsData>(API_ACTIONS.GET_QUEUE_LIMITS, {});
	}

	async submitVote(userId: string | number, voteType: VoteType): Promise<VoteResult> {
		return sendMessage<VoteResult>(
			API_ACTIONS.SUBMIT_VOTE,
			{ userId, voteType },
			{ maxRetries: 2, retryDelay: 1000 }
		);
	}

	async getVotes(userId: string | number): Promise<VoteData> {
		return sendMessage<VoteData>(API_ACTIONS.GET_VOTES, { userId });
	}

	async getMultipleVotes(userIds: Array<string | number>): Promise<VoteData[]> {
		return sendMessage<VoteData[]>(API_ACTIONS.GET_MULTIPLE_VOTES, { userIds });
	}

	async getStatistics(): Promise<Statistics> {
		return sendMessage<Statistics>(API_ACTIONS.GET_STATISTICS, {});
	}

	async initiateDiscordLogin(): Promise<void> {
		await sendMessage(API_ACTIONS.INITIATE_DISCORD_LOGIN, {}, { maxRetries: 2, retryDelay: 2000 });
	}

	async getExtensionProfile(): Promise<ExtensionUserProfile> {
		return sendMessage<ExtensionUserProfile>(API_ACTIONS.EXTENSION_GET_PROFILE, {});
	}

	async updateExtensionAnonymous(isAnonymous: boolean): Promise<ExtensionUserProfile> {
		return sendMessage<ExtensionUserProfile>(
			API_ACTIONS.EXTENSION_UPDATE_ANONYMOUS,
			{ isAnonymous },
			{ maxRetries: 2, retryDelay: 1000 }
		);
	}

	async resetUuid(): Promise<{ uuid: string; message: string }> {
		return sendMessage<{ uuid: string; message: string }>(
			API_ACTIONS.EXTENSION_RESET_UUID,
			{},
			{ maxRetries: 2, retryDelay: 1000 }
		);
	}

	async submitExtensionReport(
		reportedUserId: number,
		reportReason?: string
	): Promise<ExtensionUserReport> {
		return sendMessage<ExtensionUserReport>(
			API_ACTIONS.EXTENSION_SUBMIT_REPORT,
			{ reportedUserId, reportReason },
			{ maxRetries: 2, retryDelay: 2000 }
		);
	}

	async getExtensionReports(
		limit = 20,
		offset = 0,
		status?: 'pending' | 'confirmed' | 'rejected'
	): Promise<ExtensionReportsResponse> {
		return sendMessage<ExtensionReportsResponse>(API_ACTIONS.EXTENSION_GET_REPORTS, {
			limit,
			offset,
			status
		});
	}

	async getExtensionStatistics(): Promise<ExtensionStatistics> {
		return sendMessage<ExtensionStatistics>(API_ACTIONS.EXTENSION_GET_STATISTICS, {});
	}

	async getReportableUser(): Promise<ReportableUserResponse> {
		return sendMessage<ReportableUserResponse>(API_ACTIONS.EXTENSION_GET_REPORTABLE_USER, {});
	}

	async getWarZoneStatistics(zoneId: number): Promise<ZoneHistoricalStats> {
		return sendMessage<ZoneHistoricalStats>(API_ACTIONS.WAR_GET_ZONE_STATS, { zoneId });
	}

	async getWarOrders(): Promise<MajorOrder[]> {
		return sendMessage<MajorOrder[]>(API_ACTIONS.WAR_GET_ORDERS, {});
	}

	async getWarOrder(orderId: number): Promise<MajorOrder> {
		return sendMessage<MajorOrder>(API_ACTIONS.WAR_GET_ORDER, { orderId });
	}

	async getGlobalStatisticsHistory(): Promise<GlobalHistoricalStats> {
		return sendMessage<GlobalHistoricalStats>(API_ACTIONS.WAR_GET_STATS_HISTORY, {});
	}

	async getWarMap(): Promise<WarMapState> {
		return sendMessage<WarMapState>(API_ACTIONS.WAR_GET_MAP, {});
	}

	async getWarZone(zoneId: number): Promise<ZoneDetails> {
		return sendMessage<ZoneDetails>(API_ACTIONS.WAR_GET_ZONE, { zoneId });
	}

	async getLeaderboard(limit = 50, includeAnonymous = true): Promise<LeaderboardResponse> {
		return sendMessage<LeaderboardResponse>(API_ACTIONS.EXTENSION_GET_LEADERBOARD, {
			limit,
			includeAnonymous
		});
	}

	async translateTexts(
		texts: string[],
		targetLanguage: string,
		sourceLanguage: string = 'en'
	): Promise<TranslationResult> {
		return sendMessage<TranslationResult>(API_ACTIONS.TRANSLATE_TEXT, {
			texts,
			targetLanguage,
			sourceLanguage
		});
	}
}

export const apiClient = new RotectorApiClient();
