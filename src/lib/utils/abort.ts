export function getAbortError(signal?: AbortSignal): Error {
	const reason: unknown = signal?.reason;
	return reason instanceof Error ? reason : new DOMException('Aborted', 'AbortError');
}

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
