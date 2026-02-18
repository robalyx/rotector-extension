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
import type { Statistics } from '@/lib/types/statistics';
import { API_CONFIG, STATUS, VOTE_TYPES, type VoteType } from '@/lib/types/constants';
import { makeHttpRequest } from '../http-client';
import {
	extractResponseData,
	getExcludeAdvancedInfoSetting,
	processBatchEntityIds,
	validateEntityId
} from '../utils';

// Check the status of a single user by ID
export async function checkUserStatus(
	userId: string | number,
	clientId?: string,
	readPrimary?: boolean
): Promise<UserStatus> {
	const sanitizedUserId = validateEntityId(userId);
	const excludeInfo = await getExcludeAdvancedInfoSetting();

	const params = new URLSearchParams();
	params.set('excludeInfo', excludeInfo.toString());

	const url = `${API_CONFIG.ENDPOINTS.USER_CHECK}/${sanitizedUserId}?${params.toString()}`;
	const response = await makeHttpRequest(url, { method: 'GET', clientId, readPrimary });

	const data = extractResponseData<UserStatus>(response);

	if (data.flagType === STATUS.FLAGS.SAFE) {
		data.reasons = {};
	}

	return data;
}

// Check the status of a single group by ID
export async function checkGroupStatus(
	groupId: string | number,
	clientId?: string
): Promise<GroupStatus> {
	const sanitizedGroupId = validateEntityId(groupId);

	const url = `${API_CONFIG.ENDPOINTS.GROUP_CHECK}/${sanitizedGroupId}`;
	const response = await makeHttpRequest(url, { method: 'GET', clientId });

	const data = extractResponseData<GroupStatus>(response);

	if (data.flagType === STATUS.FLAGS.SAFE) {
		data.reasons = {};
	}

	return data;
}

// Check the status of multiple users in a batch request
export async function checkMultipleUsers(
	userIds: Array<string | number>,
	clientId?: string,
	lookupContext?: string,
	readPrimary?: boolean
): Promise<UserStatus[]> {
	const sanitizedUserIds = processBatchEntityIds(userIds);
	const excludeInfo = await getExcludeAdvancedInfoSetting();

	const requestBody: Record<string, unknown> = {
		ids: sanitizedUserIds.map((id) => parseInt(id, 10)),
		...(excludeInfo && { excludeInfo: true })
	};

	const response = await makeHttpRequest(API_CONFIG.ENDPOINTS.USER_CHECK, {
		method: 'POST',
		body: JSON.stringify(requestBody),
		clientId,
		lookupContext,
		readPrimary
	});

	const responseData = extractResponseData<Record<string, UserStatus>>(response);
	const data = Object.values(responseData);
	data.forEach((status) => {
		if (status.flagType === STATUS.FLAGS.SAFE) {
			status.reasons = {};
		}
	});
	return data;
}

// Check the status of multiple groups in a batch request
export async function checkMultipleGroups(
	groupIds: Array<string | number>,
	clientId?: string
): Promise<GroupStatus[]> {
	const sanitizedGroupIds = processBatchEntityIds(groupIds);

	const requestBody = {
		ids: sanitizedGroupIds.map((id) => parseInt(id, 10))
	};

	const response = await makeHttpRequest(API_CONFIG.ENDPOINTS.GROUP_CHECK, {
		method: 'POST',
		body: JSON.stringify(requestBody),
		clientId
	});

	const responseData = extractResponseData<Record<string, GroupStatus>>(response);
	const data = Object.values(responseData);
	data.forEach((status) => {
		if (status.flagType === STATUS.FLAGS.SAFE) {
			status.reasons = {};
		}
	});
	return data;
}

// Queue a user for review by the moderation system
export async function queueUser(
	userId: string | number,
	outfitNames: string[] = [],
	inappropriateProfile: boolean = false,
	inappropriateFriends: boolean = false,
	inappropriateGroups: boolean = false,
	clientId?: string,
	captchaToken?: string
): Promise<QueueResult> {
	const sanitizedUserId = validateEntityId(userId);

	const requestBody: Record<string, unknown> = {
		id: parseInt(sanitizedUserId, 10),
		inappropriate_profile: inappropriateProfile,
		inappropriate_friends: inappropriateFriends,
		inappropriate_groups: inappropriateGroups
	};

	// Only include outfit_names if there are selections
	if (outfitNames.length > 0) {
		requestBody.outfit_names = outfitNames;
	}

	// Include captcha token if provided
	if (captchaToken) {
		requestBody.captcha_token = captchaToken;
	}

	const response = await makeHttpRequest(API_CONFIG.ENDPOINTS.QUEUE_USER, {
		method: 'POST',
		body: JSON.stringify(requestBody),
		clientId
	});

	return response as QueueResult;
}

// Submit a community vote (upvote/downvote) for a user
export async function submitVote(
	userId: string | number,
	voteType: number,
	clientId?: string
): Promise<VoteResult> {
	const sanitizedUserId = validateEntityId(userId);

	if (voteType !== VOTE_TYPES.UPVOTE && voteType !== VOTE_TYPES.DOWNVOTE) {
		throw new Error('Invalid vote type. Must be 1 (upvote) or -1 (downvote)');
	}

	const response = await makeHttpRequest(`${API_CONFIG.ENDPOINTS.SUBMIT_VOTE}/${sanitizedUserId}`, {
		method: 'POST',
		body: JSON.stringify({ voteType }),
		clientId
	});

	const voteData = extractResponseData<VoteData>(response);

	return {
		success: true,
		userId: parseInt(sanitizedUserId, 10),
		voteType: voteType as VoteType,
		newVoteData: voteData
	};
}

// Get vote data for a single user
export async function getVotes(userId: string | number, clientId?: string): Promise<VoteData> {
	const sanitizedUserId = validateEntityId(userId);

	const response = await makeHttpRequest(
		`${API_CONFIG.ENDPOINTS.GET_VOTES}/${sanitizedUserId}?includeVote=true`,
		{
			method: 'GET',
			clientId
		}
	);

	return extractResponseData<VoteData>(response);
}

// Get vote data for multiple users in a batch request
export async function getMultipleVotes(
	userIds: Array<string | number>,
	clientId?: string
): Promise<VoteData[]> {
	const sanitizedUserIds = processBatchEntityIds(userIds);

	const response = await makeHttpRequest(`${API_CONFIG.ENDPOINTS.GET_VOTES}?includeVote=true`, {
		method: 'POST',
		body: JSON.stringify({ ids: sanitizedUserIds.map((id) => parseInt(id, 10)) }),
		clientId
	});

	return extractResponseData<VoteData[]>(response);
}

// Get extension usage statistics
export async function getStatistics(): Promise<Statistics> {
	const response = await makeHttpRequest(API_CONFIG.ENDPOINTS.GET_STATISTICS, {
		method: 'GET'
	});

	return (response as { data?: Statistics }).data ?? (response as Statistics);
}

// Get queue limits for current IP
export async function getQueueLimits(clientId?: string): Promise<QueueLimitsData> {
	const response = await makeHttpRequest(API_CONFIG.ENDPOINTS.QUEUE_LIMITS, {
		method: 'GET',
		clientId
	});

	return extractResponseData<QueueLimitsData>(response);
}

// Check queue status for multiple users
export async function getQueueStatus(
	userIds: number[],
	clientId?: string
): Promise<QueueStatusResponse> {
	const response = await makeHttpRequest(API_CONFIG.ENDPOINTS.QUEUE_STATUS, {
		method: 'POST',
		body: JSON.stringify({ ids: userIds }),
		clientId
	});

	return extractResponseData<QueueStatusResponse>(response);
}

// Get tracked users for a grou
export async function getGroupTrackedUsers(
	groupId: string | number,
	cursor?: string,
	limit: number = 24
): Promise<GroupTrackedUsersResponse> {
	const sanitizedGroupId = validateEntityId(groupId);

	const params = new URLSearchParams();
	params.set('limit', String(Math.min(limit, 100)));
	if (cursor) {
		params.set('cursor', cursor);
	}

	const url = `${API_CONFIG.ENDPOINTS.GROUP_CHECK}/${sanitizedGroupId}/tracked-users?${params.toString()}`;
	const response = await makeHttpRequest(url, { method: 'GET' });

	return extractResponseData<GroupTrackedUsersResponse>(response);
}

// Look up Discord accounts linked to a Roblox user
export async function lookupRobloxUserDiscord(
	userId: string | number,
	clientId?: string
): Promise<RobloxUserDiscordLookup> {
	const sanitizedUserId = validateEntityId(userId);

	const url = `${API_CONFIG.ENDPOINTS.USER_CHECK}/${sanitizedUserId}/discord`;
	const response = await makeHttpRequest(url, { method: 'GET', clientId });

	return extractResponseData<RobloxUserDiscordLookup>(response);
}
