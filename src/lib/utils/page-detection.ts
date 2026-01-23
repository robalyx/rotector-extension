import {
	BTROBLOX_GROUPS_SELECTORS,
	FRIENDS_CAROUSEL_SELECTORS,
	FRIENDS_SELECTORS,
	GROUP_HEADER_SELECTORS,
	GROUPS_MODAL_SELECTORS,
	GROUPS_SELECTORS,
	PROFILE_GROUPS_SHOWCASE_SELECTORS,
	PROFILE_SELECTORS,
	SEARCH_SELECTORS
} from '../types/constants';

export interface UserInfo {
	userId: string;
	username: string;
	avatarUrl?: string;
}

export interface GroupInfo {
	groupId: string;
	groupName: string;
	groupImageUrl?: string;
}

interface PageDetectionResult {
	pageType:
		| 'carousel'
		| 'friends'
		| 'members'
		| 'modal-members'
		| 'profile'
		| 'group'
		| 'search'
		| 'unknown';
	container: Element | null;
}

// Normalizes a pathname by stripping the language prefix if present.
export function normalizePathname(pathname: string): string {
	// Match language prefixes like /es/, /de/, /pt-br/ at the start
	// Pattern: slash + 2-5 lowercase letters/hyphens + slash
	return pathname.replace(/^\/[a-z]{2}(?:-[a-z]{2})?\//, '/');
}

// Detect the page type and container from an anchor element
export function detectPageContext(anchorElement: HTMLElement): PageDetectionResult {
	// Check for specific element containers
	const isCarouselTile = anchorElement.closest(FRIENDS_CAROUSEL_SELECTORS.TILE);
	const isFriendsCard = anchorElement.closest(FRIENDS_SELECTORS.CARD.CONTAINER);
	const isMembersTile = anchorElement.closest(GROUPS_SELECTORS.TILE);
	const isModalMembersItem = anchorElement.closest(GROUPS_MODAL_SELECTORS.ITEM);
	const isSearchCard = anchorElement.closest(SEARCH_SELECTORS.CARD.CONTAINER);
	const isGroupCard = anchorElement.closest(PROFILE_GROUPS_SHOWCASE_SELECTORS.ITEM);
	const isBTRobloxGroupCard = anchorElement.closest(BTROBLOX_GROUPS_SELECTORS.ITEM);

	// Check for URL-based page
	const normalizedPath = normalizePathname(window.location.pathname);
	const isProfilePage = normalizedPath.includes('/users/');
	const isGroupPage =
		normalizedPath.includes('/groups/') || normalizedPath.includes('/communities/');

	if (isCarouselTile) {
		return { pageType: 'carousel', container: isCarouselTile };
	}
	if (isFriendsCard) {
		return { pageType: 'friends', container: isFriendsCard };
	}
	if (isMembersTile) {
		return { pageType: 'members', container: isMembersTile };
	}
	if (isModalMembersItem) {
		return { pageType: 'modal-members', container: isModalMembersItem };
	}
	if (isSearchCard) {
		return { pageType: 'search', container: isSearchCard };
	}
	if (isGroupCard || isBTRobloxGroupCard) {
		return {
			pageType: 'profile',
			container: isGroupCard ?? isBTRobloxGroupCard
		};
	}

	if (isGroupPage) {
		return {
			pageType: 'group',
			container: document.querySelector(GROUP_HEADER_SELECTORS.DETAILS_CONTAINER)
		};
	}
	if (isProfilePage) {
		return {
			pageType: 'profile',
			container: document.querySelector(PROFILE_SELECTORS.PROFILE_HEADER_MAIN)
		};
	}

	return { pageType: 'unknown', container: null };
}

// Extract user information based on page type and container
export function extractUserInfo(
	userId: string,
	pageType: string,
	container: Element | null
): UserInfo {
	if (!container) {
		return { userId, username: 'Unknown User' };
	}

	let username = 'Unknown User';
	let avatarUrl: string | undefined;

	const usernameSelectors = {
		carousel: FRIENDS_CAROUSEL_SELECTORS.DISPLAY_NAME,
		friends: FRIENDS_SELECTORS.CARD.USERNAME,
		members: GROUPS_SELECTORS.USERNAME,
		'modal-members': GROUPS_MODAL_SELECTORS.DISPLAY_NAME,
		search: SEARCH_SELECTORS.CARD.USERNAME,
		profile: PROFILE_SELECTORS.USERNAME
	};

	const avatarSelectors = {
		carousel: FRIENDS_CAROUSEL_SELECTORS.AVATAR_IMG,
		friends: FRIENDS_SELECTORS.CARD.AVATAR_IMG,
		members: GROUPS_SELECTORS.AVATAR_IMG,
		'modal-members': `${GROUPS_MODAL_SELECTORS.AVATAR} img`,
		search: SEARCH_SELECTORS.CARD.AVATAR_IMG,
		profile: PROFILE_SELECTORS.AVATAR_IMG
	};

	// Extract username
	if (pageType in usernameSelectors) {
		const usernameSelector = usernameSelectors[pageType as keyof typeof usernameSelectors];
		const usernameEl = container.querySelector(usernameSelector);
		if (usernameEl) {
			let text = usernameEl.textContent?.trim() || '';
			if (text.startsWith('@')) text = text.substring(1);
			if (text) username = text;
		}
	}

	// Extract avatar URL
	if (pageType in avatarSelectors) {
		const avatarSelector = avatarSelectors[pageType as keyof typeof avatarSelectors];
		const avatarEl = container.querySelector(avatarSelector);
		if (avatarEl instanceof HTMLImageElement && avatarEl.src) {
			avatarUrl = avatarEl.src;
		}
	}

	return { userId, username, avatarUrl };
}

// Extract group information based on page type and container
export function extractGroupInfo(
	groupId: string,
	pageType: string,
	container: Element | null
): GroupInfo {
	if (!container) {
		return { groupId, groupName: 'Unknown Group' };
	}

	let groupName = 'Unknown Group';
	let groupImageUrl: string | undefined;

	// Check what type of groups container we're working with
	const isBTRobloxContainer = container?.matches(BTROBLOX_GROUPS_SELECTORS.ITEM);

	const groupNameSelectors = {
		profile: isBTRobloxContainer
			? BTROBLOX_GROUPS_SELECTORS.GROUP_NAME
			: PROFILE_GROUPS_SHOWCASE_SELECTORS.GROUP_NAME,
		group: GROUP_HEADER_SELECTORS.GROUP_NAME
	};

	const groupImageSelectors = {
		profile: isBTRobloxContainer
			? BTROBLOX_GROUPS_SELECTORS.THUMBNAIL
			: PROFILE_GROUPS_SHOWCASE_SELECTORS.THUMBNAIL,
		group: GROUP_HEADER_SELECTORS.GROUP_IMAGE
	};

	// Extract group name
	if (pageType in groupNameSelectors) {
		const nameSelector = groupNameSelectors[pageType as keyof typeof groupNameSelectors];
		const nameEl = container.querySelector(nameSelector);
		if (nameEl) {
			const text = nameEl.textContent?.trim();
			if (text) groupName = text;
		}
	}

	// Extract group image URL
	if (pageType in groupImageSelectors) {
		const imageSelector = groupImageSelectors[pageType as keyof typeof groupImageSelectors];
		const imageEl = container.querySelector(imageSelector);
		if (imageEl instanceof HTMLImageElement && imageEl.src) {
			groupImageUrl = imageEl.src;
		}
	}

	return { groupId, groupName, groupImageUrl };
}
