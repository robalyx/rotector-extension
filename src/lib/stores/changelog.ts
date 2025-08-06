import {derived, get, writable} from 'svelte/store';
import {settings, updateSetting} from './settings.js';
import {SETTINGS_KEYS} from '../types/settings.js';
import {type Changelog, CHANGELOGS, getLatestChangelog} from '../types/changelog.js';

// Store for all changelogs
export const changelogs = writable<Changelog[]>(CHANGELOGS);

// Store for the latest changelog
export const latestChangelog = derived(changelogs, () => {
    return getLatestChangelog();
});

// Store for whether the changelog banner should be visible
export const shouldShowChangelogBanner = derived(
    [latestChangelog, settings],
    ([$latestChangelog, $settings]) => {
        if (!$latestChangelog) return false;

        // Show banner if latest changelog version hasn't been dismissed
        return $settings[SETTINGS_KEYS.CHANGELOG_DISMISSED_VERSION] !== $latestChangelog.version;
    }
);

// Store for whether the changelog section is expanded
export const changelogSectionExpanded = derived(
    settings,
    ($settings) => $settings[SETTINGS_KEYS.CHANGELOG_SECTION_EXPANDED]
);

// Store for whether technical mode is enabled
export const changelogTechnicalMode = derived(
    settings,
    ($settings) => $settings[SETTINGS_KEYS.CHANGELOG_TECHNICAL_MODE]
);

// Dismiss the changelog banner for the current latest version
export async function dismissChangelogBanner(): Promise<void> {
    const latest = getLatestChangelog();
    if (latest) {
        await updateSetting(SETTINGS_KEYS.CHANGELOG_DISMISSED_VERSION, latest.version);
    }
}

// Toggle the changelog section expanded state
export async function toggleChangelogSection(): Promise<void> {
    const currentSettings = get(settings);
    const currentExpanded = currentSettings[SETTINGS_KEYS.CHANGELOG_SECTION_EXPANDED];
    await updateSetting(SETTINGS_KEYS.CHANGELOG_SECTION_EXPANDED, !currentExpanded);
}

// Toggle the changelog technical mode
export async function toggleChangelogTechnicalMode(): Promise<void> {
    const currentSettings = get(settings);
    const currentTechnicalMode = currentSettings[SETTINGS_KEYS.CHANGELOG_TECHNICAL_MODE];
    await updateSetting(SETTINGS_KEYS.CHANGELOG_TECHNICAL_MODE, !currentTechnicalMode);
}

