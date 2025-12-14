import { derived, get, writable } from 'svelte/store';
import { settings, updateSetting } from './settings.js';
import { SETTINGS_KEYS } from '../types/settings.js';
import { getLatestChangelog } from './changelog.js';

// Temporary override to force onboarding display
const forceShowOnboarding = writable(false);

// Session-level dismiss flag
const sessionDismissed = writable(false);

// Store for whether onboarding should be shown
export const shouldShowOnboarding = derived(
	[settings, forceShowOnboarding, sessionDismissed],
	([$settings, $forceShow, $dismissed]) => {
		if ($dismissed) return false;
		if ($forceShow) return true;
		return !$settings[SETTINGS_KEYS.ONBOARDING_COMPLETED];
	}
);

// Dismiss onboarding which will show again on next page load
export function dismissOnboarding(): void {
	sessionDismissed.set(true);
	forceShowOnboarding.set(false);
}

// Mark onboarding as completed and persist to storage
export async function completeOnboarding(): Promise<void> {
	await updateSetting(SETTINGS_KEYS.ONBOARDING_COMPLETED, true);
	const latest = getLatestChangelog();
	if (latest) {
		await updateSetting(SETTINGS_KEYS.CHANGELOG_LAST_SEEN_VERSION, latest.version);
	}
	forceShowOnboarding.set(false);
}

// Trigger onboarding replay
export function triggerOnboardingReplay(): void {
	sessionDismissed.set(false);
	forceShowOnboarding.set(true);
}

// Check if this is a replay
export function isOnboardingReplay(): boolean {
	const currentSettings = get(settings);
	return currentSettings[SETTINGS_KEYS.ONBOARDING_COMPLETED];
}
