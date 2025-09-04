// Status constants for visual display and API interaction
export const STATUS = {
    FLAGS: {
        SAFE: 0,
        PENDING: 1,
        UNSAFE: 2,
        QUEUED: 3,
        INTEGRATION: 4,
        MIXED: 5,
    },
    USER_REASON_TYPES: {
        USER_PROFILE: 0,
        FRIEND_NETWORK: 1,
        AVATAR_OUTFIT: 2,
        GROUP_MEMBERSHIP: 3,
        CONDO_ACTIVITY: 4,
        CHAT_MESSAGES: 5,
        GAME_FAVORITES: 6,
        EARNED_BADGES: 7,
    },
    GROUP_REASON_TYPES: {
        MEMBER: 0,
        PURPOSE: 1,
        DESCRIPTION: 2,
        SHOUT: 3,
    },
    USER_REASON_TYPE_NAMES: {
        0: "User Profile",
        1: "Friend Network",
        2: "Avatar Outfit",
        3: "Group Membership",
        4: "Condo Activity",
        5: "Chat Messages",
        6: "Game Favorites",
        7: "Earned Badges",
    },
    GROUP_REASON_TYPE_NAMES: {
        0: "Member Analysis",
        1: "Group Purpose",
        2: "Group Description",
        3: "Group Shout",
    },
} as const;

// Integration source constants
export const INTEGRATION_SOURCES = {
    BLOXDB: 'bloxdb',
} as const;

export const INTEGRATION_SOURCE_NAMES = {
    [INTEGRATION_SOURCES.BLOXDB]: 'BloxDB Analysis',
} as const;

export type StatusFlag = typeof STATUS.FLAGS[keyof typeof STATUS.FLAGS];
export type UserReasonType = typeof STATUS.USER_REASON_TYPES[keyof typeof STATUS.USER_REASON_TYPES];
export type GroupReasonType = typeof STATUS.GROUP_REASON_TYPES[keyof typeof STATUS.GROUP_REASON_TYPES];

// Entity types for status indicators
export const ENTITY_TYPES = {
    USER: 'user',
    GROUP: 'group',
} as const;

// API Configuration
export const API_CONFIG = {
    BASE_URL: 'https://roscoe.robalyx.com',
    ENDPOINTS: {
        USER_CHECK: '/v1/lookup/roblox/user',
        MULTIPLE_USER_CHECK: '/v1/lookup/roblox/user',
        GROUP_CHECK: '/v1/lookup/roblox/group',
        QUEUE_USER: '/v1/queue/roblox/user',
        SUBMIT_VOTE: '/v1/votes/roblox/user',
        GET_VOTES: '/v1/votes/roblox/user',
        GET_STATISTICS: '/v1/stats',
    },
    BATCH_SIZE: 100,
    BATCH_DELAY: 250, // ms between batches
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // base delay in ms
    TIMEOUT: 10000, // 10 seconds
} as const;

// API Actions for message passing
export const API_ACTIONS = {
    CHECK_USER_STATUS: 'checkUserStatus',
    CHECK_MULTIPLE_USERS: 'checkMultipleUsers',
    CHECK_GROUP_STATUS: 'checkGroupStatus',
    CHECK_MULTIPLE_GROUPS: 'checkMultipleGroups',
    QUEUE_USER: 'queueUser',
    SUBMIT_VOTE: 'submitVote',
    GET_VOTES: 'getVotes',
    GET_MULTIPLE_VOTES: 'getMultipleVotes',
    GET_STATISTICS: 'getStatistics',
} as const;

// DOM selectors for status elements
const STATUS_SELECTORS = {
    CONTAINER: "status-container",
    ICON: "status-icon",
    TEXT: "status-text",
    TOOLTIP: "status-tooltip",
    TOOLTIPS_DISABLED: "tooltips-disabled",
    LOADING: "loading",
    SAFE: "safe",
    UNSAFE: "unsafe",
    PENDING: "pending",
    ERROR: "error",
    QUEUED: "queued",
    REPORTABLE_BADGE: "reportable-badge",
    QUEUE_BADGE: "queue-badge",
    OUTFIT_BADGE: "outfit-badge",
    REASONS_CONTAINER: "reasons-container",
    ERROR_DETAILS: "error-details",
    EXPANDED_OVERLAY: "expanded-tooltip-overlay",
    EXPANDED_TOOLTIP: "expanded-tooltip",
    EXPANDED_CLOSE: "expanded-tooltip-close",
    EXPANDED_CONTENT: "expanded-tooltip-content",
    TOOLTIP_HEADER: "tooltip-header",
    REPORTABLE_NOTICE: "reportable-notice",
    REPORTABLE_ICON: "reportable-icon",
    REPORTABLE_TEXT: "reportable-text",
    OUTFIT_NOTICE: "outfit-notice",
    OUTFIT_ICON: "outfit-icon",
    OUTFIT_TEXT: "outfit-text",
    REPORT_BUTTON: "report-button",
    TOOLTIP_DIVIDER: "tooltip-divider",
    QUEUE_BUTTON: "queue-button",
    PROCESSED_CLASS: "status-processed",
    TOOLTIP_PROFILE_HEADER: "tooltip-profile-header",
    TOOLTIP_AVATAR: "tooltip-avatar",
    TOOLTIP_USER_INFO: "tooltip-user-info",
    TOOLTIP_USERNAME: "tooltip-username",
    TOOLTIP_USER_ID: "tooltip-user-id",
    TOOLTIP_STATUS_BADGE: "tooltip-status-badge",
    TOOLTIP_STATUS_INDICATOR: "status-indicator",
    VOTING_CONTAINER: "voting-container",
    VOTING_LOADING: "voting-loading",
    VOTING_HEADER: "voting-header",
    VOTING_TITLE: "voting-title",
    VOTING_COUNT: "voting-count",
    VOTING_BAR: "voting-bar",
    VOTING_METER: "voting-meter",
    VOTING_METER_FILL: "voting-meter-fill",
    VOTING_STATS: "voting-stats",
    VOTING_PERCENTAGE: "voting-percentage",
    VOTING_RATIO: "voting-ratio",
    VOTING_BUTTONS: "voting-buttons",
    VOTING_BUTTON: "voting-button",
    VOTING_BUTTON_ACTIVE: "active",
    VOTING_ICON: "voting-icon",
    VOTING_UPVOTE: "upvote",
    VOTING_DOWNVOTE: "downvote",
    VOTING_UPVOTE_ICON: "upvote-icon",
    VOTING_DOWNVOTE_ICON: "downvote-icon",
    VOTING_ERROR: "voting-error",
    ENGINE_VERSION_TAG: "engine-version-tag",
    ENGINE_VERSION_TOOLTIP: "engine-version-tooltip",
    ENGINE_VERSION_CONTAINER: "engine-version-container",
    ADVANCED_DETAILS_FOOTER: "advanced-details-footer",
    ADVANCED_DETAILS_ICON: "advanced-details-icon",
    ADVANCED_DETAILS_TEXT: "advanced-details-text",
} as const;

// DOM selectors for friends carousel
export const FRIENDS_CAROUSEL_SELECTORS = {
    CONTAINER: ".friends-carousel-container",
    TILE: ".friends-carousel-tile",
    TILE_CONTENT: ".friend-tile-content",
    PROFILE_LINK: ".avatar-card-link",
    TILE_UNPROCESSED: `.friends-carousel-tile:not(.${STATUS_SELECTORS.PROCESSED_CLASS})`,
    DISPLAY_NAME: ".friends-carousel-display-name",
    AVATAR_IMG: ".avatar-card-image img",
} as const;

// DOM selectors for profile page
export const PROFILE_SELECTORS = {
    PROFILE_HEADER_CONTAINER: ".profile-header-container",
    PROFILE_HEADER: ".profile-header-title-container",
    PROFILE_HEADER_MAIN: ".profile-header-main",
    USERNAME: ".profile-header-username",
    AVATAR_IMG: ".profile-avatar-thumb img",
    TITLE_CONTAINER: ".profile-header-title-container",
    TITLE: ".profile-header-title",
    DROPDOWN: ".profile-header-dropdown",
    BLOCK_BUTTON: ".block-button",
    FRIEND_BUTTON: ".friend-button",
    ADD_FRIEND_BUTTON_CONTAINER: ".profile-header-buttons",
    AVATAR_THUMB: ".profile-avatar-thumb",
    AVATAR_IMAGE: ".profile-avatar-image",
} as const;

// DOM selectors for friends list pages
export const FRIENDS_SELECTORS = {
    CONTAINER: ".hlist.avatar-cards",
    CARD: {
        CONTAINER: ".list-item.avatar-card",
        UNPROCESSED: `.list-item.avatar-card:not(.${STATUS_SELECTORS.PROCESSED_CLASS})`,
        CAPTION: ".avatar-card-caption, .friend-caption, .avatar-card-label",
        USERNAME: ".avatar-name",
        AVATAR_IMG: ".thumbnail-2d-container img",
        FULLBODY: ".avatar-card-fullbody",
    },
    NO_RESULTS: ".section-content-off",
    PROFILE_LINK: ".avatar-card-link, .avatar-container > a",
} as const;

// DOM selectors for groups page
export const GROUPS_SELECTORS = {
    CONTAINER: '.group-section-content-transparent.group-members-list',
    TILE: '.list-item.member',
    TILE_UNPROCESSED: `.list-item.member:not(.${STATUS_SELECTORS.PROCESSED_CLASS})`,
    PROFILE_LINK: '.avatar-container > a',
    USERNAME: '.text-overflow.font-caption-header.member-name',
    AVATAR_IMG: '.thumbnail-2d-container img',
    NO_RESULTS: '.section-content-off',
} as const;

// DOM selectors for search users page
export const SEARCH_SELECTORS = {
    CONTAINER: 'ul.search-result.avatar-cards',
    CARD: {
        CONTAINER: 'li.player-item.avatar-card',
        UNPROCESSED: `li.player-item.avatar-card:not(.${STATUS_SELECTORS.PROCESSED_CLASS})`,
        CAPTION: '.avatar-card-caption',
        USERNAME: '.avatar-name-container .avatar-name',
        AVATAR_IMG: '.thumbnail-2d-container img',
        FULLBODY: '.avatar-card-fullbody',
    },
    NO_RESULTS: '.section-content-off.no-results',
    PROFILE_LINK: 'a.avatar-card-link',
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
    CONTAINER: '.groups-showcase',
    SECTION: '.section, .container-list',
    SECTION_CONTENT: '.profile-slide-container.section-content',
    VIEW_BUTTONS: '.container-buttons',
    SLIDESHOW_BUTTON: '.btn-generic-slideshow-xs',
    GRID_BUTTON: '.btn-generic-grid-xs',
    // Slideshow mode selectors
    SLIDESHOW: {
        CONTAINER: '#groups-switcher.slide-switcher.groups',
        ITEMS_CONTAINER: '.slide-items-container.switcher-items.hlist',
        ITEM: '.switcher-item.slide-item-container',
        ITEM_UNPROCESSED: `.switcher-item.slide-item-container:not(.${STATUS_SELECTORS.PROCESSED_CLASS})`,
        GROUP_LINK: '.slide-item-container-left a',
        GROUP_NAME: '.slide-item-name.text-overflow.groups.font-title',
        GROUP_DESCRIPTION: '.text-description.slide-item-description.groups',
        THUMBNAIL: '.thumbnail-2d-container img',
        STATS: '.slide-item-stats',
    },
    // Grid mode selectors
    GRID: {
        CONTAINER: '.groups-showcase-grid',
        ITEMS_CONTAINER: '.hlist.game-cards.group-list',
        ITEM: '.list-item.group-container',
        ITEM_UNPROCESSED: `.list-item.group-container:not(.${STATUS_SELECTORS.PROCESSED_CLASS})`,
        CARD: '.game-card',
        GROUP_LINK: '.card-item.game-card-container',
        GROUP_NAME: '.text-overflow.game-card-name',
        IMAGE_CONTAINER: '.game-card-thumb-container',
        THUMBNAIL: '.thumbnail-2d-container img',
        THUMBNAIL_CONTAINER: '.thumbnail-2d-container',
        LOAD_MORE: '#groups-load-more',
    }
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

// Vote types
export const VOTE_TYPES = {
    UPVOTE: 1,
    DOWNVOTE: -1,
} as const;

export type VoteType = typeof VOTE_TYPES[keyof typeof VOTE_TYPES];

// Observer configuration defaults
export const OBSERVER_CONFIG = {
    DEFAULT_HEALTH_CHECK_INTERVAL: 3000,
    DEFAULT_RESTART_DELAY: 1000,
    DEFAULT_BATCH_DELAY: 250,
} as const;

// Element detection retry configuration
export const RETRY_CONFIG = {
    MAX_RETRIES: 30,
    BASE_DELAY: 300, // ms
    BACKOFF_MULTIPLIER: 1.3,
    MAX_DELAY: 3000, // ms
} as const;

// Page Types
export const PAGE_TYPES = {
    HOME: 'home',
    FRIENDS_LIST: 'friends-list',
    FRIENDS_CAROUSEL: 'friends-carousel',
    PROFILE: 'profile',
    MEMBERS: 'members',
    REPORT: 'report',
    SEARCH_USER: 'search-user'
} as const;

// Component Classes
export const COMPONENT_CLASSES = {
    STATUS_CONTAINER: 'rtcr-status-container',
    STATUS_POSITIONED_ABSOLUTE: 'status-positioned-absolute',
    FRIENDS_MANAGER: 'rotector-friends-manager',
    GROUPS_MANAGER: 'rotector-groups-manager',
    SEARCH_MANAGER: 'rotector-search-manager',
    HOME_CAROUSEL_MANAGER: 'rotector-home-carousel-manager',
    PROFILE_STATUS: 'rotector-profile-status',
    FRIEND_WARNING: 'rotector-friend-warning',
    QUEUE_MODAL: 'rotector-queue-modal',
    REPORT_HELPER: 'rotector-report-helper',
    VOTING_WIDGET: 'rotector-voting-widget',
    COMPONENT_BASE: 'rotector-component'
} as const;

// Type for component class values
export type ComponentClassType = typeof COMPONENT_CLASSES[keyof typeof COMPONENT_CLASSES];

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
    REPORT_HELPER_OPEN_PAGE: 'report_helper_open_page',
    REPORT_HELPER_COPY_EVIDENCE: 'report_helper_copy_evidence'
} as const; 