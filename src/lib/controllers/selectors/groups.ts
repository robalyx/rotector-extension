export const GROUP_HEADER_SELECTORS = {
	HEADER_INFO: '.group-profile-header-info',
	DETAILS_CONTAINER: '.profile-header-details-container',
	ACTIONS_CONTAINER: '.actions-container',
	NAMES_CONTAINER: '.profile-header-details-names-container',
	GROUP_NAME: '.profile-header-details-community-name',
	OWNER_NAME: '.profile-header-details-owner-name',
	GROUP_IMAGE: '.profile-header-details-avatar-container img'
} as const;

export const GROUPS_MODAL_SELECTORS = {
	MODAL: 'div[role="dialog"].user-list-modal-content',
	LIST_CONTAINER: '.user-list-container',
	VLIST: '.user-list-container ul.vlist',
	ITEM: 'li.w-auto',
	PROFILE_LINK: 'a.user-item-clickable',
	TEXT_CONTAINER: '.grow-1.clip.text-truncate-split.text-no-wrap',
	AVATAR: '.avatar-card-fullbody .thumbnail-2d-container',
	DISPLAY_NAME: '.text-title-medium',
	USERNAME: '.text-body-medium'
} as const;

export const GROUP_MEMBERS_CAROUSEL_SELECTORS = {
	TAB_CONTENT: '.tab-content.rbx-tab-content.col-xs-12',
	SECTION: '.rotector-group-members-section',
	CONTAINER: '.rotector-group-members-carousel',
	MEMBER_TILE: '.rotector-member-tile',
	PROFILE_LINK: '.rotector-member-link',
	AVATAR_CONTAINER: '.rotector-member-avatar',
	DISPLAY_NAME: '.rotector-member-display-name'
} as const;

export const GROUP_CONFIGURE_SELECTORS = {
	CONTAINER: 'configure-group-members-v2',
	CARD: {
		CONTAINER: '.member-info-display-wrapper',
		TEXT_CONTAINER: '.member-info-display-member-column .text-overflow',
		AVATAR_IMG: '.thumbnail-2d-container img'
	},
	PROFILE_LINK: 'a[href*="/users/"]',
	HEADER: 'configure-group-members-v2 .group-mobile-spacing'
} as const;
