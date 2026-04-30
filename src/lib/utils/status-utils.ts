import type { UserStatus, GroupStatus } from '../types/api';
import type { CombinedStatus, CustomApiResult } from '../types/custom-api';
import { ROTECTOR_API_ID } from '../stores/custom-apis';
import { getAssetUrl } from './assets';
import { STATUS } from '../types/constants';

// Flag types that represent an actionable (non-safe) state
const ACTIONABLE_FLAG_TYPES = new Set<number>([
	STATUS.FLAGS.UNSAFE,
	STATUS.FLAGS.PENDING,
	STATUS.FLAGS.MIXED,
	STATUS.FLAGS.REDACTED
]);

export const FIRST_DETECTION_FLAG_TYPES = new Set<number>([
	STATUS.FLAGS.UNSAFE,
	STATUS.FLAGS.PENDING,
	STATUS.FLAGS.MIXED,
	STATUS.FLAGS.PROVISIONAL,
	STATUS.FLAGS.PAST_OFFENDER,
	STATUS.FLAGS.REDACTED
]);

// Check if an individual API result has flagged the entity
function isActionableResult<T extends UserStatus | GroupStatus>(
	result: CustomApiResult<T>
): boolean {
	return !!result.data && ACTIONABLE_FLAG_TYPES.has(result.data.flagType);
}

interface StatusBadges {
	isReportable: boolean;
	isOutfitOnly: boolean;
	hasCrossSignal: boolean;
}

// Create a CombinedStatus representing an error state (e.g., restricted access)
export function createErrorCombinedStatus<T extends UserStatus | GroupStatus>(
	error: string
): CombinedStatus<T> {
	return new Map([
		[
			ROTECTOR_API_ID,
			{
				apiId: ROTECTOR_API_ID,
				apiName: 'Rotector',
				error,
				loading: false,
				timestamp: Date.now(),
				landscapeImageDataUrl: getAssetUrl('/assets/rotector-tab.webp')
			}
		]
	]);
}

// Wrap GroupStatus in CombinedStatus structure for StatusIndicator
export function wrapGroupStatus(
	groupStatus: GroupStatus | null,
	isLoading = false,
	error?: string
): CombinedStatus<GroupStatus> | null {
	if (error) {
		return createErrorCombinedStatus<GroupStatus>(error);
	}

	// Show loading state while fetching
	if (isLoading) {
		return new Map([
			[
				ROTECTOR_API_ID,
				{
					apiId: ROTECTOR_API_ID,
					apiName: 'Rotector',
					loading: true,
					landscapeImageDataUrl: getAssetUrl('/assets/rotector-tab.webp')
				}
			]
		]);
	}

	if (!groupStatus) return null;

	return new Map([
		[
			ROTECTOR_API_ID,
			{
				apiId: ROTECTOR_API_ID,
				apiName: 'Rotector',
				data: groupStatus,
				loading: false,
				timestamp: Date.now(),
				landscapeImageDataUrl: getAssetUrl('/assets/rotector-tab.webp')
			}
		]
	]);
}

// Calculate status badges based on user status
export function calculateStatusBadges(status: UserStatus | null | undefined): StatusBadges {
	// Detect reportable status
	const isReportable = status?.isReportable ?? false;

	// Default return for null/undefined status or missing reasons
	if (!status?.reasons) {
		return {
			isReportable,
			isOutfitOnly: false,
			hasCrossSignal: false
		};
	}

	// Detect outfit-only status
	const reasonTypes = Object.keys(status.reasons);
	const hasOutfitReason = reasonTypes.includes('Avatar Outfit');
	const isOutfitOnly =
		hasOutfitReason &&
		reasonTypes.length === 1 &&
		!isReportable &&
		status.flagType !== STATUS.FLAGS.UNSAFE;

	// Detect profile reason corroborated by other categories
	const hasProfileReason = reasonTypes.includes('User Profile');
	const hasCrossSignal = hasProfileReason && reasonTypes.length > 1;

	return {
		isReportable,
		isOutfitOnly,
		hasCrossSignal
	};
}

/**
 * Check if a user is flagged by any API with an actionable status
 * (UNSAFE, PENDING, or MIXED).
 */
export function isFlagged<T extends UserStatus | GroupStatus>(
	status: CombinedStatus<T> | null
): boolean {
	if (!status) return false;
	return Array.from(status.values()).some(isActionableResult);
}

/**
 * Return the API result that flagged this entity. Prefers Rotector when it has
 * flagged, otherwise returns the first custom API with an actionable status.
 */
export function getFlaggingResult<T extends UserStatus | GroupStatus>(
	status: CombinedStatus<T> | null
): CustomApiResult<T> | undefined {
	if (!status) return undefined;

	const rotector = status.get(ROTECTOR_API_ID);
	if (rotector && isActionableResult(rotector)) {
		return rotector;
	}

	for (const result of status.values()) {
		if (isActionableResult(result)) return result;
	}

	return undefined;
}
