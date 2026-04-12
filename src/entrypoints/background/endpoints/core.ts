import type {
	GroupStatus,
	GroupTrackedUsersResponse,
	OutfitSnapshotResponse,
	QueueLimitsData,
	QueueResult,
	RobloxUserDiscordLookup,
	UserStatus,
	VoteData,
	VoteResult
} from '@/lib/types/api';
import type { QueueStatusResponse } from '@/lib/types/queue-history';
import type { ActivityHours, StatsResponse } from '@/lib/types/stats';
import { API_CONFIG, STATUS, VOTE_TYPES, type VoteType } from '@/lib/types/constants';
import { logger } from '@/lib/utils/logger';
import { makeHttpRequest } from '../http-client';
import {
	extractResponseData,
	getExcludeAdvancedInfoSetting,
	processBatchEntityIds,
	validateEntityId
} from '../utils';

// Backend cap on names per request
const OUTFIT_SNAPSHOT_MAX_NAMES = 50;

interface RawOutfitSnapshotApiResult {
	name: string;
	urls: string[];
}

interface RawOutfitSnapshotApiResponse {
	results: RawOutfitSnapshotApiResult[];
}

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
	clientId?: string,
	lookupContext?: string
): Promise<GroupStatus[]> {
	const sanitizedGroupIds = processBatchEntityIds(groupIds);

	const requestBody = {
		ids: sanitizedGroupIds.map((id) => parseInt(id, 10))
	};

	const response = await makeHttpRequest(API_CONFIG.ENDPOINTS.GROUP_CHECK, {
		method: 'POST',
		body: JSON.stringify(requestBody),
		clientId,
		lookupContext
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

// Get stats payload like totals, funding, activity time series
export async function getStats(hours: ActivityHours): Promise<StatsResponse> {
	const url = `${API_CONFIG.ENDPOINTS.GET_STATS}?hours=${hours}`;
	const response = await makeHttpRequest(url, { method: 'GET' });
	return extractResponseData<StatsResponse>(response);
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

// Get tracked users for a group
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

// Fetch an image URL and encode as a base64 data URL
async function fetchImageAsDataUrl(url: string): Promise<string> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Image fetch failed with status ${response.status}`);
	}

	const buffer = await response.arrayBuffer();
	const bytes = new Uint8Array(buffer);

	const chunkSize = 0x8000;
	let binary = '';
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const chunk = bytes.subarray(i, i + chunkSize);
		binary += String.fromCharCode(...chunk);
	}

	return `data:image/webp;base64,${btoa(binary)}`;
}

// Look up R2 snapshot URLs for a user's outfits by name and eagerly inline
// only the primary (collapsed-state) thumbnail as a data URL.
export async function lookupOutfitsByName(
	userId: string | number,
	names: string[],
	clientId?: string
): Promise<OutfitSnapshotResponse> {
	const sanitizedUserId = validateEntityId(userId);

	const requestBody = {
		userId: sanitizedUserId,
		names: names.slice(0, OUTFIT_SNAPSHOT_MAX_NAMES)
	};

	const response = await makeHttpRequest(API_CONFIG.ENDPOINTS.LOOKUP_OUTFITS_BY_NAME, {
		method: 'POST',
		body: JSON.stringify(requestBody),
		clientId
	});

	const apiResponse = extractResponseData<RawOutfitSnapshotApiResponse>(response);

	// Fetch the first URL per name, leaving the rest as raw CDN URLs
	const transformed = await Promise.all(
		apiResponse.results.map(async (result) => {
			if (result.urls.length === 0) {
				return {
					name: result.name,
					primaryDataUrl: null,
					rawUrls: [],
					primaryFailed: false
				};
			}

			let primaryDataUrl: string | null = null;
			let primaryFailed = false;
			try {
				primaryDataUrl = await fetchImageAsDataUrl(result.urls[0]);
			} catch (error) {
				logger.error('Failed to inline primary outfit snapshot', {
					url: result.urls[0],
					error
				});
				primaryFailed = true;
			}

			return {
				name: result.name,
				primaryDataUrl,
				rawUrls: result.urls,
				primaryFailed
			};
		})
	);

	return { results: transformed };
}

// Lazy bulk fetcher used by the lightbox to inline additional duplicate-name
// outfit snapshots after the user expands a multi-outfit entry. Returns a
// parallel array where each slot is either a data URL or null on failure.
export async function fetchOutfitImages(urls: string[]): Promise<Array<string | null>> {
	return Promise.all(
		urls.map(async (url) => {
			try {
				return await fetchImageAsDataUrl(url);
			} catch (error) {
				logger.error('Failed to fetch outfit image on demand', { url, error });
				return null;
			}
		})
	);
}
