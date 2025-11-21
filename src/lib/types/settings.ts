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
	LANGUAGE_OVERRIDE: 'languageOverride',
	CHANGELOG_DISMISSED_VERSION: 'changelogDismissedVersion',
	CHANGELOG_SECTION_EXPANDED: 'changelogSectionExpanded',
	ADVANCED_VIOLATION_BANNER_DISMISSED: 'advancedViolationBannerDismissed',
	CUSTOM_APIS: 'customApis',
	LAST_SELECTED_CUSTOM_API_TAB: 'lastSelectedCustomApiTab',
	TRANSLATE_VIOLATIONS_ENABLED: 'translateViolationsEnabled'
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
	[SETTINGS_KEYS.LANGUAGE_OVERRIDE]: string;
	[SETTINGS_KEYS.CHANGELOG_DISMISSED_VERSION]: string;
	[SETTINGS_KEYS.CHANGELOG_SECTION_EXPANDED]: boolean;
	[SETTINGS_KEYS.ADVANCED_VIOLATION_BANNER_DISMISSED]: boolean;
	[SETTINGS_KEYS.CUSTOM_APIS]?: string;
	[SETTINGS_KEYS.LAST_SELECTED_CUSTOM_API_TAB]?: string;
	[SETTINGS_KEYS.TRANSLATE_VIOLATIONS_ENABLED]: boolean;
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
	[SETTINGS_KEYS.LANGUAGE_OVERRIDE]: 'auto',
	[SETTINGS_KEYS.CHANGELOG_DISMISSED_VERSION]: '',
	[SETTINGS_KEYS.CHANGELOG_SECTION_EXPANDED]: false,
	[SETTINGS_KEYS.ADVANCED_VIOLATION_BANNER_DISMISSED]: false,
	[SETTINGS_KEYS.TRANSLATE_VIOLATIONS_ENABLED]: false
};

interface SettingCategory {
	titleKey: string;
	settings: Array<{
		key: SettingsKey;
		labelKey: string;
		helpTextKey?: string;
		requiresConfirmation?: boolean;
	}>;
}

export const SETTING_CATEGORIES: SettingCategory[] = [
	{
		titleKey: 'settings_category_content_display',
		settings: [
			{
				key: SETTINGS_KEYS.THEME,
				labelKey: 'settings_label_theme',
				helpTextKey: 'settings_help_theme'
			},
			{
				key: SETTINGS_KEYS.LANGUAGE_OVERRIDE,
				labelKey: 'settings_label_language',
				helpTextKey: 'settings_help_language'
			},
			{
				key: SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED,
				labelKey: 'settings_label_advanced_violations',
				helpTextKey: 'settings_help_advanced_violations',
				requiresConfirmation: true
			},
			{
				key: SETTINGS_KEYS.TRANSLATE_VIOLATIONS_ENABLED,
				labelKey: 'settings_label_translate_violations',
				helpTextKey: 'settings_help_translate_violations'
			}
		]
	},
	{
		titleKey: 'settings_category_integrations',
		settings: []
	},
	{
		titleKey: 'settings_category_page_settings',
		settings: [
			{
				key: SETTINGS_KEYS.HOME_CHECK_ENABLED,
				labelKey: 'settings_label_home_page'
			},
			{
				key: SETTINGS_KEYS.PROFILE_CHECK_ENABLED,
				labelKey: 'settings_label_profile_pages'
			},
			{
				key: SETTINGS_KEYS.FRIENDS_CHECK_ENABLED,
				labelKey: 'settings_label_friends_pages'
			},
			{
				key: SETTINGS_KEYS.GROUPS_CHECK_ENABLED,
				labelKey: 'settings_label_groups_pages'
			},
			{
				key: SETTINGS_KEYS.SEARCH_CHECK_ENABLED,
				labelKey: 'settings_label_search_pages'
			},
			{
				key: SETTINGS_KEYS.REPORT_HELPER_ENABLED,
				labelKey: 'settings_label_report_helper'
			}
		]
	}
];

// Hidden developer settings category
export const DEVELOPER_SETTING_CATEGORY: SettingCategory = {
	titleKey: 'settings_category_developer',
	settings: [
		{
			key: SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED,
			labelKey: 'settings_label_developer_mode',
			helpTextKey: 'settings_help_developer_mode'
		},
		{
			key: SETTINGS_KEYS.DEBUG_MODE_ENABLED,
			labelKey: 'settings_label_debug_logging',
			helpTextKey: 'settings_help_debug_logging'
		},
		{
			key: SETTINGS_KEYS.CACHE_DURATION_MINUTES,
			labelKey: 'settings_label_cache_duration',
			helpTextKey: 'settings_help_cache_duration'
		}
	]
};
