import { getStorage, removeStorage, setStorage } from '../storage';
import { logger } from '../logging/logger';

interface CacheEnvelope<T> {
	value: T;
	timestamp: number;
}

interface TtlCache<T> {
	read: () => Promise<T | null>;
	write: (value: T) => Promise<void>;
	clear: () => Promise<void>;
}

// Backs a single value to browser storage with a TTL. Read returns null when the
// stored entry is missing or older than ttlMs.
export function createTtlCache<T>(
	area: 'local' | 'sync',
	key: string,
	ttlMs: number,
	label = key
): TtlCache<T> {
	return {
		async read() {
			try {
				const cache = await getStorage<CacheEnvelope<T> | undefined>(area, key, undefined);
				if (!cache || Date.now() - cache.timestamp > ttlMs) return null;
				return cache.value;
			} catch (error) {
				logger.error(`Failed to read ${label} cache:`, error);
				return null;
			}
		},
		async write(value) {
			const cache: CacheEnvelope<T> = { value, timestamp: Date.now() };
			await setStorage(area, key, cache).catch((error: unknown) => {
				logger.error(`Failed to write ${label} cache:`, error);
			});
		},
		async clear() {
			await removeStorage(area, key).catch((error: unknown) => {
				logger.error(`Failed to clear ${label} cache:`, error);
			});
		}
	};
}
