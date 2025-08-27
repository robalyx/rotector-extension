import {FRIENDS_CAROUSEL_SELECTORS, FRIENDS_SELECTORS, GROUPS_SELECTORS, PROFILE_SELECTORS, GROUP_HEADER_SELECTORS} from '../types/constants';

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
    pageType: 'carousel' | 'friends' | 'groups' | 'profile' | 'unknown';
    container: Element | null;
}

// Detect the page type and container from an anchor element
export function detectPageContext(anchorElement: HTMLElement): PageDetectionResult {
    const isCarouselTile = anchorElement.closest('.friends-carousel-tile');
    const isFriendsPage = anchorElement.closest('.avatar-card');
    const isGroupsPage = anchorElement.closest('.member');
    const isProfilePage = window.location.pathname.includes('/users/');

    if (isCarouselTile) {
        return {pageType: 'carousel', container: isCarouselTile};
    }
    if (isFriendsPage) {
        return {pageType: 'friends', container: isFriendsPage};
    }
    if (isGroupsPage) {
        return {pageType: 'groups', container: isGroupsPage};
    }
    if (isProfilePage) {
        return {pageType: 'profile', container: document.querySelector(PROFILE_SELECTORS.PROFILE_HEADER_MAIN)};
    }

    return {pageType: 'unknown', container: null};
}

// Extract user information based on page type and container
export function extractUserInfo(userId: string, pageType: string, container: Element | null): UserInfo {
    if (!container) {
        return {userId, username: 'Unknown User'};
    }

    let username = 'Unknown User';
    let avatarUrl: string | undefined;

    const usernameSelectors = {
        carousel: FRIENDS_CAROUSEL_SELECTORS.DISPLAY_NAME,
        friends: FRIENDS_SELECTORS.CARD.USERNAME,
        groups: GROUPS_SELECTORS.USERNAME,
        profile: PROFILE_SELECTORS.USERNAME
    };

    const avatarSelectors = {
        carousel: FRIENDS_CAROUSEL_SELECTORS.AVATAR_IMG,
        friends: FRIENDS_SELECTORS.CARD.AVATAR_IMG,
        groups: GROUPS_SELECTORS.AVATAR_IMG,
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

    return {userId, username, avatarUrl};
}

// Extract group information from the page DOM
export function extractGroupInfo(groupId: string): GroupInfo {
    let groupName = 'Unknown Group';
    let groupImageUrl: string | undefined;

    // Try to extract group name from the header
    const groupNameEl = document.querySelector(GROUP_HEADER_SELECTORS.GROUP_NAME);
    if (groupNameEl) {
        const text = groupNameEl.textContent?.trim();
        if (text) {
            groupName = text;
        }
    }

    // Try to extract group image from the header
    const headerInfo = document.querySelector(GROUP_HEADER_SELECTORS.HEADER_INFO);
    if (headerInfo) {
        const avatarImg = headerInfo.querySelector(GROUP_HEADER_SELECTORS.GROUP_IMAGE);
        if (avatarImg instanceof HTMLImageElement && avatarImg.src) {
            groupImageUrl = avatarImg.src;
        }
    }

    return {groupId, groupName, groupImageUrl};
}

