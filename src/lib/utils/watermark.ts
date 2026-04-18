import { STATUS, type StatusFlag } from '@/lib/types/constants';

// Watermark rendering parameters
const FONT = '10px monospace';
const ROTATION_DEG = 20;
const ROTATION_RAD = (ROTATION_DEG * Math.PI) / 180;
const ROW_HEIGHT = 28;
const COL_GAP = 40;
const TILE_PADDING = 60;
const GUARD_INTERVAL_MS = 300;

// Theme-dependent fill colors
const FILL_DARK = 'rgba(255, 255, 255, 0.003)';
const FILL_LIGHT = 'rgba(0, 0, 0, 0.003)';

// Reverse lookup from StatusFlag value to its STATUS.FLAGS key name
const FLAG_NAMES = Object.fromEntries(
	Object.entries(STATUS.FLAGS).map(([name, value]) => [value, name])
) as Record<StatusFlag, string>;

function buildWatermarkText(userId: string, flagType: StatusFlag, timestamp: number): string {
	const date = `${new Date(timestamp * 1000).toISOString().slice(0, 19)}Z`;
	return `${FLAG_NAMES[flagType]} | ${userId} | ${date}`;
}

// Render a single repeating tile on an off-screen canvas and returning a PNG data URI
export function renderWatermarkTile(
	userId: string,
	flagType: StatusFlag,
	timestamp: number,
	theme: 'light' | 'dark'
): string {
	const text = buildWatermarkText(userId, flagType, timestamp);

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas 2D context unavailable');

	// Measure text width to determine tile size
	ctx.font = FONT;
	const textWidth = ctx.measureText(text).width;
	const cellWidth = textWidth + COL_GAP;

	// Tile must be large enough that the rotated text pattern repeats seamlessly.
	// Two full text repetitions per axis plus padding for the rotation overhang.
	const tileSize = Math.ceil(cellWidth * 2) + TILE_PADDING;
	canvas.width = tileSize;
	canvas.height = tileSize;

	ctx.font = FONT;
	ctx.fillStyle = theme === 'dark' ? FILL_DARK : FILL_LIGHT;

	// Rotate around the tile center so text runs diagonally
	ctx.translate(tileSize / 2, tileSize / 2);
	ctx.rotate(ROTATION_RAD);
	ctx.translate(-tileSize / 2, -tileSize / 2);

	// Over-draw to cover corners after rotation
	const span = tileSize * 2;
	for (let y = -span; y < span; y += ROW_HEIGHT) {
		for (let x = -span; x < span; x += cellWidth) {
			ctx.fillText(text, x, y);
		}
	}

	return canvas.toDataURL('image/png');
}

export function guardWatermark(element: HTMLElement, dataUri: string): () => void {
	const apply = () => {
		element.style.backgroundImage = `url("${dataUri}")`;
	};

	// Match the exact tile URI so a substituted PNG data URI cannot satisfy the check
	const reapplyIfMissing = () => {
		if (!element.style.backgroundImage.includes(dataUri)) apply();
	};

	apply();

	// Re-apply when the style attribute is modified
	const observer = new MutationObserver(reapplyIfMissing);
	observer.observe(element, { attributes: true, attributeFilter: ['style'] });

	// Periodic fallback in case the observer is disconnected
	const interval = setInterval(reapplyIfMissing, GUARD_INTERVAL_MS);

	return () => {
		observer.disconnect();
		clearInterval(interval);
		element.style.backgroundImage = '';
	};
}
