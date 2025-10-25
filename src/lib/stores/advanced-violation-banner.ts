import { derived } from 'svelte/store';
import { settings, updateSetting } from './settings.js';
import { SETTINGS_KEYS } from '../types/settings.js';
import { logger } from '../utils/logger.js';

let previousAdvancedViolationEnabled: boolean | null = null;

// Store for whether the advanced violation banner should be visible
export const shouldShowAdvancedViolationBanner = derived(settings, ($settings) => {
	const currentAdvancedViolationEnabled = $settings[SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED];

	// Initialize previous state on first run
	previousAdvancedViolationEnabled ??= currentAdvancedViolationEnabled;

	// If the setting was turned off , reset the banner dismissal
	if (previousAdvancedViolationEnabled && !currentAdvancedViolationEnabled) {
		updateSetting(SETTINGS_KEYS.ADVANCED_VIOLATION_BANNER_DISMISSED, false).catch((error) => {
			logger.error('Failed to reset banner dismissal:', error);
		});
	}

	// Update the previous state for next comparison
	previousAdvancedViolationEnabled = currentAdvancedViolationEnabled;

	// Show banner if advanced violation details is disabled and banner hasn't been dismissed
	return (
		!$settings[SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED] &&
		!$settings[SETTINGS_KEYS.ADVANCED_VIOLATION_BANNER_DISMISSED]
	);
});

// Dismiss the advanced violation banner permanently
export async function dismissAdvancedViolationBanner(): Promise<void> {
	await updateSetting(SETTINGS_KEYS.ADVANCED_VIOLATION_BANNER_DISMISSED, true);
}
