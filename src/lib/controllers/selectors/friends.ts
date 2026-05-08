export const FRIENDS_CAROUSEL_SELECTORS = {
	CONTAINER: '.friends-carousel-container',
	HEADER: '.react-friends-carousel-container .container-header.people-list-header',
	TILE: '.friends-carousel-tile',
	TILE_CONTENT: '.friend-tile-content',
	PROFILE_LINK: '.avatar-card-link',
	DISPLAY_NAME: '.friends-carousel-display-name',
	AVATAR_IMG: '.avatar-card-image img'
} as const;

export const FRIENDS_SELECTORS = {
	CONTAINER: '.hlist.avatar-cards',
	CARD: {
		CONTAINER: '.list-item.avatar-card',
		CAPTION: '.avatar-card-caption, .friend-caption, .avatar-card-label',
		DISPLAY_NAME: '.avatar-name',
		USERNAME: '.avatar-name-container + .avatar-card-label',
		AVATAR_IMG: '.thumbnail-2d-container img',
		FULLBODY: '.avatar-card-fullbody'
	},
	NO_RESULTS: '.section-content-off',
	PROFILE_LINK: '.avatar-card-link, .avatar-container > a'
} as const;
