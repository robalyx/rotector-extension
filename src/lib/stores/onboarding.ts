import { derived, get, writable } from 'svelte/store';
import { settings, updateSetting } from './settings';
import { SETTINGS_KEYS } from '../types/settings';
import { REQUIRED_LEGAL_VERSION } from '../types/constants';
import { getLatestChangelog } from './changelog';

const forceShowOnboarding = writable(false);
const sessionDismissed = writable(false);

export const shouldShowOnboarding = derived(
	[settings, forceShowOnboarding, sessionDismissed],
	([$settings, $forceShow, $dismissed]) => {
		if ($dismissed) return false;
		if ($forceShow) return true;
		return !$settings[SETTINGS_KEYS.ONBOARDING_COMPLETED];
	}
);

export function dismissOnboarding(): void {
	sessionDismissed.set(true);
	forceShowOnboarding.set(false);
}

// Marks onboarding done, accepts the current legal version, and stamps the latest changelog as seen
export async function completeOnboarding(): Promise<void> {
	await updateSetting(SETTINGS_KEYS.ONBOARDING_COMPLETED, true);
	await updateSetting(SETTINGS_KEYS.LEGAL_ACCEPTED_VERSION, REQUIRED_LEGAL_VERSION);
	await updateSetting(SETTINGS_KEYS.LEGAL_DECLINED, false);
	const latest = getLatestChangelog();
	if (latest) {
		await updateSetting(SETTINGS_KEYS.CHANGELOG_LAST_SEEN_VERSION, latest.version);
	}
	forceShowOnboarding.set(false);
}

export function triggerOnboardingReplay(): void {
	sessionDismissed.set(false);
	forceShowOnboarding.set(true);
}

// True when onboarding was previously completed, so the flow is being replayed rather than first-run
export function isOnboardingReplay(): boolean {
	const currentSettings = get(settings);
	return currentSettings[SETTINGS_KEYS.ONBOARDING_COMPLETED];
}
