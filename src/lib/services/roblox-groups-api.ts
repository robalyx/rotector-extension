// Roblox Groups API types and client functions
export interface GroupRole {
	id: number;
	name: string;
	rank: number;
	memberCount: number;
}

export interface GroupMember {
	userId: number;
	username: string;
	displayName: string;
	hasVerifiedBadge: boolean;
}

interface MembersResponse {
	data: GroupMember[];
	previousPageCursor: string | null;
	nextPageCursor: string | null;
}

export type SortOrder = 'Asc' | 'Desc';

interface ThumbnailRequest {
	requestId: string;
	type: string;
	targetId: number;
	token: string;
	format: string;
	size: string;
	version: string;
}

interface ThumbnailResponse {
	requestId: string;
	errorCode: number;
	errorMessage: string;
	targetId: number;
	state: string;
	imageUrl: string;
	version: string;
}

interface RolesApiResponse {
	groupId: number;
	roles: GroupRole[];
}

// Returns roles sorted by rank ascending
export async function getGroupRoles(groupId: string): Promise<GroupRole[]> {
	const response = await fetch(`https://groups.roblox.com/v1/groups/${groupId}/roles`);

	if (!response.ok) {
		throw new Error(`Failed to fetch group roles: ${response.status}`);
	}

	const data = (await response.json()) as RolesApiResponse;
	return data.roles.sort((a, b) => a.rank - b.rank);
}

// Paginated member fetch
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
		`https://groups.roblox.com/v1/groups/${groupId}/roles/${roleId}/users?${params}`
	);

	if (!response.ok) {
		const error = new Error(`Failed to fetch group members: ${response.status}`) as Error & {
			status?: number;
			robloxErrorCode?: number;
		};
		error.status = response.status;

		try {
			const body = (await response.json()) as { errors?: Array<{ code: number }> };
			if (body.errors?.[0]?.code) {
				error.robloxErrorCode = body.errors[0].code;
			}
		} catch (parseError) {
			console.warn('Failed to parse Roblox error response body:', parseError);
		}

		throw error;
	}

	return (await response.json()) as MembersResponse;
}

// Batch fetch avatar headshots via thumbnails API
export async function getMemberThumbnails(userIds: number[]): Promise<Map<number, string>> {
	if (userIds.length === 0) {
		return new Map();
	}

	const requests: ThumbnailRequest[] = userIds.map((userId) => ({
		requestId: `${userId}::AvatarHeadshot:150x150:webp:regular:`,
		type: 'AvatarHeadShot',
		targetId: userId,
		token: '',
		format: 'webp',
		size: '150x150',
		version: ''
	}));

	const response = await fetch('https://thumbnails.roblox.com/v1/batch', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(requests)
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch thumbnails: ${response.status}`);
	}

	const data = (await response.json()) as { data: ThumbnailResponse[] };
	const thumbnailMap = new Map<number, string>();

	for (const item of data.data) {
		if (item.state === 'Completed' && item.imageUrl) {
			thumbnailMap.set(item.targetId, item.imageUrl);
		}
	}

	return thumbnailMap;
}
