import { derived, writable } from 'svelte/store';
import {
	AGE_PRESETS,
	type AgePreset,
	type Settings,
	SETTINGS_DEFAULTS,
	SETTINGS_KEYS,
	type SettingsKey
} from '../types/settings.js';
import { logger } from '../utils/logger.js';

export const settings = writable<Settings>(SETTINGS_DEFAULTS);

// Initialize settings from storage
export async function initializeSettings(): Promise<void> {
	try {
		const storedSettings = await browser.storage.sync.get(SETTINGS_DEFAULTS);
		settings.set(storedSettings as Settings);
	} catch (error) {
		logger.error('Failed to load settings:', error);
		settings.set(SETTINGS_DEFAULTS);
	}
}

// Update a specific setting
export async function updateSetting<K extends SettingsKey>(
	key: K,
	value: Settings[K]
): Promise<void> {
	try {
		// Update storage
		await browser.storage.sync.set({ [key]: value });

		// Update store
		settings.update((current) => ({
			...current,
			[key]: value
		}));
	} catch (error) {
		logger.error(`Failed to update setting ${key}:`, error);
		throw error;
	}
}

// Listen for storage changes from other contexts
browser.storage.onChanged.addListener((changes, namespace) => {
	if (namespace === 'sync') {
		settings.update((current) => {
			const updated = { ...current };
			for (const [key, change] of Object.entries(changes)) {
				if (key in SETTINGS_DEFAULTS && change.newValue !== undefined) {
					(updated as Record<string, unknown>)[key] = change.newValue;
				}
			}
			return updated;
		});
	}
});

// Preset definitions
const MINOR_PRESET_SETTINGS = {
	[SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED]: false,
	[SETTINGS_KEYS.EXPERIMENTAL_BLUR_ENABLED]: true,
	[SETTINGS_KEYS.BLUR_DISPLAY_NAMES]: true,
	[SETTINGS_KEYS.BLUR_USERNAMES]: true,
	[SETTINGS_KEYS.BLUR_DESCRIPTIONS]: true,
	[SETTINGS_KEYS.BLUR_AVATARS]: true
} as const;

const ADULT_PRESET_SETTINGS = {
	[SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED]: true,
	[SETTINGS_KEYS.EXPERIMENTAL_BLUR_ENABLED]: false,
	[SETTINGS_KEYS.BLUR_DISPLAY_NAMES]: false,
	[SETTINGS_KEYS.BLUR_USERNAMES]: false,
	[SETTINGS_KEYS.BLUR_DESCRIPTIONS]: false,
	[SETTINGS_KEYS.BLUR_AVATARS]: false
} as const;

// Detect which preset matches current settings
function detectAgePreset(currentSettings: Settings): AgePreset {
	const matchesMinor = Object.entries(MINOR_PRESET_SETTINGS).every(
		([key, value]) => currentSettings[key as keyof Settings] === value
	);
	if (matchesMinor) return AGE_PRESETS.MINOR;

	const matchesAdult = Object.entries(ADULT_PRESET_SETTINGS).every(
		([key, value]) => currentSettings[key as keyof Settings] === value
	);
	if (matchesAdult) return AGE_PRESETS.ADULT;

	return AGE_PRESETS.CUSTOM;
}

// Derived store that auto-detects current preset based on settings
export const currentPreset = derived(settings, ($settings) => detectAgePreset($settings));

// Apply a preset's settings
export async function applyAgePreset(
	preset: typeof AGE_PRESETS.MINOR | typeof AGE_PRESETS.ADULT
): Promise<void> {
	const presetSettings: Partial<Settings> = {
		...(preset === AGE_PRESETS.MINOR ? MINOR_PRESET_SETTINGS : ADULT_PRESET_SETTINGS),
		[SETTINGS_KEYS.AGE_PRESET]: preset
	};

	try {
		// Update all preset settings in storage
		await browser.storage.sync.set(presetSettings);

		// Update store
		settings.update((current) => ({
			...current,
			...presetSettings
		}));

		logger.userAction('age_preset_applied', { preset });
	} catch (error) {
		logger.error('Failed to apply age preset:', error);
		throw error;
	}
}
