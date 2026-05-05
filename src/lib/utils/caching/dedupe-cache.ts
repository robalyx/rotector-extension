// In-flight dedupe + TTL cache. Multiple concurrent calls for the same key share
// one fetch and subsequent calls within the TTL window return the cached value
// `getTTL` is read on every access so consumers can honor a settings-driven TTL
//
// Note: services/rotector/entity-status.ts intentionally hand-rolls its own
// dedupe queue rather than composing this class. It needs (a) abort coordination
// where the shared fetch is only cancelled when *every* waiter has aborted, and
// (b) a batched-fetch path that fans many keys into a single chunked request.
// Neither fits the single-fetcher contract here.
export class DedupeCache<K, V> {
	private cache = new Map<K, { value: V; timestamp: number }>();
	private pending = new Map<K, Promise<V>>();

	constructor(private getTTL: () => number) {}

	async get(key: K, fetcher: () => Promise<V>): Promise<V> {
		const cached = this.cache.get(key);
		if (cached && Date.now() - cached.timestamp < this.getTTL()) return cached.value;

		const inflight = this.pending.get(key);
		if (inflight) return inflight;

		const promise = fetcher();
		this.pending.set(key, promise);
		try {
			const value = await promise;
			// Only cache if we're still the in-flight entry because a concurrent set() would
			// have deleted pending and written a fresher value we shouldn't clobber
			if (this.pending.get(key) === promise) {
				this.cache.set(key, { value, timestamp: Date.now() });
			}
			return value;
		} finally {
			if (this.pending.get(key) === promise) {
				this.pending.delete(key);
			}
		}
	}

	// Write-through: store value directly without firing the fetcher
	set(key: K, value: V): void {
		this.cache.set(key, { value, timestamp: Date.now() });
		this.pending.delete(key);
	}

	invalidate(key: K): void {
		this.cache.delete(key);
	}

	clear(): void {
		this.cache.clear();
	}
}
