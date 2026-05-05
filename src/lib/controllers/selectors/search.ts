export const SEARCH_SELECTORS = {
	CONTAINER: 'ul.search-result.avatar-cards',
	CARD: {
		CONTAINER: 'li.player-item.avatar-card',
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
