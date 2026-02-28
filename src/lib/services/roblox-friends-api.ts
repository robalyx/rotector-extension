import { logger } from '@/lib/utils/logger';

const FRIENDS_PAGE_LIMIT = 50;

// Fetch all friend IDs for a user via paginated Roblox API
export async function fetchAllFriendIds(
	userId: string,
	onProgress?: (fetched: number) => void,
	signal?: AbortSignal
): Promise<number[]> {
	const allIds: number[] = [];
	let cursor: string | null = null;

	while (true) {
		if (signal?.aborted) {
			throw new DOMException('Aborted', 'AbortError');
		}

		const params = new URLSearchParams({ limit: String(FRIENDS_PAGE_LIMIT) });
		if (cursor) {
			params.set('cursor', cursor);
		}

		const response = await fetch(
			`https://friends.roblox.com/v1/users/${userId}/friends/find?${params}`,
			{ signal }
		);

		if (!response.ok) {
			throw new Error(`Failed to fetch friends: ${response.status}`);
		}

		const raw = (await response.json()) as Record<string, unknown>;
		const items = (raw.PageItems ?? raw.pageItems ?? []) as Array<{ id: number }>;
		cursor = (raw.NextCursor ?? raw.nextCursor ?? null) as string | null;

		for (const friend of items) {
			if (friend.id > 0) {
				allIds.push(friend.id);
			}
		}

		onProgress?.(allIds.length);

		if (!cursor) break;
	}

	logger.debug('Fetched all friend IDs', { userId, count: allIds.length });
	return allIds;
}
