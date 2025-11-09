export const SETTINGS_KEYS = {
	HOME_CHECK_ENABLED: 'homeCheckEnabled',
	PROFILE_CHECK_ENABLED: 'profileCheckEnabled',
	FRIENDS_CHECK_ENABLED: 'friendsCheckEnabled',
	GROUPS_CHECK_ENABLED: 'groupsCheckEnabled',
	SEARCH_CHECK_ENABLED: 'searchCheckEnabled',
	REPORT_HELPER_ENABLED: 'reportHelperEnabled',
	DEBUG_MODE_ENABLED: 'debugModeEnabled',
	ADVANCED_VIOLATION_INFO_ENABLED: 'advancedViolationInfoEnabled',
	API_KEY: 'apiKey',
	SETTINGS_EXPANDED: 'settingsExpanded',
	CACHE_DURATION_MINUTES: 'cacheDurationMinutes',
	DEVELOPER_MODE_UNLOCKED: 'developerModeUnlocked',
	THEME: 'theme',
	CHANGELOG_DISMISSED_VERSION: 'changelogDismissedVersion',
	CHANGELOG_SECTION_EXPANDED: 'changelogSectionExpanded',
	ADVANCED_VIOLATION_BANNER_DISMISSED: 'advancedViolationBannerDismissed',
	CUSTOM_APIS: 'customApis',
	LAST_SELECTED_CUSTOM_API_TAB: 'lastSelectedCustomApiTab'
} as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

export type Theme = 'light' | 'dark' | 'auto';

export interface Settings {
	[SETTINGS_KEYS.HOME_CHECK_ENABLED]: boolean;
	[SETTINGS_KEYS.PROFILE_CHECK_ENABLED]: boolean;
	[SETTINGS_KEYS.FRIENDS_CHECK_ENABLED]: boolean;
	[SETTINGS_KEYS.GROUPS_CHECK_ENABLED]: boolean;
	[SETTINGS_KEYS.SEARCH_CHECK_ENABLED]: boolean;
	[SETTINGS_KEYS.REPORT_HELPER_ENABLED]: boolean;
	[SETTINGS_KEYS.DEBUG_MODE_ENABLED]: boolean;
	[SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED]: boolean;
	[SETTINGS_KEYS.API_KEY]: string;
	[SETTINGS_KEYS.SETTINGS_EXPANDED]: boolean;
	[SETTINGS_KEYS.CACHE_DURATION_MINUTES]: number;
	[SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED]: boolean;
	[SETTINGS_KEYS.THEME]: Theme;
	[SETTINGS_KEYS.CHANGELOG_DISMISSED_VERSION]: string;
	[SETTINGS_KEYS.CHANGELOG_SECTION_EXPANDED]: boolean;
	[SETTINGS_KEYS.ADVANCED_VIOLATION_BANNER_DISMISSED]: boolean;
}

export const SETTINGS_DEFAULTS: Settings = {
	[SETTINGS_KEYS.HOME_CHECK_ENABLED]: true,
	[SETTINGS_KEYS.PROFILE_CHECK_ENABLED]: true,
	[SETTINGS_KEYS.FRIENDS_CHECK_ENABLED]: true,
	[SETTINGS_KEYS.GROUPS_CHECK_ENABLED]: true,
	[SETTINGS_KEYS.SEARCH_CHECK_ENABLED]: true,
	[SETTINGS_KEYS.REPORT_HELPER_ENABLED]: true,
	[SETTINGS_KEYS.DEBUG_MODE_ENABLED]: false,
	[SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED]: false,
	[SETTINGS_KEYS.API_KEY]: '',
	[SETTINGS_KEYS.SETTINGS_EXPANDED]: false,
	[SETTINGS_KEYS.CACHE_DURATION_MINUTES]: 5,
	[SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED]: false,
	[SETTINGS_KEYS.THEME]: 'auto',
	[SETTINGS_KEYS.CHANGELOG_DISMISSED_VERSION]: '',
	[SETTINGS_KEYS.CHANGELOG_SECTION_EXPANDED]: false,
	[SETTINGS_KEYS.ADVANCED_VIOLATION_BANNER_DISMISSED]: false
};

interface SettingCategory {
	title: string;
	settings: Array<{
		key: SettingsKey;
		label: string;
		helpText?: string;
		requiresConfirmation?: boolean;
	}>;
}

export const SETTING_CATEGORIES: SettingCategory[] = [
	{
		title: 'Content Display',
		settings: [
			{
				key: SETTINGS_KEYS.THEME,
				label: 'Theme',
				helpText: "Auto follows Roblox's theme setting. Light and Dark override this preference."
			},
			{
				key: SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED,
				label: 'Show Advanced Violation Details',
				helpText: 'Display detailed violation messages and evidence. May contain mature content.',
				requiresConfirmation: true
			}
		]
	},
	{
		title: 'Integrations',
		settings: []
	},
	{
		title: 'Page Settings',
		settings: [
			{
				key: SETTINGS_KEYS.HOME_CHECK_ENABLED,
				label: 'Home Page'
			},
			{
				key: SETTINGS_KEYS.PROFILE_CHECK_ENABLED,
				label: 'Profile Pages'
			},
			{
				key: SETTINGS_KEYS.FRIENDS_CHECK_ENABLED,
				label: 'Friends Pages'
			},
			{
				key: SETTINGS_KEYS.GROUPS_CHECK_ENABLED,
				label: 'Groups Pages'
			},
			{
				key: SETTINGS_KEYS.SEARCH_CHECK_ENABLED,
				label: 'Search Pages'
			},
			{
				key: SETTINGS_KEYS.REPORT_HELPER_ENABLED,
				label: 'Report Helper'
			}
		]
	}
];

// Hidden developer settings category
export const DEVELOPER_SETTING_CATEGORY: SettingCategory = {
	title: 'Developer',
	settings: [
		{
			key: SETTINGS_KEYS.DEBUG_MODE_ENABLED,
			label: 'Enable Debug Logging',
			helpText: 'Show detailed logs in the browser console (F12 -> Console) for troubleshooting.'
		},
		{
			key: SETTINGS_KEYS.CACHE_DURATION_MINUTES,
			label: 'Cache Duration (minutes)',
			helpText:
				'How long to cache user status data (1-10 minutes). Higher values reduce API calls but may show outdated information.'
		}
	]
};
