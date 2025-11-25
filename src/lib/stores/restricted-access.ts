import { writable } from 'svelte/store';
import { logger } from '../utils/logger';

const ACCESS_STATE_KEY = '_session_cache';

interface AccessState {
	isRestricted: boolean;
	timestamp: number | null;
	isLoading: boolean;
}

const initialState: AccessState = {
	isRestricted: false,
	timestamp: null,
	isLoading: true
};

export const restrictedAccessStore = writable<AccessState>(initialState);

// Convert storage format to store state
function parseAccessState(stored: { _v: number; _t: number } | undefined): AccessState {
	return stored?._v === 1
		? { isRestricted: true, timestamp: stored._t, isLoading: false }
		: { isRestricted: false, timestamp: null, isLoading: false };
}

// Load restricted access state from storage
export async function initializeRestrictedAccess(): Promise<void> {
	try {
		const result = await browser.storage.local.get([ACCESS_STATE_KEY]);
		const storedState = result[ACCESS_STATE_KEY] as { _v: number; _t: number } | undefined;
		restrictedAccessStore.set(parseAccessState(storedState));
		if (storedState?._v === 1) {
			logger.info('Access state loaded from storage');
		}
	} catch (error) {
		logger.error('Failed to load access state:', error);
		restrictedAccessStore.set(parseAccessState(undefined));
	}
}

// Listen for storage changes to sync restricted access state
export function setupRestrictedAccessListener(): void {
	browser.storage.local.onChanged.addListener((changes) => {
		if (changes[ACCESS_STATE_KEY]) {
			const newValue = changes[ACCESS_STATE_KEY].newValue as { _v: number; _t: number } | undefined;
			restrictedAccessStore.set(parseAccessState(newValue));
			if (newValue?._v === 1) {
				logger.info('Access state updated from storage change');
			}
		}
	});
}
