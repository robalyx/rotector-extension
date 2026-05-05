import type {
	GroupStatus,
	GroupTrackedUsersResponse,
	QueueLimitsData,
	QueueResult,
	RobloxUserDiscordLookup,
	UserStatus,
	VoteData,
	VoteResult
} from '@/lib/types/api';
import type { QueueStatusResponse } from '@/lib/types/queue-history';
import type { ActivityHours, StatsResponse } from '@/lib/types/stats';
import { API_CONFIG, VOTE_TYPES } from '@/lib/types/constants';
import { SETTINGS_KEYS } from '@/lib/types/settings';
import { getStorage } from '@/lib/utils/storage';
import {
	parseGroupStatus,
	parseGroupStatusMap,
	parseGroupTrackedUsers,
	parseQueueLimits,
	parseQueueResult,
	parseQueueStatusResponse,
	parseRobloxUserDiscordLookup,
	parseUserStatus,
	parseUserStatusMap,
	parseVoteData
} from '@/lib/schemas/rotector';
import { parseStatsResponse } from '@/lib/schemas/stats';
import { makeHttpRequest } from '../http-client';
import { processBatchEntityIds, validateEntityId } from '@/lib/utils/dom/sanitizer';

export async function checkUserStatus(
	userId: string | number,
	clientId?: string,
	readPrimary?: boolean
): Promise<UserStatus> {
	const sanitizedUserId = validateEntityId(userId);
	const excludeInfo = !(await getStorage<boolean>(
		'sync',
		SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED,
		false
	));

	const params = new URLSearchParams();
	params.set('excludeInfo', excludeInfo.toString());

	const url = `${API_CONFIG.ENDPOINTS.USER_CHECK}/${sanitizedUserId}?${params.toString()}`;
	return makeHttpRequest(url, { method: 'GET', clientId, readPrimary, parse: parseUserStatus });
}

export async function checkGroupStatus(
	groupId: string | number,
	clientId?: string
): Promise<GroupStatus> {
	const sanitizedGroupId = validateEntityId(groupId);

	const url = `${API_CONFIG.ENDPOINTS.GROUP_CHECK}/${sanitizedGroupId}`;
	return makeHttpRequest(url, { method: 'GET', clientId, parse: parseGroupStatus });
}

export async function checkMultipleUsers(
	userIds: Array<string | number>,
	clientId?: string,
	lookupContext?: string,
	readPrimary?: boolean
): Promise<UserStatus[]> {
	const sanitizedUserIds = processBatchEntityIds(userIds);
	const excludeInfo = !(await getStorage<boolean>(
		'sync',
		SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED,
		false
	));

	const requestBody: Record<string, unknown> = {
		ids: sanitizedUserIds.map((id) => parseInt(id, 10)),
		...(excludeInfo && { excludeInfo: true })
	};

	const map = await makeHttpRequest(API_CONFIG.ENDPOINTS.USER_CHECK, {
		method: 'POST',
		body: JSON.stringify(requestBody),
		clientId,
		lookupContext,
		readPrimary,
		parse: parseUserStatusMap
	});

	return Object.values(map);
}

export async function checkMultipleGroups(
	groupIds: Array<string | number>,
	clientId?: string,
	lookupContext?: string
): Promise<GroupStatus[]> {
	const sanitizedGroupIds = processBatchEntityIds(groupIds);

	const requestBody = {
		ids: sanitizedGroupIds.map((id) => parseInt(id, 10))
	};

	const map = await makeHttpRequest(API_CONFIG.ENDPOINTS.GROUP_CHECK, {
		method: 'POST',
		body: JSON.stringify(requestBody),
		clientId,
		lookupContext,
		parse: parseGroupStatusMap
	});

	return Object.values(map);
}

export async function queueUser(
	userId: string | number,
	outfitNames: string[] = [],
	outfitIds: number[] = [],
	inappropriateProfile: boolean = false,
	inappropriateFriends: boolean = false,
	inappropriateGroups: boolean = false,
	clientId?: string,
	captchaToken?: string
): Promise<QueueResult> {
	const sanitizedUserId = validateEntityId(userId);

	const requestBody = {
		id: parseInt(sanitizedUserId, 10),
		inappropriate_profile: inappropriateProfile,
		inappropriate_friends: inappropriateFriends,
		inappropriate_groups: inappropriateGroups,
		...(outfitNames.length > 0 && { outfit_names: outfitNames }),
		...(outfitIds.length > 0 && { outfit_ids: outfitIds }),
		...(captchaToken && { captcha_token: captchaToken })
	};

	return makeHttpRequest(API_CONFIG.ENDPOINTS.QUEUE_USER, {
		method: 'POST',
		body: JSON.stringify(requestBody),
		clientId,
		rawResponse: true,
		parse: parseQueueResult
	});
}

export async function submitVote(
	userId: string | number,
	voteType: number,
	clientId?: string
): Promise<VoteResult> {
	const sanitizedUserId = validateEntityId(userId);

	if (voteType !== VOTE_TYPES.UPVOTE && voteType !== VOTE_TYPES.DOWNVOTE) {
		throw new Error('Invalid vote type. Must be 1 (upvote) or -1 (downvote)');
	}

	const voteData = await makeHttpRequest(`${API_CONFIG.ENDPOINTS.SUBMIT_VOTE}/${sanitizedUserId}`, {
		method: 'POST',
		body: JSON.stringify({ voteType }),
		clientId,
		parse: parseVoteData
	});

	return {
		success: true,
		userId: parseInt(sanitizedUserId, 10),
		voteType,
		newVoteData: voteData
	};
}

export async function getVotes(userId: string | number, clientId?: string): Promise<VoteData> {
	const sanitizedUserId = validateEntityId(userId);
	return makeHttpRequest(`${API_CONFIG.ENDPOINTS.GET_VOTES}/${sanitizedUserId}?includeVote=true`, {
		method: 'GET',
		clientId,
		parse: parseVoteData
	});
}

export async function getStats(hours: ActivityHours): Promise<StatsResponse> {
	return makeHttpRequest(`${API_CONFIG.ENDPOINTS.GET_STATS}?hours=${String(hours)}`, {
		method: 'GET',
		parse: parseStatsResponse
	});
}

export async function getQueueLimits(clientId?: string): Promise<QueueLimitsData> {
	return makeHttpRequest(API_CONFIG.ENDPOINTS.QUEUE_LIMITS, {
		method: 'GET',
		clientId,
		parse: parseQueueLimits
	});
}

export async function getQueueStatus(
	userIds: number[],
	clientId?: string
): Promise<QueueStatusResponse> {
	return makeHttpRequest(API_CONFIG.ENDPOINTS.QUEUE_STATUS, {
		method: 'POST',
		body: JSON.stringify({ ids: userIds }),
		clientId,
		parse: parseQueueStatusResponse
	});
}

export async function getGroupTrackedUsers(
	groupId: string | number,
	cursor?: string,
	limit: number = 24,
	active?: 'true' | 'false'
): Promise<GroupTrackedUsersResponse> {
	const sanitizedGroupId = validateEntityId(groupId);

	const params = new URLSearchParams();
	params.set('limit', String(Math.min(limit, 100)));
	if (cursor) {
		params.set('cursor', cursor);
	}
	if (active) {
		params.set('active', active);
	}

	const url = `${API_CONFIG.ENDPOINTS.GROUP_CHECK}/${sanitizedGroupId}/tracked-users?${params.toString()}`;
	return makeHttpRequest(url, { method: 'GET', parse: parseGroupTrackedUsers });
}

export async function lookupRobloxUserDiscord(
	userId: string | number,
	clientId?: string
): Promise<RobloxUserDiscordLookup> {
	const sanitizedUserId = validateEntityId(userId);
	return makeHttpRequest(`${API_CONFIG.ENDPOINTS.USER_CHECK}/${sanitizedUserId}/discord`, {
		method: 'GET',
		clientId,
		parse: parseRobloxUserDiscordLookup
	});
}
