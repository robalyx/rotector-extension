import type {
	OutfitWithThumbnail,
	PaginatedOutfitsResult,
	CurrentAvatarInfo
} from '../../types/api';
import { ROBLOX_API } from '../../types/constants';
import { logger } from '../../utils/logging/logger';
import {
	parseRobloxAvatarThumbnail,
	parseRobloxOutfitsResponse,
	parseRobloxThumbnailResponse,
	parseRobloxUserBasic
} from '../../schemas/roblox-api';

export const THUMBNAIL_RETRY_DELAY = 2000;

const PICKER_ITEMS_PAGE_ONE = 8;
const PICKER_ITEMS_OTHER_PAGES = 9;

export const VIEWER_ITEMS_PER_PAGE = 9;

const pageCache = new Map<string, PaginatedOutfitsResult>();
const pendingRequests = new Map<string, Promise<PaginatedOutfitsResult>>();

// Returns a page of outfits using cached cursor chains and dedupes concurrent fetches per page
export async function getUserOutfits(
	userId: string | number,
	page = 1,
	itemsPerPage?: number
): Promise<PaginatedOutfitsResult> {
	const buildKey = (p: number) => {
		const resolved = itemsPerPage ?? (p === 1 ? PICKER_ITEMS_PAGE_ONE : PICKER_ITEMS_OTHER_PAGES);
		return `${String(userId)}:${String(p)}:${String(resolved)}`;
	};
	const cacheKey = buildKey(page);

	const cached = pageCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const pending = pendingRequests.get(cacheKey);
	if (pending) {
		return pending;
	}

	let cursor: string | null = null;
	if (page > 1) {
		const prevPage =
			pageCache.get(buildKey(page - 1)) ?? (await getUserOutfits(userId, page - 1, itemsPerPage));
		cursor = prevPage.nextCursor;
		if (!cursor) {
			return { outfits: [], currentPage: page, hasNextPage: false, nextCursor: null };
		}
	}

	const promise = fetchOutfitsWithThumbnails(userId, page, cursor, itemsPerPage);
	pendingRequests.set(cacheKey, promise);

	try {
		const result = await promise;
		pageCache.set(cacheKey, result);
		return result;
	} finally {
		pendingRequests.delete(cacheKey);
	}
}

async function fetchOutfitsWithThumbnails(
	userId: string | number,
	page: number,
	cursor: string | null,
	fixedItemsPerPage?: number
): Promise<PaginatedOutfitsResult> {
	const itemsPerPage =
		fixedItemsPerPage ?? (page === 1 ? PICKER_ITEMS_PAGE_ONE : PICKER_ITEMS_OTHER_PAGES);
	let outfitsUrl = `${ROBLOX_API.AVATAR}/v2/avatar/users/${String(userId)}/outfits?itemsPerPage=${String(itemsPerPage)}&isEditable=true`;
	if (cursor) {
		outfitsUrl += `&paginationToken=${encodeURIComponent(cursor)}`;
	}

	const outfitsResponse = await fetch(outfitsUrl, {
		credentials: 'include'
	});

	if (!outfitsResponse.ok) {
		if (outfitsResponse.status === 400) {
			return {
				outfits: [],
				currentPage: page,
				hasNextPage: false,
				nextCursor: null
			};
		}
		throw new Error(`Failed to fetch outfits: ${String(outfitsResponse.status)}`);
	}

	const outfitsData = parseRobloxOutfitsResponse(await outfitsResponse.json());
	const thumbnails = await batchFetchThumbnails(outfitsData.data.map((o) => o.id));

	const outfits: OutfitWithThumbnail[] = outfitsData.data.map((outfit) => {
		const result = thumbnails.get(outfit.id);
		if (typeof result === 'string' && result !== 'blocked') {
			return { ...outfit, thumbnailUrl: result, thumbnailState: 'completed' as const };
		}
		if (result === null) {
			return { ...outfit, thumbnailUrl: null, thumbnailState: 'pending' as const };
		}
		return { ...outfit, thumbnailUrl: null, thumbnailState: 'error' as const };
	});

	const hasMore = !!outfitsData.paginationToken;

	return {
		outfits,
		currentPage: page,
		hasNextPage: hasMore,
		nextCursor: hasMore ? outfitsData.paginationToken : null
	};
}

// Returns a map per id where Pending is null, Blocked is the literal "blocked", otherwise the image URL
export async function batchFetchThumbnails(
	outfitIds: number[]
): Promise<Map<number, string | null>> {
	const results = new Map<number, string | null>();

	if (outfitIds.length === 0) {
		return results;
	}

	const requestBody = outfitIds.map((id) => ({
		requestId: `${String(id)}::Outfit:150x150:webp:regular:`,
		type: 'Outfit',
		targetId: id,
		format: 'webp',
		size: '150x150'
	}));

	try {
		const response = await fetch(`${ROBLOX_API.THUMBNAILS}/v1/batch`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(requestBody),
			credentials: 'include'
		});

		if (!response.ok) {
			logger.warn('Failed to fetch thumbnails:', response.status);
			return results;
		}

		const data = parseRobloxThumbnailResponse(await response.json());

		for (const item of data.data) {
			if (item.state === 'Completed' && item.imageUrl) {
				results.set(item.targetId, item.imageUrl);
			} else if (item.state === 'Pending') {
				results.set(item.targetId, null);
			} else {
				results.set(item.targetId, 'blocked');
			}
		}
	} catch (error) {
		logger.error('Error fetching thumbnails:', error);
	}

	return results;
}

export function updateCachedThumbnail(
	userId: string | number,
	outfitId: number,
	thumbnailUrl: string
): void {
	for (const [key, cached] of pageCache.entries()) {
		if (key.startsWith(`${String(userId)}:`)) {
			const outfit = cached.outfits.find((o) => o.id === outfitId);
			if (outfit) {
				outfit.thumbnailUrl = thumbnailUrl;
				outfit.thumbnailState = 'completed';
			}
		}
	}
}

export async function getCurrentAvatarInfo(
	userId: string | number
): Promise<CurrentAvatarInfo | null> {
	try {
		const [userResponse, thumbnailResponse] = await Promise.all([
			fetch(`${ROBLOX_API.USERS}/v1/users/${String(userId)}`, { credentials: 'include' }),
			fetch(
				`${ROBLOX_API.THUMBNAILS}/v1/users/avatar?userIds=${String(userId)}&size=150x150&format=webp`,
				{ credentials: 'include' }
			)
		]);

		if (!userResponse.ok) {
			logger.warn('Failed to fetch user info:', userResponse.status);
			return null;
		}

		const userData = parseRobloxUserBasic(await userResponse.json());
		let thumbnailUrl: string | null = null;

		if (thumbnailResponse.ok) {
			const thumbnailData = parseRobloxAvatarThumbnail(await thumbnailResponse.json());
			if (thumbnailData.data[0]?.state === 'Completed') {
				thumbnailUrl = thumbnailData.data[0].imageUrl;
			}
		}

		return {
			username: userData.name,
			thumbnailUrl
		};
	} catch (error) {
		logger.error('Error fetching current avatar info:', error);
		return null;
	}
}
