// Status constants for visual display and API interaction
export const STATUS = {
  FLAGS: {
    SAFE: 0,
    PENDING: 1,
    UNSAFE: 2,
    QUEUED: 3,
  },
  REASON_TYPES: {
    USER_PROFILE: 0,
    FRIEND_NETWORK: 1,
    AVATAR_OUTFIT: 2,
    GROUP_MEMBERSHIP: 3,
    CONDO_ACTIVITY: 4,
    CHAT_MESSAGES: 5,
    GAME_FAVORITES: 6,
    EARNED_BADGES: 7,
  },
  REASON_TYPE_NAMES: {
    0: "User Profile",
    1: "Friend Network",
    2: "Avatar Outfit",
    3: "Group Membership",
    4: "Condo Activity",
    5: "Chat Messages",
    6: "Game Favorites",
    7: "Earned Badges",
  },
} as const;

// Type definitions based on constants
export type StatusFlag = typeof STATUS.FLAGS[keyof typeof STATUS.FLAGS];
export type ReasonType = typeof STATUS.REASON_TYPES[keyof typeof STATUS.REASON_TYPES];

// API Configuration
export const API_CONFIG = {
  BASE_URL: 'https://roscoe.robalyx.com',
  ENDPOINTS: {
    USER_CHECK: '/v1/lookup/roblox/user',
    MULTIPLE_USER_CHECK: '/v1/lookup/roblox/user',
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
  PROFILE_LINK: ".avatar-card-link",
  TILE_UNPROCESSED: `.friends-carousel-tile:not(.${STATUS_SELECTORS.PROCESSED_CLASS})`,
  DISPLAY_NAME: ".friends-carousel-display-name",
  AVATAR_IMG: ".thumbnail-2d-container img",
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

// Message constants
export const MESSAGES = {
  ERROR: {
    GENERIC: 'An error occurred. Please try again.',
    INVALID_USER_ID: 'Invalid user ID provided.',
    NETWORK_ERROR: 'Network error. Please check your connection.',
    API_ERROR: 'API error. Please try again later.',
    TIMEOUT: 'Request timed out. Please try again.',
  },
  SUCCESS: {
    USER_QUEUED: 'User successfully queued for review.',
    VOTE_SUBMITTED: 'Vote submitted successfully.',
  },
  STATUS: {
    SAFE: "No inappropriate behavior has been detected yet.",
    UNSAFE: "This user has been verified as inappropriate by Rotector's human moderators.",
    PENDING: "This user has been flagged by AI with confidence level.",
    QUEUED: "This user was flagged after being added to the queue but has not yet been officially confirmed by our system.",
  },
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
  DEFAULT_MAX_RETRIES: 20,
  DEFAULT_BATCH_DELAY: 250,
} as const;

// Element detection retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 20,
  BASE_DELAY: 1000, // ms
  BACKOFF_MULTIPLIER: 1.5,
  MAX_DELAY: 10000, // ms
  TIMEOUT: 30000, // 30 seconds total timeout
} as const;

// Page Types
export const PAGE_TYPES = {
  HOME: 'home',
  FRIENDS_LIST: 'friends-list',
  FRIENDS_CAROUSEL: 'friends-carousel', 
  PROFILE: 'profile',
  GROUPS: 'groups',
  REPORT: 'report'
} as const;

// Component Classes
export const COMPONENT_CLASSES = {
  STATUS_CONTAINER: 'rtcr-status-container',
  STATUS_POSITIONED_ABSOLUTE: 'status-positioned-absolute',
  FRIENDS_MANAGER: 'rotector-friends-manager',
  GROUPS_MANAGER: 'rotector-groups-manager',
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