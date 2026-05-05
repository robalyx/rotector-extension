import { derived, writable } from 'svelte/store';
import { settings, updateSetting } from './settings';
import { SETTINGS_KEYS } from '../types/settings';
import { logger } from '../utils/logging/logger';
import {
	readSessionRestricted,
	type SessionRestrictedState,
	subscribeSessionRestricted
} from './session-state';

interface AccessState extends SessionRestrictedState {
	isLoading: boolean;
}

const initialState: AccessState = {
	isRestricted: false,
	timestamp: null,
	isLoading: true
};

export const restrictedAccessStore = writable<AccessState>(initialState);

export async function initializeRestrictedAccess(): Promise<void> {
	try {
		const state = await readSessionRestricted();
		restrictedAccessStore.set({ ...state, isLoading: false });
		if (state.isRestricted) {
			logger.info('Access state loaded from storage');
		}
	} catch (error) {
		logger.error('Failed to load access state:', error);
		restrictedAccessStore.set({ ...initialState, isLoading: false });
	}
}

export function setupRestrictedAccessListener(): void {
	subscribeSessionRestricted((state) => {
		restrictedAccessStore.set({ ...state, isLoading: false });
		if (state.isRestricted) {
			logger.info('Access state updated from storage change');
		}
	});
}

// Gate for the restriction notice modal, re-fires on new incidents (different _t)
export const shouldShowRestrictionNotice = derived(
	[restrictedAccessStore, settings],
	([$r, $s]) =>
		$r.isRestricted &&
		!$r.isLoading &&
		$r.timestamp !== null &&
		$r.timestamp > $s[SETTINGS_KEYS.RESTRICTION_NOTICE_SEEN_TIMESTAMP] &&
		$s[SETTINGS_KEYS.ONBOARDING_COMPLETED]
);

// Persist the restriction incident timestamp the user has acknowledged
export async function markRestrictionNoticeSeen(timestamp: number): Promise<void> {
	await updateSetting(SETTINGS_KEYS.RESTRICTION_NOTICE_SEEN_TIMESTAMP, timestamp);
}
