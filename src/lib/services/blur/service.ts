import { PAGE_TYPES, REASON_KEYS } from '../../types/constants';
import { BLUR_SELECTORS } from './selectors';
import { GROUPS_MODAL_SELECTORS } from '../../controllers/selectors/groups';
import type { PageType, UserStatus } from '../../types/api';
import type { CombinedStatus } from '../../types/custom-api';
import { startTrace } from '../../utils/logging/perf-tracer';
import { TRACE_CATEGORIES } from '../../types/performance';
import {
	BLUR_REVEALED_CLASS,
	cleanupBlurElement,
	getAllSettings,
	getBlurSettings,
	hasReason,
	isBlurEnabled,
	markAllElements,
	PROFILE_BLUR_CLASS_FLAGGED,
	PROFILE_BLUR_CLASS_SAFE,
	revealedUsers,
	type PageKey,
	type PageSettings
} from './internals';

const BLUR_STYLE_ID = 'rotector-blur-styles';

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
		displayName: BLUR_SELECTORS.GROUP_CONFIGURE_DISPLAY_NAME,
		username: BLUR_SELECTORS.GROUP_CONFIGURE_USERNAME,
		avatar: BLUR_SELECTORS.GROUP_CONFIGURE_AVATAR
	}
};

const SELECTOR_PAGES: Record<string, PageKey[]> = {
	// Display names
	[BLUR_SELECTORS.CAROUSEL_DISPLAY_NAME]: ['home', 'profile'],
	[BLUR_SELECTORS.CARD_DISPLAY_NAME]: ['friends'],
	[BLUR_SELECTORS.SEARCH_DISPLAY_NAME]: ['search'],
	[BLUR_SELECTORS.PROFILE_DISPLAY_NAME]: ['profile'],
	[BLUR_SELECTORS.MEMBER_CAROUSEL_DISPLAY_NAME]: ['groups'],
	[BLUR_SELECTORS.GROUP_CONFIGURE_DISPLAY_NAME]: ['groups'],
	// Usernames
	[BLUR_SELECTORS.CARD_USERNAME]: ['friends', 'search'],
	[BLUR_SELECTORS.GROUP_CONFIGURE_USERNAME]: ['groups'],
	[BLUR_SELECTORS.PROFILE_USERNAME]: ['profile'],
	// Descriptions
	[BLUR_SELECTORS.PROFILE_DESCRIPTION_STANDARD]: ['profile'],
	[BLUR_SELECTORS.PROFILE_DESCRIPTION_BTR]: ['profile'],
	// Avatars
	[BLUR_SELECTORS.CAROUSEL_AVATAR]: ['home', 'profile'],
	[BLUR_SELECTORS.FRIENDS_LIST_AVATAR]: ['friends'],
	[BLUR_SELECTORS.SEARCH_AVATAR]: ['search'],
	[BLUR_SELECTORS.PROFILE_AVATAR]: ['profile'],
	[BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING]: ['profile'],
	[BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING_STANDARD]: ['profile'],
	[BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING_ROVALRA]: ['profile'],
	[BLUR_SELECTORS.PROFILE_OUTFIT_2D]: ['profile'],
	[BLUR_SELECTORS.PROFILE_OUTFIT_3D]: ['profile'],
	[BLUR_SELECTORS.MEMBER_CAROUSEL_AVATAR]: ['groups'],
	[BLUR_SELECTORS.GROUP_CONFIGURE_AVATAR]: ['groups'],
	// Reveal selectors
	[`${BLUR_SELECTORS.FRIENDS_LIST_AVATAR}.blur-revealed`]: ['friends'],
	[`${BLUR_SELECTORS.SEARCH_AVATAR}.blur-revealed`]: ['search']
};

function filterByPage(selectors: string[], ps: PageSettings): string[] {
	return selectors.filter((sel) => {
		const pages = SELECTOR_PAGES[sel];
		return pages?.some((page) => ps[page]);
	});
}

function toRevealSelector(selector: string): string {
	const trimmed = selector.trim();
	const ancestor = `.blur-revealed ${trimmed}`;
	const firstSpace = trimmed.indexOf(' ');
	if (firstSpace === -1) return ancestor;
	return `${ancestor}, ${trimmed.slice(0, firstSpace)}.blur-revealed ${trimmed.slice(firstSpace + 1)}, ${trimmed}.blur-revealed`;
}

function buildBlurCSS(allEnabled = false): string {
	const { blur: bs, page: ps } = allEnabled
		? {
				blur: { displayNames: true, usernames: true, descriptions: true, avatars: true },
				page: { profile: true, home: true, friends: true, groups: true, search: true }
			}
		: getAllSettings();
	const rules: string[] = [];

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
				BLUR_SELECTORS.MEMBER_CAROUSEL_DISPLAY_NAME,
				BLUR_SELECTORS.GROUP_CONFIGURE_DISPLAY_NAME
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
			BLUR_SELECTORS.PROFILE_USERNAME,
			BLUR_SELECTORS.GROUP_CONFIGURE_USERNAME
		);
	}
	if (bs.descriptions) {
		otherTextSelectors.push(
			BLUR_SELECTORS.PROFILE_DESCRIPTION_STANDARD,
			BLUR_SELECTORS.PROFILE_DESCRIPTION_BTR
		);
	}
	addRule(
		otherTextSelectors,
		'filter: blur(4px) !important; clip-path: inset(0); user-select: none;'
	);
	if (bs.descriptions) {
		[BLUR_SELECTORS.PROFILE_DESCRIPTION_STANDARD, BLUR_SELECTORS.PROFILE_DESCRIPTION_BTR].forEach(
			(sel) => {
				rules.push(
					`${sel}:not([data-blur-user-id]) { filter: none !important; user-select: auto; }`
				);
			}
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
				BLUR_SELECTORS.MEMBER_CAROUSEL_AVATAR,
				BLUR_SELECTORS.GROUP_CONFIGURE_AVATAR
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
		rules.push(
			`html.${PROFILE_BLUR_CLASS_SAFE} ${BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING_STANDARD}, html.${PROFILE_BLUR_CLASS_SAFE} ${BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING_ROVALRA} { filter: none !important; }`
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
			BLUR_SELECTORS.MEMBER_CAROUSEL_DISPLAY_NAME,
			BLUR_SELECTORS.GROUP_CONFIGURE_DISPLAY_NAME
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
				BLUR_SELECTORS.MEMBER_CAROUSEL_AVATAR,
				BLUR_SELECTORS.GROUP_CONFIGURE_AVATAR
			],
			ps
		).map(toRevealSelector);

		// Profile-specific reveal selectors
		if (ps.profile) {
			avatarRevealSelectors.push(
				`.blur-revealed ${BLUR_SELECTORS.PROFILE_AVATAR}`,
				`.blur-revealed ${BLUR_SELECTORS.PROFILE_OUTFIT_2D}`,
				`.blur-revealed ${BLUR_SELECTORS.PROFILE_OUTFIT_3D}`,
				`.blur-revealed ${BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING_STANDARD}`,
				`.blur-revealed ${BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING_ROVALRA}`,
				`${BLUR_SELECTORS.PROFILE_AVATAR}.blur-revealed`,
				`${BLUR_SELECTORS.PROFILE_OUTFIT_2D}.blur-revealed`,
				`${BLUR_SELECTORS.PROFILE_OUTFIT_3D}.blur-revealed`,
				`${BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING_STANDARD}.blur-revealed`,
				`${BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING_ROVALRA}.blur-revealed`
			);
		}

		// Page-specific thumbnail reveal selectors
		const thumbnailRevealSelectors = filterByPage(
			[
				`${BLUR_SELECTORS.FRIENDS_LIST_AVATAR}.blur-revealed`,
				`${BLUR_SELECTORS.SEARCH_AVATAR}.blur-revealed`
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

function getOrCreateStyleElement(): HTMLStyleElement {
	const existing = document.getElementById(BLUR_STYLE_ID);
	if (existing instanceof HTMLStyleElement) return existing;
	const el = document.createElement('style');
	el.id = BLUR_STYLE_ID;
	// At document_start, document.head may not be parsed yet so fall back to documentElement
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- document.head is typed non-null but is null at document_start before <head> parses
	(document.head ?? document.documentElement).appendChild(el);
	return el;
}

export function injectBlurStyles(): void {
	if (!isBlurEnabled()) {
		document.getElementById(BLUR_STYLE_ID)?.remove();
		return;
	}
	getOrCreateStyleElement().textContent = buildBlurCSS();
}

export function injectDefaultBlurStyles(): void {
	getOrCreateStyleElement().textContent = buildBlurCSS(true);
}

// Marks descendants under element using either modal selectors or the page-specific selector set
export function markUserElementForBlur(element: Element, userId: string, pageType: PageType): void {
	if (!isBlurEnabled() || revealedUsers.has(userId)) return;

	const endTrace = startTrace(TRACE_CATEGORIES.BLUR, 'markUserElementForBlur', {
		userId,
		pageType
	});
	const { displayNames, usernames, avatars } = getBlurSettings();

	const isModalItem = element.closest(GROUPS_MODAL_SELECTORS.MODAL) !== null;
	const sel = isModalItem
		? {
				displayName: GROUPS_MODAL_SELECTORS.DISPLAY_NAME,
				username: GROUPS_MODAL_SELECTORS.USERNAME,
				avatar: BLUR_SELECTORS.TILE_THUMBNAIL
			}
		: PAGE_SELECTORS[pageType];

	if (displayNames) markAllElements(element, sel.displayName, userId, 'displayName');
	if (usernames) markAllElements(element, sel.username, userId, 'username');
	if (avatars) markAllElements(element, sel.avatar, userId, 'avatar');
	endTrace();
}

export function resetElementBlur(element: Element): void {
	element.classList.remove(BLUR_REVEALED_CLASS);
	element.querySelectorAll(`[${BLUR_SELECTORS.BLUR_USER_ID}]`).forEach((el) => {
		el.classList.remove(BLUR_REVEALED_CLASS);
		cleanupBlurElement(el);
		if (el instanceof HTMLElement) {
			el.style.removeProperty('filter');
		}
	});
}

// Reveals descendants whose blur-type matches a missing reason in status, leaving still-flagged ones blurred
export function revealUserElement(element: Element, status: CombinedStatus<UserStatus>): void {
	const endTrace = startTrace(TRACE_CATEGORIES.BLUR, 'revealUserElement');
	const blurNames = hasReason(status, REASON_KEYS.USER_PROFILE);
	const blurAvatars = hasReason(status, REASON_KEYS.AVATAR_OUTFIT);

	// Outer container only carries the class in the all-revealed case where the typed loop reveals descendants
	if (!blurNames && !blurAvatars) {
		element.classList.add(BLUR_REVEALED_CLASS);
	}

	element.querySelectorAll(`[${BLUR_SELECTORS.BLUR_USER_ID}]`).forEach((el) => {
		const type = el.getAttribute(BLUR_SELECTORS.BLUR_TYPE);
		if (type === 'avatar' ? !blurAvatars : !blurNames) {
			el.classList.add(BLUR_REVEALED_CLASS);
			cleanupBlurElement(el);
		}
	});
	endTrace();
}
