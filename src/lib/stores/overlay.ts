/**
 * Module-level reference to the shadow root overlay container.
 * Set during content script initialization, used by OverlayPortal
 * to render modals and tooltips inside the shadow DOM.
 */
let overlayContainer: HTMLElement | null = null;

export function setOverlayContainer(container: HTMLElement): void {
	overlayContainer = container;
}

export function getOverlayContainer(): HTMLElement | null {
	return overlayContainer;
}
