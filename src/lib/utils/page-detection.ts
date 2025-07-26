import { PROFILE_SELECTORS, FRIENDS_SELECTORS, GROUPS_SELECTORS } from '../types/constants';

export interface UserInfo {
  userId: string;
  username: string;
  avatarUrl?: string;
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
    return { pageType: 'carousel', container: isCarouselTile };
  }
  if (isFriendsPage) {
    return { pageType: 'friends', container: isFriendsPage };
  }
  if (isGroupsPage) {
    return { pageType: 'groups', container: isGroupsPage };
  }
  if (isProfilePage) {
    return { pageType: 'profile', container: document.querySelector(PROFILE_SELECTORS.PROFILE_HEADER_MAIN) };
  }
  
  return { pageType: 'unknown', container: null };
}

// Extract user information based on page type and container
export function extractUserInfo(userId: string, pageType: string, container: Element | null): UserInfo {
  if (!container) {
    return { userId, username: 'Unknown User' };
  }

  let username = 'Unknown User';
  let avatarUrl: string | undefined;

  const usernameSelectors = {
    carousel: '[class*="username"], [class*="name"], [class*="display-name"], a[href*="/users/"] span, .text-overflow',
    friends: FRIENDS_SELECTORS.CARD.USERNAME,
    groups: GROUPS_SELECTORS.USERNAME,
    profile: PROFILE_SELECTORS.USERNAME
  };

  const avatarSelectors = {
    carousel: 'img[src*="rbxcdn"], img[src*="roblox"]',
    friends: FRIENDS_SELECTORS.CARD.AVATAR_IMG,
    groups: GROUPS_SELECTORS.AVATAR_IMG,
    profile: PROFILE_SELECTORS.AVATAR_IMG
  };

  // Extract username
  const usernameSelector = usernameSelectors[pageType as keyof typeof usernameSelectors];
  if (usernameSelector) {
    const usernameEl = container.querySelector(usernameSelector);
    if (usernameEl) {
      let text = usernameEl.textContent?.trim() || '';
      if (text.startsWith('@')) text = text.substring(1);
      if (text) username = text;
    }
  }

  // Extract avatar URL
  const avatarSelector = avatarSelectors[pageType as keyof typeof avatarSelectors];
  if (avatarSelector) {
    const avatarEl = container.querySelector(avatarSelector) as HTMLImageElement;
    if (avatarEl?.src) {
      avatarUrl = avatarEl.src;
    }
  }

  return { userId, username, avatarUrl };
}