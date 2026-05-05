import { derived, get, writable } from 'svelte/store';
import { settings, updateSetting } from './settings';
import { SETTINGS_KEYS } from '../types/settings';
import { ENTITY_TYPES, type StatusFlag } from '../types/constants';
import { FIRST_DETECTION_FLAG_TYPES } from '../utils/status/status-utils';

export const firstDetectionContext = writable<{ userId: string; flagType: StatusFlag } | null>(
	null
);

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

// Stash the first non-Safe user seen, idempotent across StatusIndicator instances
// Reads via get() to avoid waking subscribers on no-op writes in long lists
function reportPossibleFirstDetection(ctx: { userId: string; flagType: StatusFlag }): void {
	if (get(firstDetectionContext) !== null) return;
	firstDetectionContext.set(ctx);
}

// Report only when the entity meets eligibility (user, not self, flag type matches)
// Lets renderers stay free of the gating logic
export function reportFirstDetectionIfEligible(ctx: {
	entityType: 'user' | 'group';
	userId: string;
	isSelfLookup: boolean;
	flagType: StatusFlag | undefined;
}): void {
	if (ctx.entityType !== ENTITY_TYPES.USER) return;
	if (ctx.isSelfLookup || !ctx.userId) return;
	if (ctx.flagType === undefined || !FIRST_DETECTION_FLAG_TYPES.has(ctx.flagType)) return;
	reportPossibleFirstDetection({ userId: ctx.userId, flagType: ctx.flagType });
}
