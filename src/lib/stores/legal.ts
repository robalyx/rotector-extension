import { derived, writable } from 'svelte/store';
import { settings, updateSetting } from './settings.js';
import { SETTINGS_KEYS } from '../types/settings.js';
import { REQUIRED_LEGAL_VERSION } from '../types/constants.js';
import { compareVersions } from '../utils/version.js';

const forceShowLegalModal = writable(false);

export const legalNeedsAcceptance = derived(
	settings,
	($settings) =>
		compareVersions(REQUIRED_LEGAL_VERSION, $settings[SETTINGS_KEYS.LEGAL_ACCEPTED_VERSION]) > 0
);

export const shouldShowLegalModal = derived(
	[legalNeedsAcceptance, settings, forceShowLegalModal],
	([$needs, $settings, $force]) => {
		if ($force) return $needs;
		if (!$settings[SETTINGS_KEYS.ONBOARDING_COMPLETED]) return false;
		if ($settings[SETTINGS_KEYS.LEGAL_DECLINED]) return false;
		return $needs;
	}
);

export const extensionFeaturesEnabled = derived(
	[legalNeedsAcceptance, settings],
	([$needs, $settings]) => $settings[SETTINGS_KEYS.ONBOARDING_COMPLETED] && !$needs
);

export async function acceptLegal(): Promise<void> {
	await updateSetting(SETTINGS_KEYS.LEGAL_ACCEPTED_VERSION, REQUIRED_LEGAL_VERSION);
	await updateSetting(SETTINGS_KEYS.LEGAL_DECLINED, false);
	forceShowLegalModal.set(false);
}

export async function declineLegal(): Promise<void> {
	await updateSetting(SETTINGS_KEYS.LEGAL_DECLINED, true);
	forceShowLegalModal.set(false);
}

export async function triggerLegalReview(): Promise<void> {
	await updateSetting(SETTINGS_KEYS.LEGAL_DECLINED, false);
	forceShowLegalModal.set(true);
}
