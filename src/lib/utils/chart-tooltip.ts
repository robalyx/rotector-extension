/**
 * Chart tooltip positioning utilities
 * Calculates optimal tooltip position to prevent viewport overflow
 */

export interface TooltipPosition {
	x: number;
	y: number;
	transform: string;
}

export interface ChartDimensions {
	width: number;
	height: number;
}

/**
 * Calculate tooltip position for a chart element
 * Handles viewport bounds checking and optimal positioning
 */
export function calculateTooltipPosition(
	event: MouseEvent,
	chartDimensions: ChartDimensions,
	elementX: number,
	elementY: number,
	elementHeight: number = 0,
	tooltipWidth: number = 160
): TooltipPosition | null {
	const svgRect = (event.currentTarget as SVGElement).closest('svg')?.getBoundingClientRect();
	if (!svgRect) return null;

	// Calculate scale factor between viewBox and rendered size
	const scaleX = svgRect.width / chartDimensions.width;
	const scaleY = svgRect.height / chartDimensions.height;

	// Calculate element's actual screen position
	const elementScreenX = svgRect.left + elementX * scaleX;
	const elementScreenY = svgRect.top + elementY * scaleY;

	// Tooltip positioning
	const tooltipHalf = tooltipWidth / 2;
	const viewportWidth = document.documentElement.clientWidth;

	// Determine horizontal alignment based on available space
	let transform: string;

	if (elementScreenX + tooltipHalf > viewportWidth - 10) {
		// Close to right edge - align tooltip's right edge to element
		transform = 'translate(-100%, -100%)';
	} else if (elementScreenX - tooltipHalf < 10) {
		// Close to left edge - align tooltip's left edge to element
		transform = 'translate(0, -100%)';
	} else {
		// Enough space - center tooltip on element
		transform = 'translate(-50%, -100%)';
	}

	// Calculate Y position with bounds checking
	const rawY = elementScreenY - elementHeight * scaleY - 10;
	const tooltipY = Math.max(12, Math.min(rawY, document.documentElement.clientHeight - 12));

	return {
		x: elementScreenX,
		y: tooltipY,
		transform
	};
}

/**
 * Calculate tooltip position for bar charts
 * Uses bar width to center tooltip on bar
 */
export function calculateBarTooltipPosition(
	event: MouseEvent,
	chartDimensions: ChartDimensions,
	barX: number,
	barY: number,
	barWidth: number,
	barHeight: number,
	tooltipWidth: number = 160
): TooltipPosition | null {
	// Calculate bar center X position
	const barCenterX = barX + barWidth / 2;

	return calculateTooltipPosition(
		event,
		chartDimensions,
		barCenterX,
		barY,
		barHeight,
		tooltipWidth
	);
}
