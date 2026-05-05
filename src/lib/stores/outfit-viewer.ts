import { writable } from 'svelte/store';
import type { FlaggedOutfitInfo } from '../utils/status/violation-formatter';

interface OutfitViewerRequest {
	userId: string;
	flaggedOutfits: FlaggedOutfitInfo[];
}

export const outfitViewerRequest = writable<OutfitViewerRequest | null>(null);

export function openOutfitViewer(userId: string, flaggedOutfits: FlaggedOutfitInfo[]): void {
	outfitViewerRequest.set({ userId, flaggedOutfits });
}

export function closeOutfitViewer(): void {
	outfitViewerRequest.set(null);
}
