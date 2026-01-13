import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { settings } from '../stores/settings';
import { SETTINGS_KEYS } from '../types/settings';
import { BLUR_SELECTORS, PAGE_TYPES } from '../types/constants';
import type { CombinedStatus } from '../types/custom-api';
import type { PageType } from '../types/api';
import { waitForElement } from '../utils/element-waiter';

type BlurContentType = 'displayName' | 'username' | 'description' | 'avatar';

const BLUR_STYLE_ID = 'rotector-blur-styles';
const PROFILE_REASON_KEY = 'User Profile';
const OUTFIT_REASON_KEY = 'Avatar Outfit';

// Session-based set of revealed user IDs
const revealedUsers = new Set<string>();

// Selector lookup table by page type
const PAGE_SELECTORS: Record<
	PageType,
	{ displayName?: string; username?: string; avatar?: string }
> = {
	[PAGE_TYPES.FRIENDS_CAROUSEL]: {
		displayName: BLUR_SELECTORS.CAROUSEL_DISPLAY_NAME,
		avatar: BLUR_SELECTORS.TILE_CAROUSEL_AVATAR
	},
	[PAGE_TYPES.HOME]: {
		displayName: BLUR_SELECTORS.CAROUSEL_DISPLAY_NAME,
		avatar: BLUR_SELECTORS.TILE_CAROUSEL_AVATAR
	},
	[PAGE_TYPES.PROFILE]: {
		displayName: BLUR_SELECTORS.CAROUSEL_DISPLAY_NAME,
		avatar: BLUR_SELECTORS.TILE_CAROUSEL_AVATAR
	},
	[PAGE_TYPES.FRIENDS_LIST]: {
		displayName: BLUR_SELECTORS.CARD_DISPLAY_NAME,
		username: BLUR_SELECTORS.CARD_USERNAME,
		avatar: BLUR_SELECTORS.TILE_THUMBNAIL
	},
	[PAGE_TYPES.SEARCH_USER]: {
		displayName: BLUR_SELECTORS.SEARCH_DISPLAY_NAME,
		username: BLUR_SELECTORS.CARD_USERNAME,
		avatar: BLUR_SELECTORS.TILE_THUMBNAIL
	},
	[PAGE_TYPES.MEMBERS]: {
		username: BLUR_SELECTORS.MEMBER_USERNAME,
		avatar: BLUR_SELECTORS.TILE_THUMBNAIL
	},
	[PAGE_TYPES.REPORT]: {}
};

interface BlurSettings {
	displayNames: boolean;
	usernames: boolean;
	descriptions: boolean;
	avatars: boolean;
}

interface PageSettings {
	profile: boolean;
	home: boolean;
	friends: boolean;
	groups: boolean;
	search: boolean;
}

type PageKey = keyof PageSettings;

// Maps each selector to the page(s) it applies to
const SELECTOR_PAGES: Record<string, PageKey[]> = {
	// Display names
	[BLUR_SELECTORS.CAROUSEL_DISPLAY_NAME]: ['home', 'profile'],
	[BLUR_SELECTORS.CARD_DISPLAY_NAME]: ['friends'],
	[BLUR_SELECTORS.SEARCH_DISPLAY_NAME]: ['search'],
	[BLUR_SELECTORS.PROFILE_DISPLAY_NAME]: ['profile'],
	// Usernames
	[BLUR_SELECTORS.CARD_USERNAME]: ['friends', 'search'],
	[BLUR_SELECTORS.MEMBER_USERNAME]: ['groups'],
	[BLUR_SELECTORS.PROFILE_USERNAME]: ['profile'],
	// Descriptions
	[BLUR_SELECTORS.PROFILE_DESCRIPTION]: ['profile'],
	// Avatars
	[BLUR_SELECTORS.CAROUSEL_AVATAR]: ['home', 'profile'],
	[BLUR_SELECTORS.FRIENDS_LIST_AVATAR]: ['friends'],
	[BLUR_SELECTORS.SEARCH_AVATAR]: ['search'],
	[BLUR_SELECTORS.MEMBERS_AVATAR]: ['groups'],
	[BLUR_SELECTORS.PROFILE_AVATAR]: ['profile'],
	[BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING]: ['profile'],
	[BLUR_SELECTORS.PROFILE_OUTFIT_RENDERER]: ['profile'],
	// Reveal selectors
	[`${BLUR_SELECTORS.PROFILE_OUTFIT_RENDERER}.blur-revealed`]: ['profile'],
	[`${BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING}.blur-revealed`]: ['profile'],
	[`${BLUR_SELECTORS.FRIENDS_LIST_AVATAR}.blur-revealed`]: ['friends'],
	[`${BLUR_SELECTORS.SEARCH_AVATAR}.blur-revealed`]: ['search'],
	[`${BLUR_SELECTORS.MEMBERS_AVATAR}.blur-revealed`]: ['groups']
};

/**
 * Filter selectors to only include those for enabled pages.
 */
function filterByPage(selectors: string[], ps: PageSettings): string[] {
	return selectors.filter((sel) => {
		const pages = SELECTOR_PAGES[sel];
		return pages?.some((page) => ps[page]);
	});
}

/**
 * Get current blur settings from the settings store.
 */
function getBlurSettings(): BlurSettings {
	const s = get(settings);
	return {
		displayNames: s[SETTINGS_KEYS.BLUR_DISPLAY_NAMES],
		usernames: s[SETTINGS_KEYS.BLUR_USERNAMES],
		descriptions: s[SETTINGS_KEYS.BLUR_DESCRIPTIONS],
		avatars: s[SETTINGS_KEYS.BLUR_AVATARS]
	};
}

/**
 * Get current page settings from the settings store.
 */
function getPageSettings(): PageSettings {
	const s = get(settings);
	return {
		profile: s[SETTINGS_KEYS.PROFILE_CHECK_ENABLED],
		home: s[SETTINGS_KEYS.HOME_CHECK_ENABLED],
		friends: s[SETTINGS_KEYS.FRIENDS_CHECK_ENABLED],
		groups: s[SETTINGS_KEYS.GROUPS_CHECK_ENABLED],
		search: s[SETTINGS_KEYS.SEARCH_CHECK_ENABLED]
	};
}

/**
 * Check if any blur setting is enabled.
 */
function isBlurEnabled(): boolean {
	const s = get(settings);
	if (!s[SETTINGS_KEYS.EXPERIMENTAL_BLUR_ENABLED]) {
		return false;
	}
	const bs = getBlurSettings();
	return bs.displayNames || bs.usernames || bs.descriptions || bs.avatars;
}

/**
 * Transform selector to reveal variant.
 */
function toRevealSelector(selector: string): string {
	const spaceIdx = selector.indexOf(' ');
	if (spaceIdx === -1) return `${selector}.blur-revealed`;
	return `${selector.slice(0, spaceIdx)}.blur-revealed${selector.slice(spaceIdx)}`;
}

/**
 * Build CSS rules for blur.
 */
function buildBlurCSS(allEnabled = false): string {
	const bs = allEnabled
		? { displayNames: true, usernames: true, descriptions: true, avatars: true }
		: getBlurSettings();
	const ps = allEnabled
		? { profile: true, home: true, friends: true, groups: true, search: true }
		: getPageSettings();
	const rules: string[] = [];

	// Helper to add rule if selectors exist after filtering
	const addRule = (selectors: string[], css: string) => {
		const filtered = filterByPage(selectors, ps);
		if (filtered.length > 0) {
			rules.push(`${filtered.join(',')} { ${css} }`);
		}
	};

	// Display name blur
	if (bs.displayNames) {
		addRule(
			[
				BLUR_SELECTORS.CAROUSEL_DISPLAY_NAME,
				BLUR_SELECTORS.CARD_DISPLAY_NAME,
				BLUR_SELECTORS.SEARCH_DISPLAY_NAME,
				BLUR_SELECTORS.PROFILE_DISPLAY_NAME
			],
			'filter: blur(6px) !important; clip-path: inset(0); user-select: none;'
		);
		rules.push(
			`.friends-carousel-display-name:not([data-blur-user-id]) { filter: none !important; user-select: auto; }`
		);
	}

	// Username/description blur
	const otherTextSelectors: string[] = [];
	if (bs.usernames) {
		otherTextSelectors.push(
			BLUR_SELECTORS.CARD_USERNAME,
			BLUR_SELECTORS.MEMBER_USERNAME,
			BLUR_SELECTORS.PROFILE_USERNAME
		);
	}
	if (bs.descriptions) {
		otherTextSelectors.push(BLUR_SELECTORS.PROFILE_DESCRIPTION);
	}
	addRule(
		otherTextSelectors,
		'filter: blur(4px) !important; clip-path: inset(0); user-select: none;'
	);

	// Avatar blur
	if (bs.avatars) {
		addRule(
			[
				BLUR_SELECTORS.CAROUSEL_AVATAR,
				BLUR_SELECTORS.FRIENDS_LIST_AVATAR,
				BLUR_SELECTORS.SEARCH_AVATAR,
				BLUR_SELECTORS.MEMBERS_AVATAR,
				BLUR_SELECTORS.PROFILE_AVATAR
			],
			'filter: blur(6px) !important; clip-path: circle(50%);'
		);
		addRule(
			[BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING],
			'filter: blur(6px) !important; clip-path: inset(0);'
		);
		addRule([BLUR_SELECTORS.PROFILE_OUTFIT_RENDERER], 'filter: blur(12px) !important;');
		rules.push(`.avatar-card-label:not([data-blur-user-id]) { filter: none !important; }`);
	}

	// Reveal override
	rules.push(`.blur-revealed { filter: none !important; user-select: auto; }`);

	// Disable link overlays
	rules.push(`.avatar-container:has(.blur-clickable) > a { pointer-events: none; }`);

	// Tile-level text reveal
	const allTextSelectors: string[] = [];
	if (bs.displayNames) {
		allTextSelectors.push(
			BLUR_SELECTORS.CAROUSEL_DISPLAY_NAME,
			BLUR_SELECTORS.CARD_DISPLAY_NAME,
			BLUR_SELECTORS.SEARCH_DISPLAY_NAME,
			BLUR_SELECTORS.PROFILE_DISPLAY_NAME
		);
	}
	allTextSelectors.push(...otherTextSelectors);
	const filteredText = filterByPage(allTextSelectors, ps);
	if (filteredText.length > 0) {
		const textReveal = filteredText.map((s) => `.blur-revealed ${s}`);
		rules.push(`${textReveal.join(',')} { filter: none !important; user-select: auto; }`);
	}

	// Tile-level avatar reveal
	if (bs.avatars) {
		const avatarRevealSelectors = filterByPage(
			[
				BLUR_SELECTORS.CAROUSEL_AVATAR,
				BLUR_SELECTORS.FRIENDS_LIST_AVATAR,
				BLUR_SELECTORS.SEARCH_AVATAR,
				BLUR_SELECTORS.MEMBERS_AVATAR
			],
			ps
		).map(toRevealSelector);

		// Profile-specific reveal selectors
		if (ps.profile) {
			avatarRevealSelectors.push(
				`.blur-revealed ${BLUR_SELECTORS.PROFILE_AVATAR}`,
				`.blur-revealed ${BLUR_SELECTORS.PROFILE_OUTFIT_RENDERER}`,
				`.blur-revealed ${BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING}`,
				`${BLUR_SELECTORS.PROFILE_AVATAR}.blur-revealed`,
				'.thumbnail-holder .thumbnail-2d-container.blur-revealed',
				'.profile-item-card .thumbnail-2d-container.blur-revealed'
			);
		}

		// Page-specific thumbnail reveal selectors
		const thumbnailRevealSelectors = filterByPage(
			[
				'.list-item.avatar-card .thumbnail-2d-container.blur-revealed',
				'li.player-item.avatar-card .thumbnail-2d-container.blur-revealed',
				'.list-item.member .thumbnail-2d-container.blur-revealed'
			],
			ps
		);
		avatarRevealSelectors.push(...thumbnailRevealSelectors);

		if (avatarRevealSelectors.length > 0) {
			rules.push(`${avatarRevealSelectors.join(',')} { filter: none !important; }`);
		}
	}

	return rules.join('\n');
}

/**
 * Get existing blur style element or create a new one.
 */
function getOrCreateStyleElement(): HTMLStyleElement {
	let el = document.getElementById(BLUR_STYLE_ID) as HTMLStyleElement | null;
	if (!el) {
		el = document.createElement('style');
		el.id = BLUR_STYLE_ID;
		(document.head || document.documentElement).appendChild(el);
	}
	return el;
}

/**
 * Inject blur CSS based on current settings.
 */
export function injectBlurStyles(): void {
	if (!isBlurEnabled()) {
		document.getElementById(BLUR_STYLE_ID)?.remove();
		return;
	}
	getOrCreateStyleElement().textContent = buildBlurCSS();
}

/**
 * Inject default blur CSS before settings load.
 */
export function injectDefaultBlurStyles(): void {
	getOrCreateStyleElement().textContent = buildBlurCSS(true);
}

/**
 * Check if user has a specific reason type. Returns true if should blur.
 */
function hasReason(status: CombinedStatus | null, reasonKey: string): boolean {
	if (!status) return true;
	for (const result of status.customApis.values()) {
		if (result.loading) return true;
		if (result.data?.reasons && reasonKey in result.data.reasons) return true;
	}
	return false;
}

/**
 * Check if a user has been manually revealed this session
 */
function isUserRevealed(userId: string): boolean {
	return revealedUsers.has(userId);
}

/**
 * Mark a user as revealed for this session
 */
function revealUser(userId: string): void {
	revealedUsers.add(userId);

	const elements = document.querySelectorAll(`[${BLUR_SELECTORS.BLUR_USER_ID}="${userId}"]`);
	elements.forEach((el) => {
		if (el instanceof HTMLElement) {
			el.style.setProperty('filter', 'none', 'important');
			el.style.setProperty('user-select', 'auto', 'important');
			el.classList.remove('blur-clickable');
			el.removeAttribute('title');
		}
	});
}

/**
 * Handle click on blurred element to reveal
 */
function handleBlurClick(event: Event): void {
	const target = event.currentTarget as HTMLElement;
	const userId = target.getAttribute(BLUR_SELECTORS.BLUR_USER_ID);
	if (userId) {
		event.preventDefault();
		event.stopPropagation();
		revealUser(userId);
	}
}

/**
 * Mark an element as belonging to a user and add click-to-reveal handler
 */
function markElementForUser(
	element: HTMLElement,
	userId: string,
	contentType: BlurContentType
): void {
	element.setAttribute(BLUR_SELECTORS.BLUR_USER_ID, userId);
	element.setAttribute(BLUR_SELECTORS.BLUR_TYPE, contentType);
	element.setAttribute('title', get(_)('blur_tooltip'));
	element.classList.add('blur-clickable');
	element.addEventListener('click', handleBlurClick, { once: true });
}

/**
 * Mark element if selector matches within container.
 */
function markElement(
	container: Element | Document,
	selector: string | undefined,
	userId: string,
	type: BlurContentType
): void {
	if (!selector) return;
	const el = container.querySelector(selector);
	if (el instanceof HTMLElement) markElementForUser(el, userId, type);
}

/**
 * Mark elements within a user tile for blur tracking and click-to-reveal.
 */
export function markUserElementForBlur(element: Element, userId: string, pageType: PageType): void {
	if (!isBlurEnabled() || isUserRevealed(userId)) return;
	const { displayNames, usernames, avatars } = getBlurSettings();
	const sel = PAGE_SELECTORS[pageType];
	if (displayNames) {
		markElement(element, sel.displayName, userId, 'displayName');
	}
	if (usernames) markElement(element, sel.username, userId, 'username');
	if (avatars) markElement(element, sel.avatar, userId, 'avatar');
}

/**
 * Mark profile page elements for blur tracking and click-to-reveal.
 */
export function markProfileElementsForBlur(userId: string): void {
	if (!isBlurEnabled() || isUserRevealed(userId)) return;
	const { displayNames, usernames, descriptions, avatars } = getBlurSettings();

	if (displayNames) {
		markElement(document, BLUR_SELECTORS.PROFILE_DISPLAY_NAME, userId, 'displayName');
	}
	if (usernames) {
		markElement(document, BLUR_SELECTORS.PROFILE_USERNAME, userId, 'username');
	}
	if (descriptions) {
		markElement(document, BLUR_SELECTORS.PROFILE_DESCRIPTION, userId, 'description');
	}
	if (avatars) {
		markElement(document, BLUR_SELECTORS.PROFILE_AVATAR, userId, 'avatar');
		markElement(document, BLUR_SELECTORS.PROFILE_OUTFIT_RENDERER, userId, 'avatar');
		void markCurrentlyWearingItems(userId);
	}
}

/**
 * Mark currently wearing items for click-to-reveal.
 */
async function markCurrentlyWearingItems(userId: string): Promise<void> {
	// Wait for items to load
	const result = await waitForElement('.profile-item-card', {
		maxRetries: 10,
		baseDelay: 200,
		maxDelay: 1000
	});

	if (!result.success) return;
	if (isUserRevealed(userId)) return;

	const items = document.querySelectorAll(BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING);
	items.forEach((el) => {
		if (el instanceof HTMLElement) {
			markElementForUser(el, userId, 'avatar');
		}
	});
}

/**
 * Reset blur state on an element.
 */
export function resetElementBlur(element: Element): void {
	element.classList.remove('blur-revealed');
	element.querySelectorAll(`[${BLUR_SELECTORS.BLUR_USER_ID}]`).forEach((el) => {
		el.classList.remove('blur-revealed');
		el.removeAttribute(BLUR_SELECTORS.BLUR_USER_ID);
		el.removeAttribute(BLUR_SELECTORS.BLUR_TYPE);
		el.classList.remove('blur-clickable');
		if (el instanceof HTMLElement) {
			el.style.removeProperty('filter');
		}
	});
}

/**
 * Clean up blur-related attributes and classes from an element.
 */
function cleanupBlurElement(el: Element): void {
	el.classList.remove('blur-clickable');
	el.removeAttribute(BLUR_SELECTORS.BLUR_USER_ID);
	el.removeAttribute(BLUR_SELECTORS.BLUR_TYPE);
	el.removeAttribute('title');
}

/**
 * Reveal (unblur) user content based on reason types.
 */
export function revealUserElement(element: Element, status: CombinedStatus): void {
	const blurNames = hasReason(status, PROFILE_REASON_KEY);
	const blurAvatars = hasReason(status, OUTFIT_REASON_KEY);

	if (!blurNames && !blurAvatars) {
		element.classList.add('blur-revealed');
		element.querySelectorAll(`[${BLUR_SELECTORS.BLUR_USER_ID}]`).forEach(cleanupBlurElement);
		return;
	}

	element.querySelectorAll(`[${BLUR_SELECTORS.BLUR_USER_ID}]`).forEach((el) => {
		const type = el.getAttribute(BLUR_SELECTORS.BLUR_TYPE);
		if (type === 'avatar' ? !blurAvatars : !blurNames) {
			el.classList.add('blur-revealed');
			cleanupBlurElement(el);
		}
	});
}

/**
 * Reveal element via inline style.
 */
function revealElement(el: Element): void {
	if (el instanceof HTMLElement) {
		el.style.setProperty('filter', 'none', 'important');
	}
}

/**
 * Reveal profile avatar elements after they finish loading.
 */
async function revealProfileAvatars(): Promise<void> {
	// Reveal immediate avatar elements
	[BLUR_SELECTORS.PROFILE_AVATAR, BLUR_SELECTORS.PROFILE_OUTFIT_RENDERER].forEach((sel) => {
		const el = document.querySelector(sel);
		if (el) revealElement(el);
	});

	// Wait for currently wearing items
	const result = await waitForElement('.profile-item-card', {
		maxRetries: 10,
		baseDelay: 200,
		maxDelay: 1000
	});
	if (result.success) {
		document.querySelectorAll(BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING).forEach(revealElement);
	}
}

/**
 * Reveal (unblur) profile page elements based on reason types.
 */
export function revealProfileElements(status: CombinedStatus): void {
	const blurNames = hasReason(status, PROFILE_REASON_KEY);
	const blurAvatars = hasReason(status, OUTFIT_REASON_KEY);

	if (!blurNames) {
		[
			BLUR_SELECTORS.PROFILE_DISPLAY_NAME,
			BLUR_SELECTORS.PROFILE_USERNAME,
			BLUR_SELECTORS.PROFILE_DESCRIPTION
		].forEach((sel) => {
			const el = document.querySelector(sel);
			if (el) revealElement(el);
		});
	}

	if (!blurAvatars) {
		void revealProfileAvatars();
	}
}
