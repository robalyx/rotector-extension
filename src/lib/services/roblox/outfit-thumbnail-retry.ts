import type { OutfitWithThumbnail } from '@/lib/types/api';
import { batchFetchThumbnails, updateCachedThumbnail } from './api';

// Re-fetches pending thumbnails and returns a new array with completed/error transitions applied
export async function retryPendingOutfitThumbnails(
	outfits: OutfitWithThumbnail[],
	userId: string | number
): Promise<OutfitWithThumbnail[]> {
	const pending = outfits.filter((o) => o.thumbnailState === 'pending');
	if (pending.length === 0) return outfits;

	const pendingIds = pending.map((o) => o.id);
	const newThumbnails = await batchFetchThumbnails(pendingIds);

	return outfits.map((outfit) => {
		if (outfit.thumbnailState !== 'pending') return outfit;
		const result = newThumbnails.get(outfit.id);
		if (result === null || result === undefined) return outfit;
		if (result === 'blocked') {
			return { ...outfit, thumbnailState: 'error' as const };
		}
		updateCachedThumbnail(userId, outfit.id, result);
		return { ...outfit, thumbnailUrl: result, thumbnailState: 'completed' as const };
	});
}
