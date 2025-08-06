import {writable} from 'svelte/store';
import {browser} from 'wxt/browser';
import type {Settings, SettingsKey} from '../types/settings.js';
import {SETTINGS_DEFAULTS} from '../types/settings.js';

export const settings = writable<Settings>(SETTINGS_DEFAULTS);

// Initialize settings from storage
export async function initializeSettings(): Promise<void> {
    try {
        const storedSettings = await browser.storage.sync.get(SETTINGS_DEFAULTS);
        settings.set(storedSettings as Settings);
    } catch (error) {
        console.error('Failed to load settings:', error);
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
        await browser.storage.sync.set({[key]: value});

        // Update store
        settings.update(current => ({
            ...current,
            [key]: value
        }));
    } catch (error) {
        console.error(`Failed to update setting ${key}:`, error);
        throw error;
    }
}

// Listen for storage changes from other contexts
browser.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        settings.update(current => {
            const updated = {...current};
            for (const [key, change] of Object.entries(changes)) {
                if (key in SETTINGS_DEFAULTS) {
                    (updated as Record<string, unknown>)[key] = change.newValue;
                }
            }
            return updated;
        });
    }
}); 