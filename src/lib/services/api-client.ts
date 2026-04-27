import { API_ACTIONS, API_CONFIG, type VoteType } from '../types/constants';
import type {
	ApiResponse,
	ContentMessage,
	ExportResult,
	ExtensionReportsResponse,
	ExtensionStatistics,
	ExtensionUserProfile,
	ExtensionUserReport,
	GlobalHistoricalStats,
	GroupStatus,
	GroupTrackedUsersResponse,
	LeaderboardResponse,
	MajorOrder,
	MembershipBadgeUpdatePayload,
	MembershipStatus,
	OutfitSnapshotByIdResponse,
	OutfitSnapshotByNameResponse,
	QueueLimitsData,
	QueueResult,
	ReportableUserResponse,
	RequestOptions,
	RobloxUserDiscordLookup,
	TranslationResult,
	UserStatus,
	VoteData,
	VoteResult,
	WarMapState,
	ZoneDetails,
	ZoneHistoricalStats
} from '../types/api';
import type { ActivityHours, StatsResponse } from '../types/stats';
import { restrictedAccessStore } from '../stores/restricted-access';
import { abortableSleep, getAbortError } from '../utils/abort';
import { getLoggedInUserId } from '../utils/client-id';
import { logger } from '../utils/logger';
import { get } from 'svelte/store';

type StructuredError = Error & {
	status?: number;
	type?: string;
	code?: string;
	requestId?: string;
	rateLimitReset?: number;
};

// Lift structured error fields off a failed ApiResponse envelope
function buildResponseError(response: ApiResponse): StructuredError {
	const resp = response as ApiResponse & {
		requestId?: string;
		code?: string;
		type?: string;
		status?: number;
		rateLimitReset?: number;
	};
	return Object.assign(new Error(response.error ?? 'An error occurred. Please try again.'), {
		...(resp.requestId && { requestId: resp.requestId }),
		...(resp.code && { code: resp.code }),
		...(resp.type && { type: resp.type }),
		...(resp.status !== undefined && { status: resp.status }),
		...(resp.rateLimitReset && { rateLimitReset: resp.rateLimitReset })
	});
}

// Compute retry delay in ms or null when the error should not be retried
function computeRetryDelay(
	error: StructuredError,
	attempt: number,
	retryDelay: number
): number | null {
	const status = error.status;
	const isRetryable =
		status === 429 || status === 408 || (status !== undefined && status >= 500 && status < 600);
	if (!isRetryable) return null;

	if (status === 429 && error.rateLimitReset) {
		return Math.max(error.rateLimitReset * 1000 - Date.now() + 500, 0);
	}
	return retryDelay * attempt;
}

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
		if (options.signal?.aborted) {
			throw getAbortError(options.signal);
		}

		try {
			const clientId = getLoggedInUserId();
			const message: ContentMessage = { action, ...(clientId && { clientId }), ...data };
			const response: ApiResponse<T> = await browser.runtime.sendMessage(message);

			if (response.success) {
				return response.data as T;
			}
			throw buildResponseError(response);
		} catch (error) {
			attempt++;

			const structuredError = error as StructuredError;
			if (structuredError.type === 'AbuseDetectionError') {
				throw error;
			}

			const delay =
				attempt <= maxRetries ? computeRetryDelay(structuredError, attempt, retryDelay) : null;
			if (delay === null) {
				throw error;
			}

			logger.warn(
				`API request failed, retrying in ${String(delay)}ms (attempt ${String(attempt)}/${String(maxRetries)}):`,
				error
			);
			await abortableSleep(delay, options.signal);
		}
	}

	// Unreachable: all loop paths throw, continue, or return
	throw new Error('Unexpected: retry loop exited without resolution');
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

	async checkMultipleGroups(
		groupIds: Array<string | number>,
		options: RequestOptions = {}
	): Promise<GroupStatus[]> {
		return sendMessage<GroupStatus[]>(
			API_ACTIONS.CHECK_MULTIPLE_GROUPS,
			{
				groupIds,
				...(options.lookupContext && { lookupContext: options.lookupContext })
			},
			options
		);
	}

	async getGroupTrackedUsers(
		groupId: string | number,
		cursor?: string,
		limit: number = 24,
		active?: 'true' | 'false'
	): Promise<GroupTrackedUsersResponse> {
		return sendMessage<GroupTrackedUsersResponse>(API_ACTIONS.GET_GROUP_TRACKED_USERS, {
			groupId,
			cursor,
			limit,
			active
		});
	}

	async queueUser(
		userId: string | number,
		outfitNames: string[] = [],
		outfitIds: number[] = [],
		inappropriateProfile = false,
		inappropriateFriends = false,
		inappropriateGroups = false,
		captchaToken?: string
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
				outfitNames,
				outfitIds,
				inappropriateProfile,
				inappropriateFriends,
				inappropriateGroups,
				captchaToken
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

	async getStats(hours: ActivityHours): Promise<StatsResponse> {
		return sendMessage<StatsResponse>(API_ACTIONS.GET_STATS, { hours });
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

	async getMembershipStatus(): Promise<MembershipStatus> {
		return sendMessage<MembershipStatus>(
			API_ACTIONS.EXTENSION_GET_MEMBERSHIP_STATUS,
			{},
			{ maxRetries: 0 }
		);
	}

	async updateMembershipBadge(payload: MembershipBadgeUpdatePayload): Promise<MembershipStatus> {
		return sendMessage<MembershipStatus>(
			API_ACTIONS.EXTENSION_UPDATE_MEMBERSHIP_BADGE,
			payload as Record<string, unknown>,
			{ maxRetries: 0 }
		);
	}

	async clearMembershipBadge(): Promise<MembershipStatus> {
		return sendMessage<MembershipStatus>(
			API_ACTIONS.EXTENSION_CLEAR_MEMBERSHIP_BADGE,
			{},
			{ maxRetries: 0 }
		);
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

	async exportGroupTrackedUsers(
		groupId: string | number,
		format: 'json' | 'csv',
		columns: string[],
		sort: string,
		order: 'asc' | 'desc'
	): Promise<ExportResult> {
		return sendMessage<ExportResult>(
			API_ACTIONS.EXPORT_GROUP_TRACKED_USERS,
			{
				groupId,
				exportFormat: format,
				exportColumns: columns,
				exportSort: sort,
				exportOrder: order
			},
			{ maxRetries: 0 }
		);
	}

	async lookupRobloxUserDiscord(userId: string | number): Promise<RobloxUserDiscordLookup> {
		return sendMessage<RobloxUserDiscordLookup>(API_ACTIONS.LOOKUP_ROBLOX_USER_DISCORD, {
			userId
		});
	}

	async lookupOutfitsByName(
		userId: string | number,
		names: string[]
	): Promise<OutfitSnapshotByNameResponse> {
		return sendMessage<OutfitSnapshotByNameResponse>(API_ACTIONS.LOOKUP_OUTFITS_BY_NAME, {
			userId,
			names
		});
	}

	async lookupOutfitsById(
		userId: string | number,
		ids: string[]
	): Promise<OutfitSnapshotByIdResponse> {
		return sendMessage<OutfitSnapshotByIdResponse>(API_ACTIONS.LOOKUP_OUTFITS_BY_ID, {
			userId,
			ids
		});
	}

	async fetchOutfitImages(imageUrls: string[]): Promise<Array<string | null>> {
		return sendMessage<Array<string | null>>(API_ACTIONS.FETCH_OUTFIT_IMAGES, {
			imageUrls
		});
	}
}

export const apiClient = new RotectorApiClient();
