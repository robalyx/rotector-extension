import type { UserStatus, GroupStatus } from '../types/api';
import type { CombinedStatus } from '../types/custom-api';
import { ROTECTOR_API_ID } from '../services/unified-query-service';
import { getAssetUrl } from './assets';
import { STATUS } from '../types/constants';

interface StatusBadges {
	isReportable: boolean;
	isOutfitOnly: boolean;
}

// Wrap GroupStatus in CombinedStatus structure for StatusIndicator
export function wrapGroupStatus(
	groupStatus: GroupStatus | null,
	isLoading = false,
	error?: string
): CombinedStatus | null {
	// Show error state
	if (error) {
		return {
			customApis: new Map([
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
			])
		};
	}

	// Show loading state while fetching
	if (isLoading) {
		return {
			customApis: new Map([
				[
					ROTECTOR_API_ID,
					{
						apiId: ROTECTOR_API_ID,
						apiName: 'Rotector',
						loading: true,
						landscapeImageDataUrl: getAssetUrl('/assets/rotector-tab.webp')
					}
				]
			])
		};
	}

	if (!groupStatus) return null;

	return {
		customApis: new Map([
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
		])
	};
}

// Calculate status badges based on user status
export function calculateStatusBadges(status: UserStatus | null | undefined): StatusBadges {
	// Detect reportable status
	const isReportable = status?.isReportable ?? false;

	// Default return for null/undefined status or missing reasons
	if (!status?.reasons) {
		return {
			isReportable,
			isOutfitOnly: false
		};
	}

	// Detect outfit-only status
	const reasonTypes = Object.keys(status.reasons);
	const hasOutfitReason = reasonTypes.includes('Avatar Outfit');
	const isOutfitOnly = hasOutfitReason && reasonTypes.length === 1 && !isReportable;

	return {
		isReportable,
		isOutfitOnly
	};
}

/**
 * Check if a user is flagged by any API with an actionable status
 * (UNSAFE, PENDING, or MIXED).
 */
export function isFlagged(status: CombinedStatus | null): boolean {
	if (!status) return false;
	return Array.from(status.customApis.values()).some(
		(result) =>
			result.data &&
			(result.data.flagType === STATUS.FLAGS.UNSAFE ||
				result.data.flagType === STATUS.FLAGS.PENDING ||
				result.data.flagType === STATUS.FLAGS.MIXED)
	);
}
