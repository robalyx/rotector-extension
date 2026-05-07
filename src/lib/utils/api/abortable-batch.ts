export interface AbortableBatch {
	nextSignal: () => AbortSignal;
	abort: () => void;
}

// Aborts the prior in-flight signal each time `nextSignal()` is called so callers race the latest request only
export function createAbortableBatch(): AbortableBatch {
	let controller: AbortController | null = null;
	return {
		nextSignal() {
			controller?.abort();
			controller = new AbortController();
			return controller.signal;
		},
		abort() {
			controller?.abort();
			controller = null;
		}
	};
}
