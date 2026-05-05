// Module-level singleton holding the shadow root container element. Registered
// once during content-script init by createShadowRootUi and read by OverlayPortal
// when teleporting modal/tooltip DOM into the shadow root.
let overlayContainer: HTMLElement | null = null;

export function registerOverlayContainer(container: HTMLElement): void {
	overlayContainer = container;
}

export function getOverlayContainer(): HTMLElement | null {
	return overlayContainer;
}
