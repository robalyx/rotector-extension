import type { FlaggedOutfitInfo } from '@/lib/utils/violation-formatter';

interface OutfitViewerRequest {
	userId: string;
	flaggedOutfits: Map<string, FlaggedOutfitInfo>;
}

let openRequest: OutfitViewerRequest | null = null;
let listener: (() => void) | null = null;

export function onOutfitViewerChange(callback: () => void): () => void {
	listener = callback;
	return () => {
		listener = null;
	};
}

export function openOutfitViewer(
	userId: string,
	flaggedOutfits: Map<string, FlaggedOutfitInfo>
): void {
	openRequest = { userId, flaggedOutfits };
	listener?.();
}

export function closeOutfitViewer(): void {
	openRequest = null;
	listener?.();
}

export function getOutfitViewerRequest(): OutfitViewerRequest | null {
	return openRequest;
}
