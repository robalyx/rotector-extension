import type { UserStatus, GroupStatus } from '../types/api';
import type { CombinedStatus } from '../types/custom-api';
import { ROTECTOR_API_ID } from '../services/unified-query-service';

interface StatusBadges {
	isReportable: boolean;
	isOutfitOnly: boolean;
}

// Wrap GroupStatus in CombinedStatus structure for StatusIndicator
export function wrapGroupStatus(groupStatus: GroupStatus | null): CombinedStatus | null {
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
					timestamp: Date.now()
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
