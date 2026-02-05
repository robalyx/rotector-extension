import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { settings } from '../stores/settings';
import { SETTINGS_KEYS } from '../types/settings';
import {
	BLUR_SELECTORS,
	GROUPS_MODAL_SELECTORS,
	PAGE_TYPES,
	PROFILE_BLUR_GROUPS
} from '../types/constants';
import type { CombinedStatus } from '../types/custom-api';
import type { PageType } from '../types/api';
import { waitForElement } from '../utils/element-waiter';
import { startTrace, TRACE_CATEGORIES } from '../utils/perf-tracer';

type BlurContentType = 'displayName' | 'username' | 'description' | 'avatar';

const BLUR_STYLE_ID = 'rotector-blur-styles';
const PROFILE_REASON_KEY = 'User Profile';
const OUTFIT_REASON_KEY = 'Avatar Outfit';

const PROFILE_BLUR_CLASS_FLAGGED = 'rotector-profile-flagged';
const PROFILE_BLUR_CLASS_SAFE = 'rotector-profile-safe';

// Session-based sets for tracking manually revealed elements
const revealedUsers = new Set<string>();
const revealedGroups = new Set<string>();

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
	[PAGE_TYPES.MEMBERS]: {},
	[PAGE_TYPES.REPORT]: {},
	[PAGE_TYPES.GROUP_MEMBERS_CAROUSEL]: {
		displayName: BLUR_SELECTORS.MEMBER_CAROUSEL_DISPLAY_NAME,
		avatar: BLUR_SELECTORS.MEMBER_CAROUSEL_AVATAR
	},
	[PAGE_TYPES.GROUP_CONFIGURE_MEMBERS]: {
		displayName: BLUR_SELECTORS.CARD_DISPLAY_NAME,
		username: BLUR_SELECTORS.CARD_USERNAME,
		avatar: BLUR_SELECTORS.TILE_THUMBNAIL
	}
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
	[BLUR_SELECTORS.MEMBER_CAROUSEL_DISPLAY_NAME]: ['groups'],
	// Usernames
	[BLUR_SELECTORS.CARD_USERNAME]: ['friends', 'search'],
	[BLUR_SELECTORS.PROFILE_USERNAME]: ['profile'],
	// Descriptions
	[BLUR_SELECTORS.PROFILE_DESCRIPTION]: ['profile'],
	// Avatars
	[BLUR_SELECTORS.CAROUSEL_AVATAR]: ['home', 'profile'],
	[BLUR_SELECTORS.FRIENDS_LIST_AVATAR]: ['friends'],
	[BLUR_SELECTORS.SEARCH_AVATAR]: ['search'],
	[BLUR_SELECTORS.PROFILE_AVATAR]: ['profile'],
	[BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING]: ['profile'],
	[BLUR_SELECTORS.PROFILE_OUTFIT_2D]: ['profile'],
	[BLUR_SELECTORS.PROFILE_OUTFIT_3D]: ['profile'],
	[BLUR_SELECTORS.MEMBER_CAROUSEL_AVATAR]: ['groups'],
	// Reveal selectors
	[`${BLUR_SELECTORS.PROFILE_OUTFIT_2D}.blur-revealed`]: ['profile'],
	[`${BLUR_SELECTORS.PROFILE_OUTFIT_3D}.blur-revealed`]: ['profile'],
	[`${BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING}.blur-revealed`]: ['profile'],
	[`${BLUR_SELECTORS.FRIENDS_LIST_AVATAR}.blur-revealed`]: ['friends'],
	[`${BLUR_SELECTORS.SEARCH_AVATAR}.blur-revealed`]: ['search'],
	[`${BLUR_SELECTORS.MEMBER_CAROUSEL_AVATAR}.blur-revealed`]: ['groups']
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
	const bs = getBlurSettings();
	return bs.displayNames || bs.usernames || bs.descriptions || bs.avatars;
}

/**
 * Transform selector to reveal variant.
 * - Simple selectors: `.selector` → `.blur-revealed .selector` (ancestor has blur-revealed)
 * - Compound selectors: `.parent .child` → `.parent.blur-revealed .child` (parent has blur-revealed)
 */
function toRevealSelector(selector: string): string {
	const spaceIdx = selector.indexOf(' ');
	if (spaceIdx === -1) return `.blur-revealed ${selector}`;
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
				BLUR_SELECTORS.PROFILE_DISPLAY_NAME,
				BLUR_SELECTORS.MEMBER_CAROUSEL_DISPLAY_NAME
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
		otherTextSelectors.push(BLUR_SELECTORS.CARD_USERNAME, BLUR_SELECTORS.PROFILE_USERNAME);
	}
	if (bs.descriptions) {
		otherTextSelectors.push(BLUR_SELECTORS.PROFILE_DESCRIPTION);
	}
	addRule(
		otherTextSelectors,
		'filter: blur(4px) !important; clip-path: inset(0); user-select: none;'
	);
	if (bs.descriptions) {
		rules.push(
			`${BLUR_SELECTORS.PROFILE_DESCRIPTION}:not([data-blur-user-id]) { filter: none !important; user-select: auto; }`
		);
	}

	// Avatar blur
	if (bs.avatars) {
		addRule(
			[
				BLUR_SELECTORS.CAROUSEL_AVATAR,
				BLUR_SELECTORS.FRIENDS_LIST_AVATAR,
				BLUR_SELECTORS.SEARCH_AVATAR,
				BLUR_SELECTORS.PROFILE_AVATAR,
				BLUR_SELECTORS.MEMBER_CAROUSEL_AVATAR
			],
			'filter: blur(6px) !important; clip-path: circle(50%);'
		);
		addRule(
			[BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING],
			'filter: blur(6px) !important; clip-path: inset(0);'
		);
		rules.push(
			`html.${PROFILE_BLUR_CLASS_FLAGGED} ${BLUR_SELECTORS.PROFILE_OUTFIT_2D}, html.${PROFILE_BLUR_CLASS_FLAGGED} ${BLUR_SELECTORS.PROFILE_OUTFIT_3D} { filter: blur(12px) !important; }`
		);
		rules.push(
			`html.${PROFILE_BLUR_CLASS_SAFE} ${BLUR_SELECTORS.PROFILE_OUTFIT_2D}, html.${PROFILE_BLUR_CLASS_SAFE} ${BLUR_SELECTORS.PROFILE_OUTFIT_3D} { filter: none !important; }`
		);
		rules.push(`.avatar-card-label:not([data-blur-user-id]) { filter: none !important; }`);
	}

	// Reveal override
	rules.push(`.blur-revealed { filter: none !important; user-select: auto; }`);

	// Click-to-reveal cursor
	rules.push(`[${BLUR_SELECTORS.BLUR_USER_ID}] { cursor: pointer; }`);

	// Disable link overlays
	rules.push(
		`.avatar-container:has([${BLUR_SELECTORS.BLUR_USER_ID}]) > a { pointer-events: none; }`
	);

	// Tile-level text reveal
	const allTextSelectors: string[] = [];
	if (bs.displayNames) {
		allTextSelectors.push(
			BLUR_SELECTORS.CAROUSEL_DISPLAY_NAME,
			BLUR_SELECTORS.CARD_DISPLAY_NAME,
			BLUR_SELECTORS.SEARCH_DISPLAY_NAME,
			BLUR_SELECTORS.PROFILE_DISPLAY_NAME,
			BLUR_SELECTORS.MEMBER_CAROUSEL_DISPLAY_NAME
		);
	}
	allTextSelectors.push(...otherTextSelectors);
	const filteredText = filterByPage(allTextSelectors, ps);
	if (filteredText.length > 0) {
		const textReveal = filteredText.map(toRevealSelector);
		rules.push(`${textReveal.join(',')} { filter: none !important; user-select: auto; }`);
	}

	// Tile-level avatar reveal
	if (bs.avatars) {
		const avatarRevealSelectors = filterByPage(
			[
				BLUR_SELECTORS.CAROUSEL_AVATAR,
				BLUR_SELECTORS.FRIENDS_LIST_AVATAR,
				BLUR_SELECTORS.SEARCH_AVATAR,
				BLUR_SELECTORS.MEMBER_CAROUSEL_AVATAR
			],
			ps
		).map(toRevealSelector);

		// Profile-specific reveal selectors
		if (ps.profile) {
			avatarRevealSelectors.push(
				`.blur-revealed ${BLUR_SELECTORS.PROFILE_AVATAR}`,
				`.blur-revealed ${BLUR_SELECTORS.PROFILE_OUTFIT_2D}`,
				`.blur-revealed ${BLUR_SELECTORS.PROFILE_OUTFIT_3D}`,
				`.blur-revealed ${BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING}`,
				`${BLUR_SELECTORS.PROFILE_AVATAR}.blur-revealed`,
				'.thumbnail-holder .thumbnail-2d-container.blur-revealed',
				'.thumbnail-holder .thumbnail-3d-container.blur-revealed',
				'.profile-item-card .thumbnail-2d-container.blur-revealed'
			);
		}

		// Page-specific thumbnail reveal selectors
		const thumbnailRevealSelectors = filterByPage(
			[
				'.list-item.avatar-card .thumbnail-2d-container.blur-revealed',
				'li.player-item.avatar-card .thumbnail-2d-container.blur-revealed'
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
 * Set profile blur state on the root element.
 */
export function setProfileBlurState(state: 'flagged' | 'safe' | null): void {
	const root = document.documentElement;

	root.classList.remove(PROFILE_BLUR_CLASS_FLAGGED, PROFILE_BLUR_CLASS_SAFE);

	if (state === 'flagged') {
		root.classList.add(PROFILE_BLUR_CLASS_FLAGGED);
	} else if (state === 'safe') {
		root.classList.add(PROFILE_BLUR_CLASS_SAFE);
	}
}

/**
 * Clear profile blur state.
 */
export function clearProfileBlurState(): void {
	setProfileBlurState(null);
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
 * Reveal a single element
 */
function revealSingleElement(el: Element): void {
	if (el instanceof HTMLElement) {
		el.style.setProperty('filter', 'none', 'important');
		el.style.setProperty('user-select', 'auto', 'important');
		el.removeAttribute(BLUR_SELECTORS.BLUR_USER_ID);
		el.removeAttribute(BLUR_SELECTORS.BLUR_TYPE);
		el.removeAttribute(BLUR_SELECTORS.BLUR_GROUP);
		el.removeAttribute(BLUR_SELECTORS.BLUR_TITLE);
	}
}

/**
 * Mark a user as revealed for this session
 */
function revealUser(userId: string): void {
	revealedUsers.add(userId);

	const elements = document.querySelectorAll(`[${BLUR_SELECTORS.BLUR_USER_ID}="${userId}"]`);
	elements.forEach(revealSingleElement);
}

/**
 * Reveal all elements in a group
 */
function revealGroup(groupId: string): void {
	revealedGroups.add(groupId);

	const elements = document.querySelectorAll(`[${BLUR_SELECTORS.BLUR_GROUP}="${groupId}"]`);
	elements.forEach(revealSingleElement);
}

/**
 * Check if a group has been manually revealed this session
 */
function isGroupRevealed(groupId: string): boolean {
	return revealedGroups.has(groupId);
}

/**
 * Handle click on blurred element to reveal
 */
function handleBlurClick(event: Event): void {
	const target = event.currentTarget as HTMLElement;

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

/**
 * Mark an element as belonging to a user and add click-to-reveal handler
 */
function markElementForUser(
	element: HTMLElement,
	userId: string,
	contentType: BlurContentType,
	groupId?: string
): void {
	if (element.hasAttribute(BLUR_SELECTORS.BLUR_USER_ID)) return;
	if (groupId && isGroupRevealed(groupId)) return;

	element.setAttribute(BLUR_SELECTORS.BLUR_USER_ID, userId);
	element.setAttribute(BLUR_SELECTORS.BLUR_TYPE, contentType);
	if (groupId) {
		element.setAttribute(BLUR_SELECTORS.BLUR_GROUP, groupId);
	}
	element.setAttribute(BLUR_SELECTORS.BLUR_TITLE, get(_)('blur_tooltip'));
	element.addEventListener('click', handleBlurClick, { once: true });
}

/**
 * Mark element if selector matches within container.
 */
function markElement(
	container: Element | Document,
	selector: string | undefined,
	userId: string,
	type: BlurContentType,
	groupId?: string
): void {
	if (!selector) return;
	const el = container.querySelector(selector);
	if (el instanceof HTMLElement) markElementForUser(el, userId, type, groupId);
}

/**
 * Mark all elements matching selector within container.
 */
function markAllElements(
	container: Element | Document,
	selector: string | undefined,
	userId: string,
	type: BlurContentType,
	groupId?: string
): void {
	if (!selector) return;
	container.querySelectorAll(selector).forEach((el) => {
		if (el instanceof HTMLElement) markElementForUser(el, userId, type, groupId);
	});
}

/**
 * Mark elements within a user tile for blur tracking and click-to-reveal.
 */
export function markUserElementForBlur(element: Element, userId: string, pageType: PageType): void {
	if (!isBlurEnabled() || isUserRevealed(userId)) return;

	const endTrace = startTrace(TRACE_CATEGORIES.BLUR, 'markUserElementForBlur', {
		userId,
		pageType
	});
	const { displayNames, usernames, avatars } = getBlurSettings();

	const isModalItem = element.closest(GROUPS_MODAL_SELECTORS.MODAL) !== null;

	if (isModalItem) {
		if (displayNames) {
			markElement(element, GROUPS_MODAL_SELECTORS.DISPLAY_NAME, userId, 'displayName');
		}
		if (usernames) {
			markElement(element, GROUPS_MODAL_SELECTORS.USERNAME, userId, 'username');
		}
		if (avatars) {
			markElement(element, BLUR_SELECTORS.TILE_THUMBNAIL, userId, 'avatar');
		}
	} else {
		const sel = PAGE_SELECTORS[pageType];
		if (displayNames) {
			markElement(element, sel.displayName, userId, 'displayName');
		}
		if (usernames) markElement(element, sel.username, userId, 'username');
		if (avatars) markElement(element, sel.avatar, userId, 'avatar');
	}
	endTrace();
}

/**
 * Mark profile page elements for blur tracking and click-to-reveal.
 */
export function markProfileElementsForBlur(userId: string): void {
	if (!isBlurEnabled() || isUserRevealed(userId)) return;
	const { displayNames, usernames, descriptions, avatars } = getBlurSettings();

	// Group IDs for profile elements
	const headerGroup = `${PROFILE_BLUR_GROUPS.HEADER}:${userId}`;
	const outfitGroup = `${PROFILE_BLUR_GROUPS.OUTFIT}:${userId}`;

	// Header group: display name, username, description
	if (displayNames) {
		markAllElements(
			document,
			BLUR_SELECTORS.PROFILE_DISPLAY_NAME,
			userId,
			'displayName',
			headerGroup
		);
	}
	if (usernames) {
		markAllElements(document, BLUR_SELECTORS.PROFILE_USERNAME, userId, 'username', headerGroup);
	}
	if (descriptions) {
		markAllElements(
			document,
			BLUR_SELECTORS.PROFILE_DESCRIPTION,
			userId,
			'description',
			headerGroup
		);
	}

	// Outfit group: avatar images, outfit thumbnails, currently wearing items
	if (avatars) {
		markAllElements(document, BLUR_SELECTORS.PROFILE_AVATAR, userId, 'avatar', outfitGroup);
		markAllElements(document, BLUR_SELECTORS.PROFILE_OUTFIT_2D, userId, 'avatar', outfitGroup);
		markAllElements(document, BLUR_SELECTORS.PROFILE_OUTFIT_3D, userId, 'avatar', outfitGroup);
		void markCurrentlyWearingItems(userId, outfitGroup);
	}
}

/**
 * Mark currently wearing items for click-to-reveal.
 */
async function markCurrentlyWearingItems(userId: string, groupId: string): Promise<void> {
	// Wait for items to load
	const result = await waitForElement('.profile-item-card', {
		maxRetries: 10,
		baseDelay: 200,
		maxDelay: 1000
	});

	if (!result.success) return;
	if (isUserRevealed(userId)) return;
	if (isGroupRevealed(groupId)) return;

	const items = document.querySelectorAll(BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING);
	items.forEach((el) => {
		if (el instanceof HTMLElement) {
			markElementForUser(el, userId, 'avatar', groupId);
		}
	});
}

/**
 * Observe for all profile avatar and outfit elements.
 * Returns a cleanup function to disconnect the observer.
 */
export function observeProfileOutfitSwitch(userId: string): () => void {
	const outfitGroup = `${PROFILE_BLUR_GROUPS.OUTFIT}:${userId}`;

	const outfitSelectors = [
		BLUR_SELECTORS.PROFILE_AVATAR,
		BLUR_SELECTORS.PROFILE_OUTFIT_2D,
		BLUR_SELECTORS.PROFILE_OUTFIT_3D
	];

	const processElement = (el: HTMLElement) => {
		const alreadyRevealed = isUserRevealed(userId) || isGroupRevealed(outfitGroup);
		const isSafe = document.documentElement.classList.contains(PROFILE_BLUR_CLASS_SAFE);

		if (alreadyRevealed || isSafe) {
			revealSingleElement(el);
		} else {
			markElementForUser(el, userId, 'avatar', outfitGroup);
		}
	};

	for (const selector of outfitSelectors) {
		document.querySelectorAll(selector).forEach((el) => {
			if (el instanceof HTMLElement) {
				processElement(el);
			}
		});
	}

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (!(node instanceof HTMLElement)) continue;

				for (const selector of outfitSelectors) {
					if (node.matches(selector)) {
						processElement(node);
					}
					node.querySelectorAll(selector).forEach((el) => {
						if (el instanceof HTMLElement) {
							processElement(el);
						}
					});
				}
			}
		}
	});

	observer.observe(document.body, { childList: true, subtree: true });

	return () => {
		observer.disconnect();
	};
}

/**
 * Observe for description elements appearing.
 * Returns a cleanup function to disconnect the observer.
 */
export function observeProfileDescriptions(userId: string): () => void {
	const headerGroup = `${PROFILE_BLUR_GROUPS.HEADER}:${userId}`;

	const processElement = (el: HTMLElement) => {
		const alreadyRevealed = isUserRevealed(userId) || isGroupRevealed(headerGroup);

		if (alreadyRevealed) {
			revealSingleElement(el);
		} else {
			markElementForUser(el, userId, 'description', headerGroup);
		}
	};

	document.querySelectorAll('.description-content').forEach((el) => {
		if (el instanceof HTMLElement) {
			processElement(el);
		}
	});

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (!(node instanceof HTMLElement)) continue;

				if (node.classList.contains('description-content')) {
					processElement(node);
				}

				node.querySelectorAll('.description-content').forEach((el) => {
					if (el instanceof HTMLElement) {
						processElement(el);
					}
				});
			}
		}
	});

	observer.observe(document.body, { childList: true, subtree: true });

	return () => {
		observer.disconnect();
	};
}

/**
 * Observe for profile header elements appearing (display name, username).
 * Returns a cleanup function to disconnect the observer.
 */
export function observeProfileHeader(userId: string): () => void {
	const headerGroup = `${PROFILE_BLUR_GROUPS.HEADER}:${userId}`;
	const { displayNames, usernames } = getBlurSettings();

	const headerSelectors = [
		{
			selector: BLUR_SELECTORS.PROFILE_DISPLAY_NAME,
			type: 'displayName' as const,
			enabled: displayNames
		},
		{ selector: BLUR_SELECTORS.PROFILE_USERNAME, type: 'username' as const, enabled: usernames }
	].filter((s) => s.enabled);

	if (headerSelectors.length === 0) {
		return () => {};
	}

	const processElement = (el: HTMLElement, type: BlurContentType) => {
		const alreadyRevealed = isUserRevealed(userId) || isGroupRevealed(headerGroup);

		if (alreadyRevealed) {
			revealSingleElement(el);
		} else {
			markElementForUser(el, userId, type, headerGroup);
		}
	};

	for (const { selector, type } of headerSelectors) {
		document.querySelectorAll(selector).forEach((el) => {
			if (el instanceof HTMLElement) {
				processElement(el, type);
			}
		});
	}

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (!(node instanceof HTMLElement)) continue;

				for (const { selector, type } of headerSelectors) {
					if (node.matches(selector)) {
						processElement(node, type);
					}
					node.querySelectorAll(selector).forEach((el) => {
						if (el instanceof HTMLElement) {
							processElement(el, type);
						}
					});
				}
			}
		}
	});

	observer.observe(document.body, { childList: true, subtree: true });

	return () => {
		observer.disconnect();
	};
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
		el.removeAttribute(BLUR_SELECTORS.BLUR_GROUP);
		el.removeAttribute(BLUR_SELECTORS.BLUR_TITLE);
		if (el instanceof HTMLElement) {
			el.style.removeProperty('filter');
		}
	});
}

/**
 * Clean up blur-related attributes and classes from an element.
 */
function cleanupBlurElement(el: Element): void {
	el.removeAttribute(BLUR_SELECTORS.BLUR_USER_ID);
	el.removeAttribute(BLUR_SELECTORS.BLUR_TYPE);
	el.removeAttribute(BLUR_SELECTORS.BLUR_GROUP);
	el.removeAttribute(BLUR_SELECTORS.BLUR_TITLE);
}

/**
 * Reveal (unblur) user content based on reason types.
 */
export function revealUserElement(element: Element, status: CombinedStatus): void {
	const endTrace = startTrace(TRACE_CATEGORIES.BLUR, 'revealUserElement');
	const blurNames = hasReason(status, PROFILE_REASON_KEY);
	const blurAvatars = hasReason(status, OUTFIT_REASON_KEY);

	if (!blurNames && !blurAvatars) {
		element.classList.add('blur-revealed');
		element.querySelectorAll(`[${BLUR_SELECTORS.BLUR_USER_ID}]`).forEach(cleanupBlurElement);
		endTrace();
		return;
	}

	element.querySelectorAll(`[${BLUR_SELECTORS.BLUR_USER_ID}]`).forEach((el) => {
		const type = el.getAttribute(BLUR_SELECTORS.BLUR_TYPE);
		if (type === 'avatar' ? !blurAvatars : !blurNames) {
			el.classList.add('blur-revealed');
			cleanupBlurElement(el);
		}
	});
	endTrace();
}

/**
 * Reveal element via inline style.
 */
function revealElement(el: Element): void {
	if (el instanceof HTMLElement) {
		el.style.setProperty('filter', 'none', 'important');
		el.style.setProperty('user-select', 'auto', 'important');
	}
}

/**
 * Reveal element and clean up blur attributes.
 */
function revealAndCleanup(el: Element): void {
	revealElement(el);
	cleanupBlurElement(el);
}

/**
 * Reveal profile avatar elements after they finish loading.
 */
async function revealProfileAvatars(): Promise<void> {
	// Reveal all avatar elements and clean up blur attributes
	[
		BLUR_SELECTORS.PROFILE_AVATAR,
		BLUR_SELECTORS.PROFILE_OUTFIT_2D,
		BLUR_SELECTORS.PROFILE_OUTFIT_3D
	].forEach((sel) => {
		document.querySelectorAll(sel).forEach(revealAndCleanup);
	});

	// Wait for currently wearing items
	const result = await waitForElement('.profile-item-card', {
		maxRetries: 10,
		baseDelay: 200,
		maxDelay: 1000
	});
	if (result.success) {
		document.querySelectorAll(BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING).forEach(revealAndCleanup);
	}
}

/**
 * Reveal (unblur) profile page elements based on reason types.
 */
export function revealProfileElements(status: CombinedStatus): void {
	const blurNames = hasReason(status, PROFILE_REASON_KEY);
	const blurAvatars = hasReason(status, OUTFIT_REASON_KEY);

	if (!blurNames) {
		const textSelectors = [
			BLUR_SELECTORS.PROFILE_DISPLAY_NAME,
			BLUR_SELECTORS.PROFILE_USERNAME,
			BLUR_SELECTORS.PROFILE_DESCRIPTION
		];
		textSelectors.forEach((sel) => {
			document.querySelectorAll(sel).forEach(revealAndCleanup);
		});

		void waitForElement(BLUR_SELECTORS.PROFILE_DESCRIPTION, {
			maxRetries: 5,
			baseDelay: 200,
			maxDelay: 1000
		}).then((result) => {
			if (result.success) {
				document.querySelectorAll(BLUR_SELECTORS.PROFILE_DESCRIPTION).forEach(revealAndCleanup);
			}
		});
	}

	if (!blurAvatars) {
		void revealProfileAvatars();
	}
}
