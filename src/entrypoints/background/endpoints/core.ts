import type {
	GroupStatus,
	QueueLimitsData,
	QueueResult,
	UserStatus,
	VoteData,
	VoteResult
} from '@/lib/types/api';
import type { Statistics } from '@/lib/types/statistics';
import {
	API_CONFIG,
	INTEGRATION_SOURCES,
	STATUS,
	VOTE_TYPES,
	type VoteType
} from '@/lib/types/constants';
import { makeApiRequest } from '../api-client';
import {
	extractResponseData,
	getBloxdbIntegrationSetting,
	getExcludeAdvancedInfoSetting,
	processBatchEntityIds,
	validateEntityId
} from '../utils';

// Check the status of a single user by ID
export async function checkUserStatus(userId: string | number): Promise<UserStatus> {
	const sanitizedUserId = validateEntityId(userId);
	const excludeInfo = await getExcludeAdvancedInfoSetting();
	const bloxdbEnabled = await getBloxdbIntegrationSetting();

	const params = new URLSearchParams();
	params.set('excludeInfo', excludeInfo.toString());

	if (!bloxdbEnabled) {
		params.set('excludeIntegrations', INTEGRATION_SOURCES.BLOXDB);
	}

	const url = `${API_CONFIG.ENDPOINTS.USER_CHECK}/${sanitizedUserId}?${params.toString()}`;
	const response = await makeApiRequest(url, { method: 'GET' });

	const data = extractResponseData<UserStatus>(response);
	data.id = data.id.toString();

	if (data.flagType === STATUS.FLAGS.SAFE) {
		data.reasons = {};
	}

	return data;
}

// Check the status of a single group by ID
export async function checkGroupStatus(groupId: string | number): Promise<GroupStatus> {
	const sanitizedGroupId = validateEntityId(groupId);

	const url = `${API_CONFIG.ENDPOINTS.GROUP_CHECK}/${sanitizedGroupId}`;
	const response = await makeApiRequest(url, { method: 'GET' });

	const data = extractResponseData<GroupStatus>(response);
	data.id = data.id.toString();

	if (data.flagType === STATUS.FLAGS.SAFE) {
		data.reasons = {};
	}

	return data;
}

// Check the status of multiple users in a batch request
export async function checkMultipleUsers(userIds: Array<string | number>): Promise<UserStatus[]> {
	const sanitizedUserIds = processBatchEntityIds(userIds);
	const excludeInfo = await getExcludeAdvancedInfoSetting();
	const bloxdbEnabled = await getBloxdbIntegrationSetting();

	const requestBody: Record<string, unknown> = {
		ids: sanitizedUserIds.map((id) => parseInt(id, 10)),
		...(excludeInfo && { excludeInfo: true })
	};

	if (!bloxdbEnabled) {
		requestBody.excludeIntegrations = [INTEGRATION_SOURCES.BLOXDB];
	}

	const response = await makeApiRequest(API_CONFIG.ENDPOINTS.MULTIPLE_USER_CHECK, {
		method: 'POST',
		body: JSON.stringify(requestBody)
	});

	const responseData = extractResponseData<Record<string, UserStatus>>(response);
	const data = Object.values(responseData);
	data.forEach((status) => {
		status.id = status.id.toString();
		if (status.flagType === STATUS.FLAGS.SAFE) {
			status.reasons = {};
		}
	});
	return data;
}

// Check the status of multiple groups in a batch request
export async function checkMultipleGroups(
	groupIds: Array<string | number>
): Promise<GroupStatus[]> {
	const sanitizedGroupIds = processBatchEntityIds(groupIds);

	const requestBody = {
		ids: sanitizedGroupIds.map((id) => parseInt(id, 10))
	};

	const response = await makeApiRequest(API_CONFIG.ENDPOINTS.GROUP_CHECK, {
		method: 'POST',
		body: JSON.stringify(requestBody)
	});

	const responseData = extractResponseData<Record<string, GroupStatus>>(response);
	const data = Object.values(responseData);
	data.forEach((status) => {
		status.id = status.id.toString();
		if (status.flagType === STATUS.FLAGS.SAFE) {
			status.reasons = {};
		}
	});
	return data;
}

// Queue a user for review by the moderation system
export async function queueUser(
	userId: string | number,
	inappropriateOutfit: boolean = false,
	inappropriateProfile: boolean = false,
	inappropriateFriends: boolean = false,
	inappropriateGroups: boolean = false
): Promise<QueueResult> {
	const sanitizedUserId = validateEntityId(userId);

	const requestBody = {
		id: parseInt(sanitizedUserId, 10),
		inappropriate_outfit: inappropriateOutfit,
		inappropriate_profile: inappropriateProfile,
		inappropriate_friends: inappropriateFriends,
		inappropriate_groups: inappropriateGroups
	};

	const response = await makeApiRequest(API_CONFIG.ENDPOINTS.QUEUE_USER, {
		method: 'POST',
		body: JSON.stringify(requestBody)
	});

	return response as QueueResult;
}

// Submit a community vote (upvote/downvote) for a user
export async function submitVote(userId: string | number, voteType: number): Promise<VoteResult> {
	const sanitizedUserId = validateEntityId(userId);

	if (voteType !== VOTE_TYPES.UPVOTE && voteType !== VOTE_TYPES.DOWNVOTE) {
		throw new Error('Invalid vote type. Must be 1 (upvote) or -1 (downvote)');
	}

	const response = await makeApiRequest(`${API_CONFIG.ENDPOINTS.SUBMIT_VOTE}/${sanitizedUserId}`, {
		method: 'POST',
		body: JSON.stringify({ voteType })
	});

	const voteData = extractResponseData<VoteData>(response);

	return {
		success: true,
		userId: sanitizedUserId.toString(),
		voteType: voteType as VoteType,
		newVoteData: voteData
	};
}

// Get vote data for a single user
export async function getVotes(userId: string | number): Promise<VoteData> {
	const sanitizedUserId = validateEntityId(userId);

	const response = await makeApiRequest(
		`${API_CONFIG.ENDPOINTS.GET_VOTES}/${sanitizedUserId}?includeVote=true`,
		{
			method: 'GET'
		}
	);

	return extractResponseData<VoteData>(response);
}

// Get vote data for multiple users in a batch request
export async function getMultipleVotes(userIds: Array<string | number>): Promise<VoteData[]> {
	const sanitizedUserIds = processBatchEntityIds(userIds);

	const response = await makeApiRequest(`${API_CONFIG.ENDPOINTS.GET_VOTES}?includeVote=true`, {
		method: 'POST',
		body: JSON.stringify({ ids: sanitizedUserIds.map((id) => parseInt(id, 10)) })
	});

	return extractResponseData<VoteData[]>(response);
}

// Get extension usage statistics
export async function getStatistics(): Promise<Statistics> {
	const response = await makeApiRequest(API_CONFIG.ENDPOINTS.GET_STATISTICS, {
		method: 'GET'
	});

	return (response as { data?: Statistics }).data ?? (response as Statistics);
}

// Get queue limits for current IP
export async function getQueueLimits(): Promise<QueueLimitsData> {
	const response = await makeApiRequest(API_CONFIG.ENDPOINTS.QUEUE_LIMITS, {
		method: 'GET'
	});

	return extractResponseData<QueueLimitsData>(response);
}
