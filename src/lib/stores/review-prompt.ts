import { derived, writable } from 'svelte/store';
import { settings } from './settings';
import { SETTINGS_KEYS } from '../types/settings';
import { setStorage, subscribeStorageKey } from '../utils/storage';
import { logger } from '../utils/logging/logger';
import {
	readReviewPromptFlagCount,
	readReviewPromptShownAt,
	readReviewPromptState,
	REVIEW_PROMPT_COUNT_KEY,
	REVIEW_PROMPT_SHOWN_AT_KEY,
	REVIEW_PROMPT_STATE_KEY,
	type ReviewPromptState
} from '../utils/review-prompt-storage';

export type ReviewPromptVariant = 'A' | 'B';

const VARIANT_A_THRESHOLD = 5;
const VARIANT_B_DELTA = 5;

const reviewPromptFlagCount = writable<number>(0);
const reviewPromptCurrentState = writable<ReviewPromptState>('pending');
const reviewPromptShownAt = writable<number>(0);

export const shouldShowReviewPrompt = derived(
	[reviewPromptFlagCount, reviewPromptCurrentState, reviewPromptShownAt, settings],
	([$count, $state, $shownAt, $settings]): ReviewPromptVariant | null => {
		if (!$settings[SETTINGS_KEYS.ONBOARDING_COMPLETED]) return null;
		if ($state === 'completed') return null;
		if ($state === 'pending' && $count >= VARIANT_A_THRESHOLD) return 'A';
		if ($state === 'shown_at_5' && $count >= $shownAt + VARIANT_B_DELTA) return 'B';
		return null;
	}
);

export async function loadReviewPromptState(): Promise<void> {
	try {
		const [count, state, shownAt] = await Promise.all([
			readReviewPromptFlagCount(),
			readReviewPromptState(),
			readReviewPromptShownAt()
		]);
		reviewPromptFlagCount.set(count);
		reviewPromptCurrentState.set(state);
		reviewPromptShownAt.set(shownAt);
	} catch (error) {
		logger.error('Failed to load review-prompt state:', error);
	}
}

export async function dismissReviewPrompt(variant: ReviewPromptVariant): Promise<void> {
	if (variant === 'A') {
		const count = await readReviewPromptFlagCount();
		await setStorage('local', REVIEW_PROMPT_SHOWN_AT_KEY, count);
		await setStorage('local', REVIEW_PROMPT_STATE_KEY, 'shown_at_5');
	} else {
		await setStorage('local', REVIEW_PROMPT_STATE_KEY, 'completed');
	}
}

export async function markReviewPromptCompleted(): Promise<void> {
	await setStorage('local', REVIEW_PROMPT_STATE_KEY, 'completed');
}

subscribeStorageKey<number>('local', REVIEW_PROMPT_COUNT_KEY, (newValue) => {
	reviewPromptFlagCount.set(newValue ?? 0);
});

subscribeStorageKey<ReviewPromptState>('local', REVIEW_PROMPT_STATE_KEY, (newValue) => {
	reviewPromptCurrentState.set(newValue ?? 'pending');
});

subscribeStorageKey<number>('local', REVIEW_PROMPT_SHOWN_AT_KEY, (newValue) => {
	reviewPromptShownAt.set(newValue ?? 0);
});
