// Status constants for visual display and API interaction
export const STATUS = {
	FLAGS: {
		SAFE: 0,
		PENDING: 1,
		UNSAFE: 2,
		QUEUED: 3,
		INTEGRATION: 4,
		MIXED: 5,
		PAST_OFFENDER: 6
	}
} as const;

export type StatusFlag = (typeof STATUS.FLAGS)[keyof typeof STATUS.FLAGS];

// Entity types for status indicators
export const ENTITY_TYPES = {
	USER: 'user',
	GROUP: 'group'
} as const;

// API Configuration
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
		GET_STATISTICS: '/v1/stats',
		EXTENSION_AUTH_LOGIN: '/v1/extension/auth/login',
		EXTENSION_AUTH_CALLBACK: '/v1/extension/auth/callback',
		EXTENSION_PROFILE: '/v1/extension/profile',
		EXTENSION_PROFILE_ANONYMOUS: '/v1/extension/profile/anonymous',
		EXTENSION_RESET_UUID: '/v1/extension/profile/reset-uuid',
		EXTENSION_REPORT: '/v1/extension/report',
		EXTENSION_REPORTS: '/v1/extension/reports',
		EXTENSION_USERS_REPORTABLE: '/v1/extension/users/reportable',
		EXTENSION_LEADERBOARD: '/v1/extension/leaderboard',
		EXTENSION_STATISTICS: '/v1/extension/statistics',
		WAR_MAP: '/v1/war/map',
		WAR_ZONES: '/v1/war/zones',
		WAR_ORDERS: '/v1/war/orders',
		WAR_STATS_HISTORY: '/v1/war/stats/history',
		QUEUE_STATUS: '/v1/queue/roblox/user/status'
	},
	BATCH_SIZE: 100,
	BATCH_DELAY: 250, // ms between batches
	MAX_RETRIES: 3,
	RETRY_DELAY: 1000, // base delay in ms
	TIMEOUT: 10000 // 10 seconds
} as const;

// API Actions for message passing
export const API_ACTIONS = {
	CHECK_USER_STATUS: 'checkUserStatus',
	CHECK_MULTIPLE_USERS: 'checkMultipleUsers',
	CHECK_GROUP_STATUS: 'checkGroupStatus',
	CHECK_MULTIPLE_GROUPS: 'checkMultipleGroups',
	QUEUE_USER: 'queueUser',
	GET_QUEUE_LIMITS: 'getQueueLimits',
	GET_QUEUE_STATUS: 'getQueueStatus',
	SUBMIT_VOTE: 'submitVote',
	GET_VOTES: 'getVotes',
	GET_MULTIPLE_VOTES: 'getMultipleVotes',
	GET_STATISTICS: 'getStatistics',
	EXTENSION_GET_PROFILE: 'extensionGetProfile',
	EXTENSION_UPDATE_ANONYMOUS: 'extensionUpdateAnonymous',
	EXTENSION_RESET_UUID: 'extensionResetUuid',
	EXTENSION_SUBMIT_REPORT: 'extensionSubmitReport',
	EXTENSION_GET_REPORTS: 'extensionGetReports',
	EXTENSION_GET_REPORTABLE_USER: 'extensionGetReportableUser',
	EXTENSION_GET_LEADERBOARD: 'extensionGetLeaderboard',
	EXTENSION_GET_STATISTICS: 'extensionGetStatistics',
	WAR_GET_MAP: 'warGetMap',
	WAR_GET_ZONE: 'warGetZone',
	WAR_GET_ZONE_STATS: 'warGetZoneStats',
	WAR_GET_ORDERS: 'warGetOrders',
	WAR_GET_ORDER: 'warGetOrder',
	WAR_GET_STATS_HISTORY: 'warGetStatsHistory',
	INITIATE_DISCORD_LOGIN: 'initiateDiscordLogin',
	TRANSLATE_TEXT: 'translateText',
	HAS_TRANSLATE_PERMISSION: 'hasTranslatePermission',
	REQUEST_TRANSLATE_PERMISSION: 'requestTranslatePermission',
	GET_GROUP_TRACKED_USERS: 'getGroupTrackedUsers',
	LOOKUP_ROBLOX_USER_DISCORD: 'lookupRobloxUserDiscord'
} as const;

// Discord OAuth external message types
export const DISCORD_OAUTH_MESSAGES = {
	AUTH_SUCCESS: 'DISCORD_AUTH_SUCCESS',
	AUTH_ERROR: 'DISCORD_AUTH_ERROR'
} as const;

// Captcha external message types
export const CAPTCHA_EXTERNAL_MESSAGES = {
	SUCCESS: 'CAPTCHA_SUCCESS',
	ERROR: 'CAPTCHA_ERROR'
} as const;

// Captcha internal message types
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

// DOM selectors for friends carousel
export const FRIENDS_CAROUSEL_SELECTORS = {
	CONTAINER: '.friends-carousel-container',
	TILE: '.friends-carousel-tile',
	TILE_CONTENT: '.friend-tile-content',
	PROFILE_LINK: '.avatar-card-link',
	TILE_UNPROCESSED: `.friends-carousel-tile:not(.${STATUS_SELECTORS.PROCESSED_CLASS})`,
	DISPLAY_NAME: '.friends-carousel-display-name',
	AVATAR_IMG: '.avatar-card-image img'
} as const;

// DOM selectors for profile page
export const PROFILE_SELECTORS = {
	// Profile header selectors
	HEADER: '.user-profile-header',
	HEADER_TITLE: '#profile-header-title-container-name',
	HEADER_TITLE_WRAPPER: '.items-center.gap-xsmall.flex',
	HEADER_FRIEND_BUTTON: 'button.foundation-web-button',
	HEADER_DROPDOWN_BUTTON: '#user-profile-header-contextual-menu-button',
	USERNAME: '.stylistic-alts-username',
	AVATAR_IMG: '.user-profile-header-details-avatar-container .avatar-card-image img'
} as const;

// DOM selectors for friends list pages
export const FRIENDS_SELECTORS = {
	CONTAINER: '.hlist.avatar-cards',
	CARD: {
		CONTAINER: '.list-item.avatar-card',
		UNPROCESSED: `.list-item.avatar-card:not(.${STATUS_SELECTORS.PROCESSED_CLASS})`,
		CAPTION: '.avatar-card-caption, .friend-caption, .avatar-card-label',
		DISPLAY_NAME: '.avatar-name',
		USERNAME: '.avatar-name-container + .avatar-card-label',
		AVATAR_IMG: '.thumbnail-2d-container img',
		FULLBODY: '.avatar-card-fullbody'
	},
	NO_RESULTS: '.section-content-off',
	PROFILE_LINK: '.avatar-card-link, .avatar-container > a'
} as const;

// DOM selectors for groups modal member list
export const GROUPS_MODAL_SELECTORS = {
	MODAL: 'div[role="dialog"].user-list-modal-content',
	LIST_CONTAINER: '.user-list-container',
	VLIST: '.user-list-container ul.vlist',
	ITEM: 'li.w-auto',
	ITEM_UNPROCESSED: `li.w-auto:not(.${STATUS_SELECTORS.PROCESSED_CLASS})`,
	PROFILE_LINK: 'a.user-item-clickable',
	TEXT_CONTAINER: '.grow-1.clip.text-truncate-split.text-no-wrap',
	AVATAR: '.avatar-card-fullbody .thumbnail-2d-container',
	DISPLAY_NAME: '.text-title-medium',
	USERNAME: '.text-body-medium'
} as const;

// DOM selectors for group members carousel
export const GROUP_MEMBERS_CAROUSEL_SELECTORS = {
	TAB_CONTENT: '.tab-content.rbx-tab-content.col-xs-12',
	SECTION: '.rotector-group-members-section',
	CONTAINER: '.rotector-group-members-carousel',
	MEMBER_TILE: '.rotector-member-tile',
	MEMBER_TILE_UNPROCESSED: `.rotector-member-tile:not(.${STATUS_SELECTORS.PROCESSED_CLASS})`,
	PROFILE_LINK: '.rotector-member-link',
	AVATAR_CONTAINER: '.rotector-member-avatar',
	DISPLAY_NAME: '.rotector-member-display-name'
} as const;

// DOM selectors for group configure members page
export const GROUP_CONFIGURE_SELECTORS = {
	CONTAINER: 'configure-group-members-list .hlist.avatar-cards',
	CARD: {
		CONTAINER: '.list-item.avatar-card',
		UNPROCESSED: `.list-item.avatar-card:not(.${STATUS_SELECTORS.PROCESSED_CLASS})`,
		CAPTION: '.avatar-card-caption, .avatar-card-label',
		CAPTION_INNER: '.avatar-card-caption > span',
		USERNAME: '.avatar-name',
		AVATAR_IMG: '.thumbnail-2d-container img',
		FULLBODY: '.avatar-card-fullbody'
	},
	PROFILE_LINK: 'a[href*="/users/"]'
} as const;

// DOM selectors for search users page
export const SEARCH_SELECTORS = {
	CONTAINER: 'ul.search-result.avatar-cards',
	CARD: {
		CONTAINER: 'li.player-item.avatar-card',
		UNPROCESSED: `li.player-item.avatar-card:not(.${STATUS_SELECTORS.PROCESSED_CLASS})`,
		CAPTION: '.avatar-card-caption',
		DISPLAY_NAME: '.avatar-name-container .avatar-name',
		USERNAME: '.avatar-name-container + .avatar-card-label',
		AVATAR_IMG: '.thumbnail-2d-container img',
		FULLBODY: '.avatar-card-fullbody'
	},
	FRIEND_BUTTON: '.btn-control-md, .mobile-card-btn',
	NO_RESULTS: '.section-content-off.no-results',
	PROFILE_LINK: 'a.avatar-card-link'
} as const;

// DOM selectors for group header
export const GROUP_HEADER_SELECTORS = {
	HEADER_INFO: '.group-profile-header-info',
	DETAILS_CONTAINER: '.profile-header-details-container',
	ACTIONS_CONTAINER: '.actions-container',
	NAMES_CONTAINER: '.profile-header-details-names-container',
	GROUP_NAME: '.profile-header-details-community-name',
	OWNER_NAME: '.profile-header-details-owner-name',
	GROUP_IMAGE: '.profile-header-details-avatar-container img'
} as const;

// DOM selectors for profile groups showcase
export const PROFILE_GROUPS_SHOWCASE_SELECTORS = {
	// Parent container for groups section (distinguishes from other carousels on page)
	SECTION: '.profile-communities',
	ITEMS_CONTAINER: '[data-rotector-carousel-container]',
	ITEM: '#collection-carousel-item',
	ITEM_UNPROCESSED: `#collection-carousel-item:not(.${STATUS_SELECTORS.PROCESSED_CLASS})`,
	TILE: '.base-tile',
	GROUP_LINK: 'a[href*="/communities/"]',
	GROUP_NAME: '.base-tile-title',
	IMAGE_CONTAINER: '.base-tile-thumbnail',
	THUMBNAIL: '.base-tile-thumbnail img'
} as const;

// DOM selectors for BTRoblox extension modified groups view
export const BTROBLOX_GROUPS_SELECTORS = {
	CONTAINER: '.btr-profile-groups',
	SECTION_CONTENT: '.section-content',
	ITEMS_CONTAINER: '.hlist[ng-non-bindable]',
	ITEM: '.list-item.game-card',
	ITEM_UNPROCESSED: `.list-item.game-card:not(.${STATUS_SELECTORS.PROCESSED_CLASS})`,
	GROUP_LINK: '.card-item.game-card-container a',
	GROUP_NAME: '.text-overflow.game-card-name',
	IMAGE_CONTAINER: '.game-card-thumb-container',
	THUMBNAIL: '.game-card-thumb',
	MEMBER_COUNT: '.text-overflow.game-card-name-secondary.text-secondary.small',
	PAGER_CONTAINER: '.btr-pager-holder',
	PAGER: '.btr-pager'
} as const;

// DOM selectors for report/abuse pages
export const REPORT_PAGE_SELECTORS = {
	FORM_CONTAINER: '.abuse-report-container',
	FOOTER: '.single-step-footer',
	CATEGORY_BUTTON: 'button[role="combobox"]',
	CATEGORY_SELECTED_TEXT: 'button[role="combobox"] .foundation-web-menu-item-title',
	COMMENT_TEXTAREA: 'textarea.foundation-web-text-area',
	DROPDOWN_OPTION: '[role="option"]',
	SUBMIT_BUTTON: '.single-step-footer button[type="button"]'
} as const;

// DOM selectors for blur feature
export const BLUR_SELECTORS = {
	// Friend carousel tiles
	CAROUSEL_DISPLAY_NAME: '.friends-carousel-display-name',

	// Avatar cards
	CARD_DISPLAY_NAME: '.avatar-name',
	CARD_USERNAME: '.avatar-card-label',

	// Profile page
	PROFILE_DISPLAY_NAME: '#profile-header-title-container-name',
	PROFILE_USERNAME: '.stylistic-alts-username',
	PROFILE_DESCRIPTION: '.description-content',
	PROFILE_AVATAR: '.user-profile-header-details-avatar-container .thumbnail-2d-container',

	PROFILE_OUTFIT_2D: '.thumbnail-holder .thumbnail-2d-container',
	PROFILE_OUTFIT_3D: '.thumbnail-holder .thumbnail-3d-container',
	PROFILE_CURRENTLY_WEARING: '.profile-item-card .thumbnail-2d-container',

	// Avatar selectors
	CAROUSEL_AVATAR: '.friends-carousel-tile .avatar-card-image',
	FRIENDS_LIST_AVATAR: '.list-item.avatar-card .thumbnail-2d-container',
	SEARCH_AVATAR: 'li.player-item.avatar-card .thumbnail-2d-container',

	// Relative selectors
	TILE_CAROUSEL_AVATAR: '.avatar-card-image',
	TILE_THUMBNAIL: '.thumbnail-2d-container',

	// Search results
	SEARCH_DISPLAY_NAME: '.avatar-name-container .avatar-name',

	// Group members carousel
	MEMBER_CAROUSEL_DISPLAY_NAME: '.rotector-member-tile .rotector-member-display-name',
	MEMBER_CAROUSEL_AVATAR: '.rotector-member-tile .rotector-member-avatar',

	// Data attributes for blur state tracking
	BLUR_USER_ID: 'data-blur-user-id',
	BLUR_TYPE: 'data-blur-type',
	BLUR_GROUP: 'data-blur-group',
	BLUR_TITLE: 'title'
} as const;

// Profile blur group identifiers
export const PROFILE_BLUR_GROUPS = {
	HEADER: 'profile-header',
	OUTFIT: 'profile-outfit'
} as const;

// Vote types
export const VOTE_TYPES = {
	UPVOTE: 1,
	DOWNVOTE: -1
} as const;

export type VoteType = (typeof VOTE_TYPES)[keyof typeof VOTE_TYPES];

// Observer configuration defaults
export const OBSERVER_CONFIG = {
	DEFAULT_HEALTH_CHECK_INTERVAL: 3000,
	DEFAULT_RESTART_DELAY: 1000,
	DEFAULT_BATCH_DELAY: 250
} as const;

// Element detection retry configuration
export const RETRY_CONFIG = {
	MAX_RETRIES: 10,
	BASE_DELAY: 100, // ms
	BACKOFF_MULTIPLIER: 1.3,
	MAX_DELAY: 3000 // ms
} as const;

// Page Types
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

// Component Classes
export const COMPONENT_CLASSES = {
	STATUS_CONTAINER: 'rtcr-status-container',
	STATUS_POSITIONED_ABSOLUTE: 'status-positioned-absolute',
	FRIENDS_MANAGER: 'rotector-friends-manager',
	GROUPS_MANAGER: 'rotector-groups-manager',
	GROUP_CONFIGURE_MANAGER: 'rotector-group-configure-manager',
	SEARCH_MANAGER: 'rotector-search-manager',
	HOME_CAROUSEL_MANAGER: 'rotector-home-carousel-manager',
	PROFILE_STATUS: 'rotector-profile-status',
	FRIEND_WARNING: 'rotector-friend-warning',
	QUEUE_MODAL: 'rotector-queue-modal',
	REPORT_HELPER: 'rotector-report-helper',
	REPORT_HELPER_SUCCESS_MESSAGE: 'report-helper-success-message',
	GROUP_STATUS_CONTAINER: 'rotector-group-status-container',
	VOTING_WIDGET: 'rotector-voting-widget',
	COMPONENT_BASE: 'rotector-component'
} as const;

// Type for component class values
export type ComponentClassType = (typeof COMPONENT_CLASSES)[keyof typeof COMPONENT_CLASSES];

// User Actions
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
	FRIENDS: 'friends'
} as const;
