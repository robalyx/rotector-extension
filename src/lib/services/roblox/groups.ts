import { ROBLOX_API } from '../../types/constants';
import type { ApiError } from '../../utils/api/api-error';
import { logger } from '../../utils/logging/logger';
import {
	type GroupRole,
	type MembersResponse,
	type UserPresence,
	parseGroupErrorBody,
	parseGroupThumbnailBatchResponse,
	parseMembersResponse,
	parseRolesApiResponse,
	parseUserPresencesResponse
} from '../../schemas/roblox-api';

export type SortOrder = 'Asc' | 'Desc';

interface ThumbnailRequest {
	requestId: string;
	type: string;
	targetId: number;
	format: string;
	size: string;
}

export const PRESENCE_TYPE = {
	OFFLINE: 0,
	ONLINE: 1,
	IN_GAME: 2,
	IN_STUDIO: 3,
	INVISIBLE: 4
} as const;

// Returns roles sorted by rank ascending
export async function getGroupRoles(groupId: string): Promise<GroupRole[]> {
	const response = await fetch(`${ROBLOX_API.GROUPS}/v1/groups/${groupId}/roles`, {
		credentials: 'include'
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch group roles: ${String(response.status)}`);
	}

	const data = parseRolesApiResponse(await response.json());
	return data.roles.sort((a, b) => a.rank - b.rank);
}

// Throws ApiError carrying status and Roblox error code on failure so callers can branch on robloxErrorCode
export async function getGroupMembers(
	groupId: string,
	roleId: number,
	cursor?: string | null,
	limit: number = 25,
	sortOrder: SortOrder = 'Desc'
): Promise<MembersResponse> {
	const params = new URLSearchParams({
		sortOrder,
		limit: limit.toString()
	});

	if (cursor) {
		params.set('cursor', cursor);
	}

	const response = await fetch(
		`${ROBLOX_API.GROUPS}/v1/groups/${groupId}/roles/${String(roleId)}/users?${String(params)}`,
		{ credentials: 'include' }
	);

	if (!response.ok) {
		const error: ApiError = Object.assign(
			new Error(`Failed to fetch group members: ${String(response.status)}`),
			{ status: response.status }
		);

		try {
			const body = parseGroupErrorBody(await response.json());
			if (body.errors?.[0]?.code) {
				error.robloxErrorCode = body.errors[0].code;
			}
		} catch (parseError) {
			logger.warn('Failed to parse Roblox error response body:', parseError);
		}

		throw error;
	}

	return parseMembersResponse(await response.json());
}

export async function getUserPresences(userIds: number[]): Promise<Map<number, UserPresence>> {
	if (userIds.length === 0) {
		return new Map();
	}

	const response = await fetch(`${ROBLOX_API.PRESENCE}/v1/presence/users`, {
		method: 'POST',
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ userIds })
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch user presences: ${String(response.status)}`);
	}

	const data = parseUserPresencesResponse(await response.json());
	const presenceMap = new Map<number, UserPresence>();

	for (const presence of data.userPresences) {
		presenceMap.set(presence.userId, presence);
	}

	return presenceMap;
}

export async function getMemberThumbnails(userIds: number[]): Promise<Map<number, string>> {
	if (userIds.length === 0) {
		return new Map();
	}

	const requests: ThumbnailRequest[] = userIds.map((userId) => ({
		requestId: `${String(userId)}::AvatarHeadshot:150x150:webp:regular:`,
		type: 'AvatarHeadShot',
		targetId: userId,
		format: 'webp',
		size: '150x150'
	}));

	const response = await fetch(`${ROBLOX_API.THUMBNAILS}/v1/batch`, {
		method: 'POST',
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(requests)
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch thumbnails: ${String(response.status)}`);
	}

	const data = parseGroupThumbnailBatchResponse(await response.json());
	const thumbnailMap = new Map<number, string>();

	for (const item of data.data) {
		if (item.state === 'Completed' && item.imageUrl) {
			thumbnailMap.set(item.targetId, item.imageUrl);
		}
	}

	return thumbnailMap;
}
