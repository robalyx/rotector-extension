import { STATUS_SELECTORS } from '../../types/constants';

export const PROFILE_SELECTORS = {
	HEADER: '.user-profile-header',
	HEADER_TITLE: '#profile-header-title-container-name',
	HEADER_FRIEND_BUTTON: '#user-profile-header-AddFriend',
	USERNAME: '.stylistic-alts-username',
	AVATAR_IMG: '.user-profile-header-details-avatar-container .avatar-card-image img'
} as const;

export const PROFILE_GROUPS_SHOWCASE_SELECTORS = {
	SECTION: '.profile-communities',
	HEADER_TITLE: '.profile-communities h2.content-emphasis',
	ITEMS_CONTAINER: '[data-rotector-carousel-container]',
	ITEM: '#collection-carousel-item',
	ITEM_UNPROCESSED: `#collection-carousel-item:not(.${STATUS_SELECTORS.PROCESSED_CLASS})`,
	TILE: '.base-tile',
	GROUP_LINK: 'a[href*="/communities/"]',
	GROUP_NAME: '.base-tile-title',
	IMAGE_CONTAINER: '.base-tile-thumbnail',
	THUMBNAIL: '.base-tile-thumbnail img'
} as const;

// BTRoblox extension's modified groups view where the third-party DOM differs from native
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
