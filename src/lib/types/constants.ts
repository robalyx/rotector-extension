export const STATUS = {
	FLAGS: {
		SAFE: 0,
		PENDING: 1,
		UNSAFE: 2,
		QUEUED: 3,
		PROVISIONAL: 4,
		MIXED: 5,
		PAST_OFFENDER: 6,
		REDACTED: 8
	}
} as const;

export type StatusFlag = (typeof STATUS.FLAGS)[keyof typeof STATUS.FLAGS];

export const ENTITY_TYPES = {
	USER: 'user',
	GROUP: 'group'
} as const;

const API_DOMAIN =
	import.meta.env.USE_DEV_API === 'true' ? 'roscoe-dev.rotector.com' : 'roscoe.rotector.com';

export const API_CONFIG = {
	BASE_URL: `https://${API_DOMAIN}`,
	ENDPOINTS: {
		USER_CHECK: '/v1/lookup/roblox/user',
		GROUP_CHECK: '/v1/lookup/roblox/group',
		QUEUE_USER: '/v1/queue/roblox/user',
		QUEUE_LIMITS: '/v1/queue/limits',
		SUBMIT_VOTE: '/v1/votes/roblox/user',
		GET_VOTES: '/v1/votes/roblox/user',
		GET_STATS: '/v2/stats',
		QUEUE_STATUS: '/v1/queue/roblox/user/status',
		EXPORT_GROUP_TRACKED_USERS: '/v1/export/roblox/group',
		LOOKUP_OUTFITS_BY_NAME: '/v1/lookup/outfits/by-name',
		LOOKUP_OUTFITS_BY_ID: '/v1/lookup/outfits/by-id',
		EXTENSION_MEMBERSHIP_STATUS: '/v1/extension/membership/status',
		EXTENSION_MEMBERSHIP_BADGE: '/v1/extension/membership/badge',
		EXTENSION_MEMBERSHIP_VERIFICATION: '/v1/extension/membership/verification'
	},
	BATCH_SIZE: 100,
	BATCH_DELAY: 250, // ms between batches
	MAX_RETRIES: 3,
	RETRY_DELAY: 1000, // base delay in ms
	TIMEOUT: 10000, // 10 seconds
	EXPORT_TIMEOUT: 30000, // 30 seconds for large export downloads
	QUEUE_POLL_INTERVAL: 30000, // background queue-status poll cadence
	PROGRESSIVE_API_TIMEOUT: 15_000, // per-API timeout when racing custom + system APIs
	OUTFIT_SNAPSHOT_MAX_ITEMS: 50, // upper bound on outfit-name lookups per snapshot
	TRANSLATION_CACHE_MAX: 100, // in-memory translation cache size
	TRANSLATION_CACHE_TTL: 60 * 60 * 1000 // 1 hour
} as const;

// API Actions for message passing
export const API_ACTIONS = {
	CHECK_USER_STATUS: 'checkUserStatus',
	CHECK_MULTIPLE_USERS: 'checkMultipleUsers',
	CHECK_GROUP_STATUS: 'checkGroupStatus',
	CHECK_MULTIPLE_GROUPS: 'checkMultipleGroups',
	QUEUE_USER: 'queueUser',
	GET_QUEUE_LIMITS: 'getQueueLimits',
	SUBMIT_VOTE: 'submitVote',
	GET_VOTES: 'getVotes',
	GET_STATS: 'getStats',
	TRANSLATE_TEXT: 'translateText',
	GET_GROUP_TRACKED_USERS: 'getGroupTrackedUsers',
	LOOKUP_ROBLOX_USER_DISCORD: 'lookupRobloxUserDiscord',
	EXPORT_GROUP_TRACKED_USERS: 'exportGroupTrackedUsers',
	LOOKUP_OUTFITS_BY_NAME: 'lookupOutfitsByName',
	LOOKUP_OUTFITS_BY_ID: 'lookupOutfitsById',
	FETCH_OUTFIT_IMAGES: 'fetchOutfitImages',
	EXTENSION_GET_MEMBERSHIP_STATUS: 'extensionGetMembershipStatus',
	EXTENSION_UPDATE_MEMBERSHIP_BADGE: 'extensionUpdateMembershipBadge',
	EXTENSION_CLEAR_MEMBERSHIP_BADGE: 'extensionClearMembershipBadge',
	EXTENSION_GET_MEMBERSHIP_VERIFICATION: 'extensionGetMembershipVerification',
	EXTENSION_CONFIRM_MEMBERSHIP_VERIFICATION: 'extensionConfirmMembershipVerification',
	HAS_TRANSLATE_PERMISSION: 'hasTranslatePermission',
	REQUEST_TRANSLATE_PERMISSION: 'requestTranslatePermission'
} as const;

export const CAPTCHA_EXTERNAL_MESSAGES = {
	SUCCESS: 'CAPTCHA_SUCCESS',
	ERROR: 'CAPTCHA_ERROR'
} as const;

export const CAPTCHA_MESSAGES = {
	CAPTCHA_START: 'CAPTCHA_START',
	CAPTCHA_TOKEN_READY: 'CAPTCHA_TOKEN_READY',
	CAPTCHA_CANCELLED: 'CAPTCHA_CANCELLED'
} as const;

// DOM selectors and data attributes for status/processing tracking
export const STATUS_SELECTORS = {
	PROCESSED_CLASS: 'status-processed',
	DATA_USER_ID: 'data-rotector-user-id',
	DATA_PROCESSED: 'data-rotector-processed',
	DATA_FLAGGED: 'data-rotector-flagged'
} as const;

// Rotector backend reason-category keys
export const REASON_KEYS = {
	USER_PROFILE: 'User Profile',
	AVATAR_OUTFIT: 'Avatar Outfit'
} as const;

export const VOTE_TYPES = {
	UPVOTE: 1,
	DOWNVOTE: -1
} as const;

export type VoteType = (typeof VOTE_TYPES)[keyof typeof VOTE_TYPES];

export const OBSERVER_CONFIG = {
	DEFAULT_HEALTH_CHECK_INTERVAL: 3000,
	DEFAULT_RESTART_DELAY: 1000
} as const;

export const RETRY_CONFIG = {
	MAX_RETRIES: 30,
	BASE_DELAY: 100, // ms
	BACKOFF_MULTIPLIER: 1.3,
	MAX_DELAY: 3000 // ms
} as const;

export const PAGE_TYPES = {
	HOME: 'home',
	FRIENDS_LIST: 'friends-list',
	FRIENDS_CAROUSEL: 'friends-carousel',
	PROFILE: 'profile',
	MEMBERS: 'members',
	REPORT: 'report',
	SEARCH_USER: 'search-user',
	GROUP_MEMBERS_CAROUSEL: 'group-members-carousel',
	GROUP_CONFIGURE_MEMBERS: 'group-configure-members'
} as const;

export const COMPONENT_CLASSES = {
	STATUS_CONTAINER: 'rtcr-status-container',
	STATUS_POSITIONED_ABSOLUTE: 'status-positioned-absolute',
	FRIENDS_MANAGER: 'rotector-friends-manager',
	GROUPS_MANAGER: 'rotector-groups-manager',
	GROUP_CONFIGURE_MANAGER: 'rotector-group-configure-manager',
	SEARCH_MANAGER: 'rotector-search-manager',
	HOME_CAROUSEL_MANAGER: 'rotector-home-carousel-manager',
	PROFILE_STATUS: 'rotector-profile-status',
	REPORT_HELPER: 'rotector-report-helper',
	GROUP_STATUS_CONTAINER: 'rotector-group-status-container',
	EXPORT_BUTTON: 'rotector-export-button',
	FRIENDS_SCAN: 'rotector-friends-scan',
	CIPHER_INDICATOR: 'rotector-cipher-indicator',
	MEMBERSHIP_BADGE_PILL: 'rotector-membership-badge-pill'
} as const;

export type ComponentClassType = (typeof COMPONENT_CLASSES)[keyof typeof COMPONENT_CLASSES];

export const USER_ACTIONS = {
	STATUS_CLICKED: 'status_indicator_clicked',
	QUEUE_REQUESTED: 'queue_requested',
	QUEUE_CONFIRMED: 'queue_confirmed',
	QUEUE_CANCELLED: 'queue_cancelled',
	VOTE_SUBMITTED: 'vote_submitted',
	FRIEND_PROCEED: 'friend_proceed',
	FRIEND_CANCEL: 'friend_cancel',
	FRIEND_BLOCK: 'friend_block',
	VOTE_WIDGET_CLICK: 'voting_widget_click',
	FRIEND_WARNING_PROCEED: 'friend_warning_proceed',
	FRIEND_WARNING_CANCEL: 'friend_warning_cancel',
	QUEUE_POPUP_CONFIRM: 'queue_popup_confirm',
	QUEUE_POPUP_CANCEL: 'queue_popup_cancel',
	REPORT_HELPER_AUTOFILL: 'report_helper_autofill',
	REPORT_HELPER_AUTOFILL_FAILED: 'report_helper_autofill_failed',
	REPORT_HELPER_OPEN_PAGE: 'report_helper_open_page',
	REPORT_HELPER_COPY_EVIDENCE: 'report_helper_copy_evidence'
} as const;

// Lookup context for request headers
export const LOOKUP_CONTEXT = {
	FRIENDS: 'friends',
	GROUPS: 'groups'
} as const;

export const REQUIRED_LEGAL_VERSION = '2.16.0';

export const LEGAL_URLS = {
	terms: 'https://rotector.com/terms',
	privacy: 'https://rotector.com/privacy'
} as const;

// Roblox API base URLs
export const ROBLOX_API = {
	THUMBNAILS: 'https://thumbnails.roblox.com',
	AVATAR: 'https://avatar.roblox.com',
	USERS: 'https://users.roblox.com',
	FRIENDS: 'https://friends.roblox.com',
	GROUPS: 'https://groups.roblox.com',
	PRESENCE: 'https://presence.roblox.com',
	APIS: 'https://apis.roblox.com'
} as const;

// browser.storage keys shared across stores and background workers
export const STORAGE_KEYS = {
	DEVELOPER_LOGS: 'developerLogs',
	PERFORMANCE_ENTRIES: 'performanceEntries',
	CONTENT_THEME: 'rotector-content-theme',
	METRICS_SNAPSHOTS: 'metricsSnapshots'
} as const;
