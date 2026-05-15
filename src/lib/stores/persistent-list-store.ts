import { writable, type Writable } from 'svelte/store';
import { logger } from '../utils/logging/logger';
import { getStorage, setStorage, subscribeStorageKey } from '../utils/storage';

const FLUSH_DELAY_MS = 250;

interface PersistentListStoreConfig {
	storageKey: string;
	maxEntries: number;
}

interface PersistentListStore<T> {
	store: Writable<T[]>;
	load: () => Promise<void>;
	add: (entry: T) => Promise<void>;
	clear: () => Promise<void>;
}

// Factory for storage-backed list stores with write queue and cross-context sync
// add() buffers entries in memory and flushes once per FLUSH_DELAY_MS so a burst
// of N adds collapses into a single read+write instead of N round-trips
export function createPersistentListStore<T>(
	config: PersistentListStoreConfig
): PersistentListStore<T> {
	const { storageKey, maxEntries } = config;
	const store = writable<T[]>([]);
	let writeQueue = Promise.resolve();

	let pending: T[] = [];
	let flushTimer: ReturnType<typeof setTimeout> | null = null;
	let pendingFlush: Promise<void> | null = null;
	let resolvePendingFlush: (() => void) | null = null;

	async function load(): Promise<void> {
		try {
			store.set(await getStorage<T[]>('local', storageKey, []));
		} catch (error) {
			logger.warn(`Failed to load ${storageKey}:`, error);
			store.set([]);
		}
	}

	async function save(entries: T[]): Promise<void> {
		try {
			await setStorage('local', storageKey, entries);
			store.set(entries);
		} catch (error) {
			logger.warn(`Failed to save ${storageKey}:`, error);
		}
	}

	function flushPending(): void {
		flushTimer = null;
		const batch = pending;
		const resolver = resolvePendingFlush;
		pending = [];
		pendingFlush = null;
		resolvePendingFlush = null;
		if (batch.length === 0) {
			resolver?.();
			return;
		}
		// Catch inside the chain so a transient getStorage failure doesn't poison
		// writeQueue and silently drop every subsequent batch
		writeQueue = writeQueue.then(async () => {
			try {
				const current = await getStorage<T[]>('local', storageKey, []);
				// Newest-first: reverse the batch so the last add() ends up at index 0
				const merged = [...batch.toReversed(), ...current].slice(0, maxEntries);
				await save(merged);
			} catch (error) {
				logger.warn(`Failed to flush ${storageKey} batch:`, error);
			}
		});
		void writeQueue.then(() => resolver?.());
	}

	function add(entry: T): Promise<void> {
		pending.push(entry);
		pendingFlush ??= new Promise<void>((resolve) => {
			resolvePendingFlush = resolve;
		});
		flushTimer ??= setTimeout(flushPending, FLUSH_DELAY_MS);
		return pendingFlush;
	}

	async function clear(): Promise<void> {
		if (flushTimer) {
			clearTimeout(flushTimer);
			flushTimer = null;
		}
		pending = [];
		const resolver = resolvePendingFlush;
		pendingFlush = null;
		resolvePendingFlush = null;
		writeQueue = writeQueue.then(async () => save([]));
		await writeQueue;
		resolver?.();
	}

	// Cross-context sync via storage change listener
	subscribeStorageKey<T[]>('local', storageKey, (newValue) => {
		store.set(newValue ?? []);
	});

	return { store, load, add, clear };
}
