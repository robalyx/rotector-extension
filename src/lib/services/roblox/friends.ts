import { ROBLOX_API } from '../../types/constants';

const FRIENDS_PAGE_LIMIT = 50;

// Walks every friends page until the cursor exhausts, throwing AbortError if signal fires mid-iteration
export async function fetchAllFriendIds(
	userId: string,
	onProgress?: (fetched: number) => void,
	signal?: AbortSignal
): Promise<number[]> {
	const allIds: number[] = [];
	let cursor: string | null = null;

	for (;;) {
		if (signal?.aborted) {
			throw new DOMException('Aborted', 'AbortError');
		}

		const params = new URLSearchParams({ limit: String(FRIENDS_PAGE_LIMIT) });
		if (cursor) {
			params.set('cursor', cursor);
		}

		const init: RequestInit = { credentials: 'include' };
		if (signal) {
			init.signal = signal;
		}

		const response = await fetch(
			`${ROBLOX_API.FRIENDS}/v1/users/${userId}/friends/find?${params}`,
			init
		);

		if (!response.ok) {
			throw new Error(`Failed to fetch friends: ${String(response.status)}`);
		}

		const raw = (await response.json()) as Record<string, unknown>;
		const items = (raw['PageItems'] ?? raw['pageItems'] ?? []) as Array<{ id: number }>;
		cursor = (raw['NextCursor'] ?? raw['nextCursor'] ?? null) as string | null;

		for (const friend of items) {
			if (friend.id > 0) {
				allIds.push(friend.id);
			}
		}

		onProgress?.(allIds.length);

		if (!cursor) break;
	}

	return allIds;
}
