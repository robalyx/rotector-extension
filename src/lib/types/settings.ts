export const SETTINGS_KEYS = {
  HOME_CHECK_ENABLED: 'homeCheckEnabled',
  HOME_TOOLTIPS_ENABLED: 'homeTooltipsEnabled',
  PROFILE_CHECK_ENABLED: 'profileCheckEnabled',
  PROFILE_TOOLTIPS_ENABLED: 'profileTooltipsEnabled',
  FRIENDS_CHECK_ENABLED: 'friendsCheckEnabled',
  FRIENDS_TOOLTIPS_ENABLED: 'friendsTooltipsEnabled',
  GROUPS_CHECK_ENABLED: 'groupsCheckEnabled',
  GROUPS_TOOLTIPS_ENABLED: 'groupsTooltipsEnabled',
  REPORT_HELPER_ENABLED: 'reportHelperEnabled',
  DEBUG_MODE_ENABLED: 'debugModeEnabled',
  ADVANCED_VIOLATION_INFO_ENABLED: 'advancedViolationInfoEnabled',
  API_KEY: 'apiKey',
  SETTINGS_EXPANDED: 'settingsExpanded',
  CACHE_DURATION_MINUTES: 'cacheDurationMinutes',
  DEVELOPER_MODE_UNLOCKED: 'developerModeUnlocked',
  API_BASE_URL: 'apiBaseUrl',
  THEME: 'theme',
  CHANGELOG_DISMISSED_VERSION: 'changelogDismissedVersion',
  CHANGELOG_SECTION_EXPANDED: 'changelogSectionExpanded',
  CHANGELOG_TECHNICAL_MODE: 'changelogTechnicalMode'
} as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

export type Theme = 'light' | 'dark' | 'auto';

export interface Settings {
  [SETTINGS_KEYS.HOME_CHECK_ENABLED]: boolean;
  [SETTINGS_KEYS.HOME_TOOLTIPS_ENABLED]: boolean;
  [SETTINGS_KEYS.PROFILE_CHECK_ENABLED]: boolean;
  [SETTINGS_KEYS.PROFILE_TOOLTIPS_ENABLED]: boolean;
  [SETTINGS_KEYS.FRIENDS_CHECK_ENABLED]: boolean;
  [SETTINGS_KEYS.FRIENDS_TOOLTIPS_ENABLED]: boolean;
  [SETTINGS_KEYS.GROUPS_CHECK_ENABLED]: boolean;
  [SETTINGS_KEYS.GROUPS_TOOLTIPS_ENABLED]: boolean;
  [SETTINGS_KEYS.REPORT_HELPER_ENABLED]: boolean;
  [SETTINGS_KEYS.DEBUG_MODE_ENABLED]: boolean;
  [SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED]: boolean;
  [SETTINGS_KEYS.API_KEY]: string;
  [SETTINGS_KEYS.SETTINGS_EXPANDED]: boolean;
  [SETTINGS_KEYS.CACHE_DURATION_MINUTES]: number;
  [SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED]: boolean;
  [SETTINGS_KEYS.API_BASE_URL]: string;
  [SETTINGS_KEYS.THEME]: Theme;
  [SETTINGS_KEYS.CHANGELOG_DISMISSED_VERSION]: string;
  [SETTINGS_KEYS.CHANGELOG_SECTION_EXPANDED]: boolean;
  [SETTINGS_KEYS.CHANGELOG_TECHNICAL_MODE]: boolean;
}

export const SETTINGS_DEFAULTS: Settings = {
  [SETTINGS_KEYS.HOME_CHECK_ENABLED]: true,
  [SETTINGS_KEYS.HOME_TOOLTIPS_ENABLED]: true,
  [SETTINGS_KEYS.PROFILE_CHECK_ENABLED]: true,
  [SETTINGS_KEYS.PROFILE_TOOLTIPS_ENABLED]: true,
  [SETTINGS_KEYS.FRIENDS_CHECK_ENABLED]: true,
  [SETTINGS_KEYS.FRIENDS_TOOLTIPS_ENABLED]: true,
  [SETTINGS_KEYS.GROUPS_CHECK_ENABLED]: true,
  [SETTINGS_KEYS.GROUPS_TOOLTIPS_ENABLED]: true,
  [SETTINGS_KEYS.REPORT_HELPER_ENABLED]: true,
  [SETTINGS_KEYS.DEBUG_MODE_ENABLED]: false,
  [SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED]: false,
  [SETTINGS_KEYS.API_KEY]: '',
  [SETTINGS_KEYS.SETTINGS_EXPANDED]: false,
  [SETTINGS_KEYS.CACHE_DURATION_MINUTES]: 5,
  [SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED]: false,
  [SETTINGS_KEYS.API_BASE_URL]: 'https://roscoe.robalyx.com',
  [SETTINGS_KEYS.THEME]: 'auto',
  [SETTINGS_KEYS.CHANGELOG_DISMISSED_VERSION]: '',
  [SETTINGS_KEYS.CHANGELOG_SECTION_EXPANDED]: false,
  [SETTINGS_KEYS.CHANGELOG_TECHNICAL_MODE]: false
};

interface SettingCategory {
  title: string;
  settings: {
    key: SettingsKey;
    label: string;
    helpText?: string;
    requiresConfirmation?: boolean;
  }[];
}

export const SETTING_CATEGORIES: SettingCategory[] = [
  {
    title: 'Content Display',
    settings: [
      {
        key: SETTINGS_KEYS.THEME,
        label: 'Theme',
        helpText: 'Auto follows Roblox\'s theme setting. Light and Dark override this preference.'
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
    title: 'Home Page',
    settings: [
      {
        key: SETTINGS_KEYS.HOME_CHECK_ENABLED,
        label: 'Enable checks on home page'
      },
      {
        key: SETTINGS_KEYS.HOME_TOOLTIPS_ENABLED,
        label: 'Show tooltips on home page'
      }
    ]
  },
  {
    title: 'Profile Page',
    settings: [
      {
        key: SETTINGS_KEYS.PROFILE_CHECK_ENABLED,
        label: 'Enable checks on profiles'
      },
      {
        key: SETTINGS_KEYS.PROFILE_TOOLTIPS_ENABLED,
        label: 'Show tooltips on profiles'
      }
    ]
  },
  {
    title: 'Friends Pages',
    settings: [
      {
        key: SETTINGS_KEYS.FRIENDS_CHECK_ENABLED,
        label: 'Enable checks on lists'
      },
      {
        key: SETTINGS_KEYS.FRIENDS_TOOLTIPS_ENABLED,
        label: 'Show tooltips on lists'
      }
    ]
  },
  {
    title: 'Groups Page',
    settings: [
      {
        key: SETTINGS_KEYS.GROUPS_CHECK_ENABLED,
        label: 'Enable checks on group members'
      },
      {
        key: SETTINGS_KEYS.GROUPS_TOOLTIPS_ENABLED,
        label: 'Show tooltips on group members'
      }
    ]
  },
  {
    title: 'Report Page',
    settings: [
      {
        key: SETTINGS_KEYS.REPORT_HELPER_ENABLED,
        label: 'Show report helper card'
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
      helpText: 'How long to cache user status data (1-10 minutes). Higher values reduce API calls but may show outdated information.'
    },
    {
      key: SETTINGS_KEYS.API_BASE_URL,
      label: 'API Base URL',
      helpText: 'Base URL for Rotector API endpoints. Default: https://roscoe.robalyx.com'
    }
  ]
}; 