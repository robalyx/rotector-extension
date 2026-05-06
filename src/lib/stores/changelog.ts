import { derived, get } from 'svelte/store';
import { settings, updateSetting } from './settings';
import { SETTINGS_KEYS } from '../types/settings';
import type { Changelog } from '../types/changelog';
import { CHANGELOGS } from '../data/changelog-entries';
import { compareVersions } from '../utils/version';

export const changelogSectionExpanded = derived(
	settings,
	($settings) => $settings[SETTINGS_KEYS.CHANGELOG_SECTION_EXPANDED]
);

export const unreadChangelogs = derived(settings, ($settings) => {
	const lastSeen = $settings[SETTINGS_KEYS.CHANGELOG_LAST_SEEN_VERSION] || '0.0.0';
	return CHANGELOGS.filter((cl) => compareVersions(cl.version, lastSeen) > 0);
});

export const shouldShowChangelogModal = derived(
	[settings, unreadChangelogs],
	([$settings, $unread]) => {
		if (!$settings[SETTINGS_KEYS.ONBOARDING_COMPLETED]) return false;
		if ($settings[SETTINGS_KEYS.CHANGELOG_MODAL_DISABLED]) return false;
		return $unread.length > 0;
	}
);

export async function toggleChangelogSection(): Promise<void> {
	const currentSettings = get(settings);
	const currentExpanded = currentSettings[SETTINGS_KEYS.CHANGELOG_SECTION_EXPANDED];
	await updateSetting(SETTINGS_KEYS.CHANGELOG_SECTION_EXPANDED, !currentExpanded);
}

export async function markChangelogsSeen(): Promise<void> {
	const latest = getLatestChangelog();
	if (latest) {
		await updateSetting(SETTINGS_KEYS.CHANGELOG_LAST_SEEN_VERSION, latest.version);
	}
}

export async function disableChangelogModal(): Promise<void> {
	await updateSetting(SETTINGS_KEYS.CHANGELOG_MODAL_DISABLED, true);
}

export async function enableChangelogModal(): Promise<void> {
	await updateSetting(SETTINGS_KEYS.CHANGELOG_MODAL_DISABLED, false);
}

export const getLatestChangelog = (): Changelog | null => CHANGELOGS[0] ?? null;
