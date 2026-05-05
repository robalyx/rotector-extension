export const BLUR_SELECTORS = {
	// Friend carousel tiles
	CAROUSEL_DISPLAY_NAME: '.friends-carousel-display-name',

	// Avatar cards
	CARD_DISPLAY_NAME: '.avatar-name',
	CARD_USERNAME: '.avatar-card-label',

	// Profile page
	PROFILE_DISPLAY_NAME: '#profile-header-title-container-name',
	PROFILE_USERNAME: '.stylistic-alts-username',
	PROFILE_DESCRIPTION_STANDARD: '.description-content',
	PROFILE_DESCRIPTION_BTR: '.btr-profile-description',
	PROFILE_DESCRIPTION: '.description-content, .btr-profile-description',
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

	// Group configure members
	GROUP_CONFIGURE_DISPLAY_NAME: '.member-info-display-member-column a.text-label-medium',
	GROUP_CONFIGURE_USERNAME: '.member-info-display-member-column a.text-body-small',
	GROUP_CONFIGURE_AVATAR: '.member-info-display-avatar .thumbnail-2d-container',

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
