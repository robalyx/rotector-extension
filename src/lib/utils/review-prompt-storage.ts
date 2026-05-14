import { getStorage, setStorage } from '@/lib/utils/storage';

export const REVIEW_PROMPT_COUNT_KEY = 'reviewPromptFlagCount';
export const REVIEW_PROMPT_STATE_KEY = 'reviewPromptState';
export const REVIEW_PROMPT_SHOWN_AT_KEY = 'reviewPromptShownAtFlagCount';

export type ReviewPromptState = 'pending' | 'shown_at_5' | 'completed';

export async function incrementSuccessfulFlagCount(): Promise<void> {
	const current = await getStorage<number>('local', REVIEW_PROMPT_COUNT_KEY, 0);
	await setStorage('local', REVIEW_PROMPT_COUNT_KEY, current + 1);
}

export async function readReviewPromptFlagCount(): Promise<number> {
	return getStorage<number>('local', REVIEW_PROMPT_COUNT_KEY, 0);
}

export async function readReviewPromptState(): Promise<ReviewPromptState> {
	return getStorage<ReviewPromptState>('local', REVIEW_PROMPT_STATE_KEY, 'pending');
}

export async function readReviewPromptShownAt(): Promise<number> {
	return getStorage<number>('local', REVIEW_PROMPT_SHOWN_AT_KEY, 0);
}
