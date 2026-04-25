import { writable, type Writable } from 'svelte/store';

interface PersistentListStoreConfig {
	storageKey: string;
	maxEntries: number;
}

interface PersistentListStore<T> {
	store: Writable<T[]>;
	load: () => Promise<void>;
	save: (entries: T[]) => Promise<void>;
	add: (entry: T) => Promise<void>;
	clear: () => Promise<void>;
}

// Factory for storage-backed list stores with write queue and cross-context sync
export function createPersistentListStore<T>(
	config: PersistentListStoreConfig
): PersistentListStore<T> {
	const { storageKey, maxEntries } = config;
	const store = writable<T[]>([]);
	let writeQueue = Promise.resolve();

	async function load(): Promise<void> {
		try {
			const result = await browser.storage.local.get([storageKey]);
			const stored = result[storageKey] as T[] | undefined;
			store.set(stored ?? []);
		} catch (error) {
			console.warn(`[Rotector] Failed to load ${storageKey}:`, error);
			store.set([]);
		}
	}

	async function save(entries: T[]): Promise<void> {
		try {
			await browser.storage.local.set({ [storageKey]: entries });
			store.set(entries);
		} catch (error) {
			console.warn(`[Rotector] Failed to save ${storageKey}:`, error);
		}
	}

	async function add(entry: T): Promise<void> {
		writeQueue = writeQueue.then(async () => {
			const result = await browser.storage.local.get([storageKey]);
			const current = (result[storageKey] as T[] | undefined) ?? [];
			const updated = [entry, ...current].slice(0, maxEntries);
			await save(updated);
		});
		return writeQueue;
	}

	async function clear(): Promise<void> {
		writeQueue = writeQueue.then(async () => save([]));
		return writeQueue;
	}

	// Cross-context sync via storage change listener
	browser.storage.onChanged.addListener((changes, namespace) => {
		if (namespace === 'local' && changes[storageKey]) {
			const newValue = changes[storageKey].newValue as T[] | undefined;
			store.set(newValue ?? []);
		}
	});

	return { store, load, save, add, clear };
}
