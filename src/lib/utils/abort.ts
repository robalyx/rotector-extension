export function getAbortError(signal?: AbortSignal): Error {
	const reason: unknown = signal?.reason;
	return reason instanceof Error ? reason : new DOMException('Aborted', 'AbortError');
}

export function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === 'AbortError';
}

// Resolves after ms or rejects immediately if the signal aborts, with no leaked timer
export async function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(getAbortError(signal));
			return;
		}

		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);

		const onAbort = () => {
			clearTimeout(timer);
			reject(getAbortError(signal));
		};

		signal?.addEventListener('abort', onAbort, { once: true });
	});
}
