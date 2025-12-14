import { derived, get, writable } from 'svelte/store';
import { settings, updateSetting } from './settings.js';
import { SETTINGS_KEYS } from '../types/settings.js';
import { type Changelog, CHANGELOGS } from '../types/changelog.js';

// Compare semantic versions
function compareVersions(a: string, b: string): number {
	const pa = a.split('.').map(Number);
	const pb = b.split('.').map(Number);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const na = pa[i] ?? 0;
		const nb = pb[i] ?? 0;
		if (na !== nb) return na - nb;
	}
	return 0;
}

// Store for all changelogs
export const changelogs = writable<Changelog[]>(CHANGELOGS);

// Store for the latest changelog
const latestChangelog = derived(changelogs, ($changelogs) => $changelogs?.[0] ?? null);

// Store for whether the changelog section is expanded
export const changelogSectionExpanded = derived(
	settings,
	($settings) => $settings[SETTINGS_KEYS.CHANGELOG_SECTION_EXPANDED]
);

// Get all unread changelogs where versions newer than last seen
export const unreadChangelogs = derived(settings, ($settings) => {
	const lastSeen = $settings[SETTINGS_KEYS.CHANGELOG_LAST_SEEN_VERSION];
	if (!lastSeen) return [];
	return CHANGELOGS.filter((cl) => compareVersions(cl.version, lastSeen) > 0);
});

// Store for whether the changelog modal should be visible
export const shouldShowChangelogModal = derived(
	[settings, unreadChangelogs],
	([$settings, $unread]) => {
		if (!$settings[SETTINGS_KEYS.ONBOARDING_COMPLETED]) return false;
		if ($settings[SETTINGS_KEYS.CHANGELOG_MODAL_DISABLED]) return false;
		return $unread.length > 0;
	}
);

// Toggle the changelog section expanded state
export async function toggleChangelogSection(): Promise<void> {
	const currentSettings = get(settings);
	const currentExpanded = currentSettings[SETTINGS_KEYS.CHANGELOG_SECTION_EXPANDED];
	await updateSetting(SETTINGS_KEYS.CHANGELOG_SECTION_EXPANDED, !currentExpanded);
}

// Mark changelogs as seen
export async function markChangelogsSeen(): Promise<void> {
	const latest = get(latestChangelog);
	if (latest) {
		await updateSetting(SETTINGS_KEYS.CHANGELOG_LAST_SEEN_VERSION, latest.version);
	}
}

// Disable changelog modal permanently
export async function disableChangelogModal(): Promise<void> {
	await updateSetting(SETTINGS_KEYS.CHANGELOG_MODAL_DISABLED, true);
}

// Re-enable changelog modal
export async function enableChangelogModal(): Promise<void> {
	await updateSetting(SETTINGS_KEYS.CHANGELOG_MODAL_DISABLED, false);
}

// Get latest changelog
export function getLatestChangelog(): Changelog | null {
	return CHANGELOGS[0] ?? null;
}
