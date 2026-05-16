interface TooltipPosition {
	left: number;
	top: number;
	isAbove: boolean;
	bridgeOffsetX: number;
	anchorWidth: number;
}

interface TransformOrigin {
	originX: number;
	originY: number;
}

export function calculateTooltipPosition(
	tooltipRef: HTMLElement,
	anchorElement: HTMLElement
): TooltipPosition {
	const anchorRect = anchorElement.getBoundingClientRect();
	const tooltipRect = tooltipRef.getBoundingClientRect();
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const padding = 16;

	let left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
	let top = anchorRect.bottom + 8;

	left = Math.max(padding, Math.min(left, viewportWidth - tooltipRect.width - padding));

	const isAbove =
		top + tooltipRect.height > viewportHeight - padding &&
		anchorRect.top > tooltipRect.height + padding;

	if (isAbove) {
		top = anchorRect.top - tooltipRect.height - 8;
	}

	// Calculate bridge offset for arrow positioning
	const intendedLeft = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
	const bridgeOffsetX = left - intendedLeft;

	return { left, top, isAbove, bridgeOffsetX, anchorWidth: anchorRect.width };
}

// Calculate transform origin for expanded tooltip animation
export function calculateTransformOrigin(anchorElement: HTMLElement): TransformOrigin {
	const sourceRect = anchorElement.getBoundingClientRect();
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;

	const originX = ((sourceRect.left + sourceRect.width / 2) / viewportWidth) * 100;
	const originY = ((sourceRect.top + sourceRect.height / 2) / viewportHeight) * 100;

	return { originX, originY };
}

export function applyTooltipPosition(tooltipRef: HTMLElement, position: TooltipPosition): void {
	tooltipRef.style.left = `${String(position.left)}px`;
	tooltipRef.style.top = `${String(position.top)}px`;
	tooltipRef.style.setProperty('--tooltip-positioned-above', position.isAbove ? '1' : '0');
	tooltipRef.style.setProperty('--bridge-offset-x', `${String(-position.bridgeOffsetX)}px`);
	tooltipRef.style.setProperty('--bridge-width', `${String(position.anchorWidth)}px`);
}
