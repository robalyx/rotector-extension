import { derived, get, writable } from 'svelte/store';
import { settings, updateSetting } from './settings';
import { SETTINGS_KEYS } from '../types/settings';

interface DetectionContext {
	userId: string;
	flagType: number;
}

export const firstDetectionContext = writable<DetectionContext | null>(null);

// Gate for the first-detection modal across stores
export const shouldShowFirstDetection = derived(
	[settings, firstDetectionContext],
	([$s, $ctx]) =>
		$ctx !== null &&
		!$s[SETTINGS_KEYS.FIRST_DETECTION_SEEN] &&
		$s[SETTINGS_KEYS.ONBOARDING_COMPLETED]
);

// Persist that the user has seen the modal and clear the trigger
export async function markFirstDetectionSeen(): Promise<void> {
	await updateSetting(SETTINGS_KEYS.FIRST_DETECTION_SEEN, true);
	firstDetectionContext.set(null);
}

// Stash the first non-Safe user seen, idempotent across StatusIndicator instances.
// Reads via get() to avoid waking subscribers on no-op writes in long lists.
export function reportPossibleFirstDetection(ctx: DetectionContext): void {
	if (get(firstDetectionContext) !== null) return;
	firstDetectionContext.set(ctx);
}
