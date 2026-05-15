import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { settings } from '../../stores/settings';
import { SETTINGS_KEYS } from '../../types/settings';
import { BLUR_SELECTORS } from './selectors';
import type { UserStatus } from '../../types/api';
import type { CombinedStatus } from '../../types/custom-api';

export type BlurContentType = 'displayName' | 'username' | 'description' | 'avatar';

interface BlurSettings {
	displayNames: boolean;
	usernames: boolean;
	descriptions: boolean;
	avatars: boolean;
}

export interface PageSettings {
	profile: boolean;
	home: boolean;
	friends: boolean;
	groups: boolean;
	search: boolean;
}

export type PageKey = keyof PageSettings;

export const BLUR_REVEALED_CLASS = 'blur-revealed';
export const PROFILE_BLUR_CLASS_FLAGGED = 'rotector-profile-flagged';
export const PROFILE_BLUR_CLASS_SAFE = 'rotector-profile-safe';
export const PROFILE_TEXT_BLUR_CLASS_FLAGGED = 'rotector-profile-text-flagged';
export const PROFILE_TEXT_BLUR_CLASS_SAFE = 'rotector-profile-text-safe';

// Session-based sets for tracking manually revealed elements where both tile and
// profile blur read these to skip already-revealed targets
export const revealedUsers = new Set<string>();
export const revealedGroups = new Set<string>();

export function getBlurSettings(): BlurSettings {
	const s = get(settings);
	return {
		displayNames: s[SETTINGS_KEYS.BLUR_DISPLAY_NAMES],
		usernames: s[SETTINGS_KEYS.BLUR_USERNAMES],
		descriptions: s[SETTINGS_KEYS.BLUR_DESCRIPTIONS],
		avatars: s[SETTINGS_KEYS.BLUR_AVATARS]
	};
}

export function getAllSettings(): { blur: BlurSettings; page: PageSettings } {
	const s = get(settings);
	return {
		blur: {
			displayNames: s[SETTINGS_KEYS.BLUR_DISPLAY_NAMES],
			usernames: s[SETTINGS_KEYS.BLUR_USERNAMES],
			descriptions: s[SETTINGS_KEYS.BLUR_DESCRIPTIONS],
			avatars: s[SETTINGS_KEYS.BLUR_AVATARS]
		},
		page: {
			profile: s[SETTINGS_KEYS.PROFILE_CHECK_ENABLED],
			home: s[SETTINGS_KEYS.HOME_CHECK_ENABLED],
			friends: s[SETTINGS_KEYS.FRIENDS_CHECK_ENABLED],
			groups: s[SETTINGS_KEYS.GROUPS_CHECK_ENABLED],
			search: s[SETTINGS_KEYS.SEARCH_CHECK_ENABLED]
		}
	};
}

export function isBlurEnabled(): boolean {
	const bs = getBlurSettings();
	return bs.displayNames || bs.usernames || bs.descriptions || bs.avatars;
}

export function revealSingleElement(el: Element): void {
	if (el instanceof HTMLElement) {
		el.style.setProperty('filter', 'none', 'important');
		el.style.setProperty('user-select', 'auto', 'important');
		el.removeAttribute(BLUR_SELECTORS.BLUR_USER_ID);
		el.removeAttribute(BLUR_SELECTORS.BLUR_TYPE);
		el.removeAttribute(BLUR_SELECTORS.BLUR_GROUP);
		el.removeAttribute(BLUR_SELECTORS.BLUR_TITLE);
	}
}

function revealUser(userId: string): void {
	revealedUsers.add(userId);
	document
		.querySelectorAll(`[${BLUR_SELECTORS.BLUR_USER_ID}="${userId}"]`)
		.forEach(revealSingleElement);
}

function revealGroup(groupId: string): void {
	revealedGroups.add(groupId);
	document
		.querySelectorAll(`[${BLUR_SELECTORS.BLUR_GROUP}="${groupId}"]`)
		.forEach(revealSingleElement);
}

function handleBlurClick(event: Event): void {
	const target = event.currentTarget;
	if (!(target instanceof HTMLElement)) return;

	const groupId = target.getAttribute(BLUR_SELECTORS.BLUR_GROUP);
	if (groupId) {
		event.preventDefault();
		event.stopPropagation();
		revealGroup(groupId);
		return;
	}

	const userId = target.getAttribute(BLUR_SELECTORS.BLUR_USER_ID);
	if (userId) {
		event.preventDefault();
		event.stopPropagation();
		revealUser(userId);
	}
}

export function markElementForUser(
	element: HTMLElement,
	userId: string,
	contentType: BlurContentType,
	groupId?: string
): void {
	if (element.hasAttribute(BLUR_SELECTORS.BLUR_USER_ID)) return;
	if (groupId && revealedGroups.has(groupId)) return;

	element.setAttribute(BLUR_SELECTORS.BLUR_USER_ID, userId);
	element.setAttribute(BLUR_SELECTORS.BLUR_TYPE, contentType);
	if (groupId) {
		element.setAttribute(BLUR_SELECTORS.BLUR_GROUP, groupId);
	}
	element.setAttribute(BLUR_SELECTORS.BLUR_TITLE, get(_)('blur_tooltip'));
	element.addEventListener('click', handleBlurClick, { once: true });
}

export function markAllElements(
	container: Element | Document,
	selector: string | undefined,
	userId: string,
	type: BlurContentType,
	groupId?: string
): void {
	if (!selector) return;
	for (const el of container.querySelectorAll(selector)) {
		if (el instanceof HTMLElement) markElementForUser(el, userId, type, groupId);
	}
}

export function cleanupBlurElement(el: Element): void {
	el.removeEventListener('click', handleBlurClick);
	el.removeAttribute(BLUR_SELECTORS.BLUR_USER_ID);
	el.removeAttribute(BLUR_SELECTORS.BLUR_TYPE);
	el.removeAttribute(BLUR_SELECTORS.BLUR_GROUP);
	el.removeAttribute(BLUR_SELECTORS.BLUR_TITLE);
}

export function revealAndCleanup(el: Element): void {
	if (el instanceof HTMLElement) {
		el.style.setProperty('filter', 'none', 'important');
		el.style.setProperty('user-select', 'auto', 'important');
	}
	cleanupBlurElement(el);
}

// Returns true if any API entry has a matching reason (or is still loading)
// Used by both tile and profile reveal to decide whether to keep blur on
export function hasReason(status: CombinedStatus<UserStatus> | null, reasonKey: string): boolean {
	if (!status) return true;
	for (const result of status.values()) {
		if (result.loading) return true;
		if (result.data?.reasons && reasonKey in result.data.reasons) return true;
	}
	return false;
}
