import { BLUR_SELECTORS, PROFILE_BLUR_GROUPS } from './selectors';
import {
	getBlurSettings,
	hasReason,
	isBlurEnabled,
	markAllElements,
	markElementForUser,
	PROFILE_BLUR_CLASS_FLAGGED,
	PROFILE_BLUR_CLASS_SAFE,
	PROFILE_TEXT_BLUR_CLASS_FLAGGED,
	PROFILE_TEXT_BLUR_CLASS_SAFE,
	revealAndCleanup,
	revealedGroups,
	revealedUsers,
	revealSingleElement,
	type BlurContentType
} from './internals';
import { REASON_KEYS } from '../../types/constants';
import { waitForElement } from '../../utils/dom/element-waiter';
import type { UserStatus } from '../../types/api';
import type { CombinedStatus } from '../../types/custom-api';

const WAIT_FOR_PROFILE_ITEMS = { maxRetries: 10, baseDelay: 200, maxDelay: 1000 };

export function setProfileOutfitBlurState(state: 'flagged' | 'safe' | null): void {
	const root = document.documentElement;
	root.classList.remove(PROFILE_BLUR_CLASS_FLAGGED, PROFILE_BLUR_CLASS_SAFE);

	if (state === 'flagged') {
		root.classList.add(PROFILE_BLUR_CLASS_FLAGGED);
	} else if (state === 'safe') {
		root.classList.add(PROFILE_BLUR_CLASS_SAFE);
	}
}

export function setProfileTextBlurState(state: 'flagged' | 'safe' | null): void {
	const root = document.documentElement;
	root.classList.remove(PROFILE_TEXT_BLUR_CLASS_FLAGGED, PROFILE_TEXT_BLUR_CLASS_SAFE);

	if (state === 'flagged') {
		root.classList.add(PROFILE_TEXT_BLUR_CLASS_FLAGGED);
	} else if (state === 'safe') {
		root.classList.add(PROFILE_TEXT_BLUR_CLASS_SAFE);
	}
}

// Tags profile header, description, avatar, outfits, and currently-wearing items so CSS rules apply blur
export function markProfileElementsForBlur(userId: string): void {
	if (!isBlurEnabled() || revealedUsers.has(userId)) return;
	const { displayNames, usernames, descriptions, avatars } = getBlurSettings();

	const headerGroup = `${PROFILE_BLUR_GROUPS.HEADER}:${userId}`;
	const outfitGroup = `${PROFILE_BLUR_GROUPS.OUTFIT}:${userId}`;

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

	if (avatars) {
		markAllElements(document, BLUR_SELECTORS.PROFILE_AVATAR, userId, 'avatar', outfitGroup);
		markAllElements(document, BLUR_SELECTORS.PROFILE_OUTFIT_2D, userId, 'avatar', outfitGroup);
		markAllElements(document, BLUR_SELECTORS.PROFILE_OUTFIT_3D, userId, 'avatar', outfitGroup);
		void markCurrentlyWearingItems(userId, outfitGroup);
	}
}

async function markCurrentlyWearingItems(userId: string, groupId: string): Promise<void> {
	const result = await waitForElement(
		BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING,
		WAIT_FOR_PROFILE_ITEMS
	);

	if (!result.success) return;
	if (revealedUsers.has(userId)) return;
	if (revealedGroups.has(groupId)) return;

	const items = document.querySelectorAll(BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING);
	items.forEach((el) => {
		if (el instanceof HTMLElement) {
			markElementForUser(el, userId, 'avatar', groupId);
		}
	});
}

interface ObserveEntry {
	selector: string;
	type: BlurContentType;
	group: string;
	isSafe?: () => boolean;
}

function observeSelectors(userId: string, entries: ObserveEntry[]): () => void {
	if (entries.length === 0) return () => {};

	const processElement = (el: HTMLElement, entry: ObserveEntry) => {
		const alreadyRevealed = revealedUsers.has(userId) || revealedGroups.has(entry.group);
		if (alreadyRevealed || entry.isSafe?.()) {
			revealSingleElement(el);
		} else {
			markElementForUser(el, userId, entry.type, entry.group);
		}
	};

	for (const entry of entries) {
		document.querySelectorAll(entry.selector).forEach((el) => {
			if (el instanceof HTMLElement) processElement(el, entry);
		});
	}

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (!(node instanceof HTMLElement)) continue;
				for (const entry of entries) {
					if (node.matches(entry.selector)) processElement(node, entry);
					node.querySelectorAll(entry.selector).forEach((el) => {
						if (el instanceof HTMLElement) processElement(el, entry);
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

// Watches profile DOM for header (display name / username), description, and outfit
// nodes, applying or revealing blur as they (re)appear. Returns one cleanup.
export function observeProfileBlur(userId: string): () => void {
	const headerGroup = `${PROFILE_BLUR_GROUPS.HEADER}:${userId}`;
	const outfitGroup = `${PROFILE_BLUR_GROUPS.OUTFIT}:${userId}`;
	const outfitIsSafe = () => document.documentElement.classList.contains(PROFILE_BLUR_CLASS_SAFE);
	const textIsSafe = () =>
		document.documentElement.classList.contains(PROFILE_TEXT_BLUR_CLASS_SAFE);
	const { displayNames, usernames, avatars } = getBlurSettings();

	const entries: ObserveEntry[] = [
		{
			selector: BLUR_SELECTORS.PROFILE_DESCRIPTION,
			type: 'description',
			group: headerGroup,
			isSafe: textIsSafe
		},
		{
			selector: BLUR_SELECTORS.PROFILE_AVATAR,
			type: 'avatar',
			group: outfitGroup,
			isSafe: outfitIsSafe
		},
		{
			selector: BLUR_SELECTORS.PROFILE_OUTFIT_2D,
			type: 'avatar',
			group: outfitGroup,
			isSafe: outfitIsSafe
		},
		{
			selector: BLUR_SELECTORS.PROFILE_OUTFIT_3D,
			type: 'avatar',
			group: outfitGroup,
			isSafe: outfitIsSafe
		}
	];
	if (avatars) {
		entries.push({
			selector: BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING,
			type: 'avatar',
			group: outfitGroup,
			isSafe: outfitIsSafe
		});
	}
	if (displayNames) {
		entries.push({
			selector: BLUR_SELECTORS.PROFILE_DISPLAY_NAME,
			type: 'displayName',
			group: headerGroup,
			isSafe: textIsSafe
		});
	}
	if (usernames) {
		entries.push({
			selector: BLUR_SELECTORS.PROFILE_USERNAME,
			type: 'username',
			group: headerGroup,
			isSafe: textIsSafe
		});
	}
	return observeSelectors(userId, entries);
}

async function revealProfileAvatars(): Promise<void> {
	const sel = `${BLUR_SELECTORS.PROFILE_AVATAR}, ${BLUR_SELECTORS.PROFILE_OUTFIT_2D}, ${BLUR_SELECTORS.PROFILE_OUTFIT_3D}, ${BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING}`;
	document.querySelectorAll(sel).forEach(revealAndCleanup);

	const result = await waitForElement(
		BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING,
		WAIT_FOR_PROFILE_ITEMS
	);
	if (result.success) {
		document.querySelectorAll(BLUR_SELECTORS.PROFILE_CURRENTLY_WEARING).forEach(revealAndCleanup);
	}
}

// Reveals header text or outfit and avatar groups based on which reasons the combined status carries
export function revealProfileElements(status: CombinedStatus<UserStatus>): void {
	const blurNames = hasReason(status, REASON_KEYS.USER_PROFILE);
	const blurAvatars = hasReason(status, REASON_KEYS.AVATAR_OUTFIT);

	if (!blurNames) {
		document
			.querySelectorAll(
				`${BLUR_SELECTORS.PROFILE_DISPLAY_NAME}, ${BLUR_SELECTORS.PROFILE_USERNAME}, ${BLUR_SELECTORS.PROFILE_DESCRIPTION}`
			)
			.forEach(revealAndCleanup);

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
