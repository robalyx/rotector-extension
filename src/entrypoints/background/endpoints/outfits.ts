import type {
	OutfitSnapshotByIdResponse,
	OutfitSnapshotByIdResult,
	OutfitSnapshotByNameResponse,
	OutfitSnapshotByNameResult,
	OutfitSnapshotResult
} from '@/lib/types/api';
import { API_CONFIG } from '@/lib/types/constants';
import { fetchImageAsDataUrl } from '@/lib/utils/image';
import { logger } from '@/lib/utils/logging/logger';
import { parseOutfitSnapshotById, parseOutfitSnapshotByName } from '@/lib/schemas/rotector';
import { makeHttpRequest } from '../http-client';
import { validateEntityId } from '@/lib/utils/dom/sanitizer';

// Inline the first URL per entry as a data URL and leave the rest as raw CDN URLs
async function inlinePrimaryThumbnail(urls: string[]): Promise<OutfitSnapshotResult> {
	const [firstUrl] = urls;
	if (firstUrl === undefined) {
		return { primaryDataUrl: null, rawUrls: [], primaryFailed: false };
	}

	let primaryDataUrl: string | null = null;
	let primaryFailed = false;
	try {
		primaryDataUrl = await fetchImageAsDataUrl(firstUrl);
	} catch (error) {
		logger.error('Failed to inline primary outfit snapshot', { url: firstUrl, error });
		primaryFailed = true;
	}

	return { primaryDataUrl, rawUrls: urls, primaryFailed };
}

// Look up R2 snapshot URLs for outfits by name and eagerly inline the primary thumbnail
export async function lookupOutfitsByName(
	userId: string | number,
	names: string[],
	clientId?: string
): Promise<OutfitSnapshotByNameResponse> {
	const sanitizedUserId = validateEntityId(userId);

	const requestBody = {
		userId: sanitizedUserId,
		names: names.slice(0, API_CONFIG.OUTFIT_SNAPSHOT_MAX_ITEMS)
	};

	const apiResponse = await makeHttpRequest(API_CONFIG.ENDPOINTS.LOOKUP_OUTFITS_BY_NAME, {
		method: 'POST',
		body: JSON.stringify(requestBody),
		clientId,
		parse: parseOutfitSnapshotByName
	});

	const results: OutfitSnapshotByNameResult[] = await Promise.all(
		apiResponse.results.map(async (result) => ({
			name: result.name,
			...(await inlinePrimaryThumbnail(result.urls))
		}))
	);

	return { results };
}

// Look up R2 snapshot URLs for outfits by id and eagerly inline the primary thumbnail
export async function lookupOutfitsById(
	userId: string | number,
	ids: string[],
	clientId?: string
): Promise<OutfitSnapshotByIdResponse> {
	const sanitizedUserId = validateEntityId(userId);

	const requestBody = {
		userId: sanitizedUserId,
		ids: ids.slice(0, API_CONFIG.OUTFIT_SNAPSHOT_MAX_ITEMS)
	};

	const apiResponse = await makeHttpRequest(API_CONFIG.ENDPOINTS.LOOKUP_OUTFITS_BY_ID, {
		method: 'POST',
		body: JSON.stringify(requestBody),
		clientId,
		parse: parseOutfitSnapshotById
	});

	const results: OutfitSnapshotByIdResult[] = await Promise.all(
		apiResponse.results.map(async (result) => ({
			outfitId: result.outfitId,
			...(await inlinePrimaryThumbnail(result.urls))
		}))
	);

	return { results };
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
