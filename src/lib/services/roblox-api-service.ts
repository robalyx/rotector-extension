import type {
	RobloxOutfitsResponse,
	RobloxThumbnailResponse,
	OutfitWithThumbnail,
	PaginatedOutfitsResult,
	CurrentAvatarInfo
} from '../types/api';
import { logger } from '../utils/logger';

const ROBLOX_AVATAR_API = 'https://avatar.roblox.com';
const ROBLOX_THUMBNAILS_API = 'https://thumbnails.roblox.com';
const ROBLOX_USERS_API = 'https://users.roblox.com';
export const THUMBNAIL_RETRY_DELAY = 2000;
const ITEMS_PAGE_ONE = 8;
const ITEMS_OTHER_PAGES = 9;

class RobloxApiService {
	private readonly pageCache: Map<string, PaginatedOutfitsResult> = new Map();
	private readonly pendingRequests: Map<string, Promise<PaginatedOutfitsResult>> = new Map();

	/**
	 * Fetch user outfits with thumbnails for a specific page
	 */
	async getUserOutfits(userId: string | number, page: number = 1): Promise<PaginatedOutfitsResult> {
		const cacheKey = `${userId}:${page}`;

		// Return cached data if available
		const cached = this.pageCache.get(cacheKey);
		if (cached) {
			return cached;
		}

		// Deduplicate concurrent requests
		const pending = this.pendingRequests.get(cacheKey);
		if (pending) {
			return pending;
		}

		// For page 1, fetch without cursor
		// For subsequent pages, we need the cursor from the previous page
		let cursor: string | null = null;
		if (page > 1) {
			const prevCacheKey = `${userId}:${page - 1}`;
			const prevPage = this.pageCache.get(prevCacheKey);
			if (!prevPage) {
				await this.getUserOutfits(userId, page - 1);
				const prevPageResult = this.pageCache.get(prevCacheKey);
				cursor = prevPageResult?.nextCursor ?? null;
			} else {
				cursor = prevPage.nextCursor;
			}

			if (!cursor) {
				return {
					outfits: [],
					currentPage: page,
					hasNextPage: false,
					nextCursor: null
				};
			}
		}

		const promise = this.fetchOutfitsWithThumbnails(userId, page, cursor);
		this.pendingRequests.set(cacheKey, promise);

		try {
			const result = await promise;
			this.pageCache.set(cacheKey, result);
			return result;
		} finally {
			this.pendingRequests.delete(cacheKey);
		}
	}

	/**
	 * Fetch outfits from Roblox avatar API and combine with thumbnails
	 */
	private async fetchOutfitsWithThumbnails(
		userId: string | number,
		page: number,
		cursor: string | null
	): Promise<PaginatedOutfitsResult> {
		const itemsPerPage = page === 1 ? ITEMS_PAGE_ONE : ITEMS_OTHER_PAGES;
		let outfitsUrl = `${ROBLOX_AVATAR_API}/v2/avatar/users/${userId}/outfits?itemsPerPage=${itemsPerPage}&isEditable=true`;
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
					currentPage: 1,
					hasNextPage: false,
					nextCursor: null
				};
			}
			throw new Error(`Failed to fetch outfits: ${outfitsResponse.status}`);
		}

		const outfitsData = (await outfitsResponse.json()) as RobloxOutfitsResponse;

		if (!outfitsData.data || outfitsData.data.length === 0) {
			return {
				outfits: [],
				currentPage: page,
				hasNextPage: false,
				nextCursor: null
			};
		}

		// Fetch thumbnails in batch
		const thumbnails = await this.batchFetchThumbnails(outfitsData.data.map((o) => o.id));

		// Combine outfit data with thumbnails
		const outfits: OutfitWithThumbnail[] = outfitsData.data.map((outfit) => {
			const result = thumbnails.get(outfit.id);

			if (result === 'blocked' || result === undefined) {
				return { ...outfit, thumbnailUrl: null, thumbnailState: 'error' as const };
			}
			if (result === null) {
				return { ...outfit, thumbnailUrl: null, thumbnailState: 'pending' as const };
			}
			return { ...outfit, thumbnailUrl: result, thumbnailState: 'completed' as const };
		});

		// Empty string or null means no more pages
		const hasMore = Boolean(outfitsData.paginationToken);

		return {
			outfits,
			currentPage: page,
			hasNextPage: hasMore,
			nextCursor: hasMore ? outfitsData.paginationToken : null
		};
	}

	/**
	 * Batch fetch thumbnails for outfits
	 */
	async batchFetchThumbnails(outfitIds: number[]): Promise<Map<number, string | null>> {
		const results = new Map<number, string | null>();

		if (outfitIds.length === 0) {
			return results;
		}

		// Batch request to thumbnails API
		const requestBody = outfitIds.map((id) => ({
			requestId: `${id}::Outfit:150x150:webp:regular:`,
			type: 'Outfit',
			targetId: id,
			format: 'webp',
			size: '150x150'
		}));

		try {
			const response = await fetch(`${ROBLOX_THUMBNAILS_API}/v1/batch`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody),
				credentials: 'include'
			});

			if (!response.ok) {
				logger.warn('Failed to fetch thumbnails:', response.status);
				return results;
			}

			const data = (await response.json()) as RobloxThumbnailResponse;

			for (const item of data.data) {
				if (item.state === 'Completed' && item.imageUrl) {
					results.set(item.targetId, item.imageUrl);
				} else if (item.state === 'Pending') {
					results.set(item.targetId, null);
				} else if (item.state === 'Blocked' || item.state === 'Error') {
					results.set(item.targetId, 'blocked');
				}
			}
		} catch (error) {
			logger.error('Error fetching thumbnails:', error);
		}

		return results;
	}

	/**
	 * Update cached outfit with new thumbnail URL
	 */
	updateCachedThumbnail(userId: string | number, outfitId: number, thumbnailUrl: string): void {
		for (const [key, cached] of this.pageCache.entries()) {
			if (key.startsWith(`${userId}:`)) {
				const outfit = cached.outfits.find((o) => o.id === outfitId);
				if (outfit) {
					outfit.thumbnailUrl = thumbnailUrl;
					outfit.thumbnailState = 'completed';
				}
			}
		}
	}

	/**
	 * Fetch user's current avatar info
	 */
	async getCurrentAvatarInfo(userId: string | number): Promise<CurrentAvatarInfo | null> {
		try {
			// Fetch username and avatar thumbnail
			const [userResponse, thumbnailResponse] = await Promise.all([
				fetch(`${ROBLOX_USERS_API}/v1/users/${userId}`, { credentials: 'include' }),
				fetch(
					`${ROBLOX_THUMBNAILS_API}/v1/users/avatar?userIds=${userId}&size=150x150&format=webp`,
					{ credentials: 'include' }
				)
			]);

			if (!userResponse.ok) {
				logger.warn('Failed to fetch user info:', userResponse.status);
				return null;
			}

			const userData = (await userResponse.json()) as { name: string };
			let thumbnailUrl: string | null = null;

			if (thumbnailResponse.ok) {
				const thumbnailData = (await thumbnailResponse.json()) as {
					data: Array<{ state: string; imageUrl: string | null }>;
				};
				if (thumbnailData.data?.[0]?.state === 'Completed') {
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

	/**
	 * Clear cache for a user or all users
	 */
	clearCache(userId?: string | number): void {
		if (userId) {
			for (const key of this.pageCache.keys()) {
				if (key.startsWith(`${userId}:`)) {
					this.pageCache.delete(key);
				}
			}
		} else {
			this.pageCache.clear();
		}
	}
}

export const robloxApiService = new RobloxApiService();
