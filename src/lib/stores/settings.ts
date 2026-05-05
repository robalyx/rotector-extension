import { derived, get, writable } from 'svelte/store';
import {
	AGE_PRESETS,
	type AgePreset,
	type Settings,
	SETTINGS_DEFAULTS,
	SETTINGS_KEYS,
	type SettingsKey
} from '../types/settings';
import { logger } from '../utils/logging/logger';
import {
	getAllStorage,
	getStorage,
	removeStorage,
	setStorage,
	setStorageMulti,
	subscribeStorageKey
} from '../utils/storage';

export const settings = writable<Settings>(SETTINGS_DEFAULTS);

export function getCacheTtlMs(): number {
	return get(settings)[SETTINGS_KEYS.CACHE_DURATION_MINUTES] * 60 * 1000;
}

export async function getStoredApiKey(): Promise<string> {
	const apiKey = await getStorage<string | undefined>('sync', SETTINGS_KEYS.API_KEY, undefined);
	return typeof apiKey === 'string' ? apiKey.trim() : '';
}

// Strips keys not in SETTINGS_KEYS so sync storage doesn't accumulate orphans across versions
export async function initializeSettings(): Promise<void> {
	try {
		const allStored = await getAllStorage('sync');

		const validKeys = new Set<string>(Object.values(SETTINGS_KEYS));
		const obsoleteKeys = Object.keys(allStored).filter((key) => !validKeys.has(key));
		if (obsoleteKeys.length > 0) {
			await removeStorage('sync', obsoleteKeys);
			logger.debug('Removed obsolete settings:', obsoleteKeys);
		}

		const definedSettings = Object.fromEntries(
			Object.entries(allStored).filter(([k, v]) => v !== undefined && validKeys.has(k))
		);
		settings.set({ ...SETTINGS_DEFAULTS, ...definedSettings });
	} catch (error) {
		logger.error('Failed to load settings:', error);
		settings.set(SETTINGS_DEFAULTS);
	}
}

export async function updateSetting<K extends SettingsKey>(
	key: K,
	value: Settings[K]
): Promise<void> {
	await setStorage('sync', key, value);

	settings.update((current) => ({
		...current,
		[key]: value
	}));
}

// Sync from other extension contexts (popup writes vs. content reads).
const validKeysForSync = new Set<string>(Object.values(SETTINGS_KEYS));
for (const key of validKeysForSync) {
	subscribeStorageKey<unknown>('sync', key, (newValue) => {
		if (newValue === undefined) return;
		settings.update((current) => ({
			...current,
			[key]: newValue
		}));
	});
}

export async function removeSetting(key: SettingsKey): Promise<void> {
	await removeStorage('sync', key);
	settings.update((current) => {
		const updated = { ...current };
		delete (updated as Record<string, unknown>)[key];
		return updated;
	});
}

const MINOR_PRESET_SETTINGS = {
	[SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED]: false,
	[SETTINGS_KEYS.CIPHER_DECODING_ENABLED]: false,
	[SETTINGS_KEYS.BLUR_DISPLAY_NAMES]: true,
	[SETTINGS_KEYS.BLUR_USERNAMES]: true,
	[SETTINGS_KEYS.BLUR_DESCRIPTIONS]: true,
	[SETTINGS_KEYS.BLUR_AVATARS]: true
} as const;

const ADULT_PRESET_SETTINGS = {
	[SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED]: true,
	[SETTINGS_KEYS.CIPHER_DECODING_ENABLED]: true,
	[SETTINGS_KEYS.BLUR_DISPLAY_NAMES]: false,
	[SETTINGS_KEYS.BLUR_USERNAMES]: false,
	[SETTINGS_KEYS.BLUR_DESCRIPTIONS]: false,
	[SETTINGS_KEYS.BLUR_AVATARS]: false
} as const;

function detectAgePreset(currentSettings: Settings): AgePreset {
	const presets = [
		[AGE_PRESETS.MINOR, MINOR_PRESET_SETTINGS],
		[AGE_PRESETS.ADULT, ADULT_PRESET_SETTINGS]
	] as const;
	for (const [name, preset] of presets) {
		if (Object.entries(preset).every(([k, v]) => currentSettings[k as keyof Settings] === v)) {
			return name;
		}
	}
	return AGE_PRESETS.CUSTOM;
}

export const currentPreset = derived(settings, ($settings) => detectAgePreset($settings));

// Writes the preset's settings atomically
export async function applyAgePreset(
	preset: typeof AGE_PRESETS.MINOR | typeof AGE_PRESETS.ADULT
): Promise<void> {
	const presetSettings: Partial<Settings> =
		preset === AGE_PRESETS.MINOR ? MINOR_PRESET_SETTINGS : ADULT_PRESET_SETTINGS;

	await setStorageMulti('sync', presetSettings);

	settings.update((current) => ({
		...current,
		...presetSettings
	}));

	logger.userAction('age_preset_applied', { preset });
}
