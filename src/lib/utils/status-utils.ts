import {STATUS} from '../types/constants';
import type {UserStatus} from '../types/api';

interface StatusBadges {
    isReportable: boolean;
    isOutfitOnly: boolean;
}

// Calculate status badges based on user status
export function calculateStatusBadges(status: UserStatus | null | undefined): StatusBadges {
    // Default return for null/undefined status or missing reasons
    if (!status?.reasons) {
        return {
            isReportable: false,
            isOutfitOnly: false
        };
    }

    // Detect reportable status - user has description violations
    const isReportable = !!(
        status.reasons[STATUS.REASON_TYPES.USER_PROFILE.toString()]
    );

    // Detect outfit-only status - user is flagged only for outfit with no other violations
    const reasonTypes = Object.keys(status.reasons);
    const hasOutfitReason = reasonTypes.includes(STATUS.REASON_TYPES.AVATAR_OUTFIT.toString());
    const isOutfitOnly = hasOutfitReason && reasonTypes.length === 1 && !isReportable;

    return {
        isReportable,
        isOutfitOnly
    };
}