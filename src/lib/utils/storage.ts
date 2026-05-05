import { browser } from 'wxt/browser';

type StorageArea = 'local' | 'sync';

// Storage values are JSON-serializable blobs whose runtime shape is owned by the writer
// and this helper centralizes the unavoidable narrowing so every call site stays cast-free
export async function getStorage<T>(area: StorageArea, key: string, defaultValue: T): Promise<T> {
	const result = await browser.storage[area].get([key]);
	const value = result[key];
	return value === undefined ? defaultValue : (value as T);
}

export async function setStorage(area: StorageArea, key: string, value: unknown): Promise<void> {
	await browser.storage[area].set({ [key]: value });
}

// Reads every key from the area, runtime narrowing belongs to the caller
export async function getAllStorage(area: StorageArea): Promise<Record<string, unknown>> {
	return browser.storage[area].get(null);
}

// Atomic multi-key set used for preset-style writes
export async function setStorageMulti(
	area: StorageArea,
	values: Record<string, unknown>
): Promise<void> {
	await browser.storage[area].set(values);
}

export async function removeStorage(area: StorageArea, key: string | string[]): Promise<void> {
	await browser.storage[area].remove(key);
}

// Subscribe to a single storage key on a specific area. Returns an unsubscribe handle.
export function subscribeStorageKey<T>(
	area: StorageArea,
	key: string,
	handler: (newValue: T | undefined, oldValue: T | undefined) => void
): () => void {
	const listener = (
		changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
		changedArea: string
	): void => {
		if (changedArea !== area) return;
		const change = changes[key];
		if (!change) return;
		handler(change.newValue as T | undefined, change.oldValue as T | undefined);
	};
	browser.storage.onChanged.addListener(listener);
	return () => browser.storage.onChanged.removeListener(listener);
}
