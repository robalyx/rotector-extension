import {STATUS} from '../types/constants';
import {calculateStatusBadges} from './status-utils';
import type {GroupStatus, UserStatus} from '../types/api';

interface StatusConfig {
    iconClass: string;
    textContent: string;
    textClass: string;
    confidence: number | null;
    isReportable: boolean;
    isQueued: boolean;
    isOutfitOnly: boolean;
}

// Get status configuration for display
export function getStatusConfig(
    status: UserStatus | GroupStatus | null,
    cachedStatus: UserStatus | GroupStatus | null,
    loading: boolean,
    error: string | null
): StatusConfig {
    if (error) {
        return {
            iconClass: 'status-icon-error',
            textContent: 'Error',
            textClass: 'status-text-error',
            confidence: null,
            isReportable: false,
            isQueued: false,
            isOutfitOnly: false
        };
    }

    const activeStatus = status ?? cachedStatus;

    if (loading || !activeStatus) {
        return {
            iconClass: 'status-icon-loading',
            textContent: 'Checking...',
            textClass: '',
            confidence: null,
            isReportable: false,
            isQueued: false,
            isOutfitOnly: false
        };
    }

    const confidence = Math.round(activeStatus.confidence * 100);
    const {isReportable, isOutfitOnly} = calculateStatusBadges(activeStatus);
    const isQueued = !!activeStatus.isQueued;


    const baseConfig = {
        confidence,
        isReportable,
        isQueued,
        isOutfitOnly
    };

    switch (activeStatus.flagType) {
        case STATUS.FLAGS.SAFE:
            return {
                ...baseConfig,
                iconClass: 'status-icon-safe',
                textContent: 'Safe',
                textClass: 'status-text-safe'
            };
        case STATUS.FLAGS.UNSAFE:
            return {
                ...baseConfig,
                iconClass: 'status-icon-unsafe',
                textContent: 'Unsafe',
                textClass: 'status-text-unsafe'
            };
        case STATUS.FLAGS.PENDING:
            return {
                ...baseConfig,
                iconClass: 'status-icon-pending',
                textContent: `Under Review (${confidence}%)`,
                textClass: 'status-text-pending'
            };
        case STATUS.FLAGS.QUEUED:
            return {
                ...baseConfig,
                iconClass: 'status-icon-queued',
                textContent: 'Flagged (Pending)',
                textClass: 'status-text-queued',
                isQueued: true
            };
        case STATUS.FLAGS.INTEGRATION:
            return {
                ...baseConfig,
                iconClass: 'status-icon-integration',
                textContent: `Integration (${confidence}%)`,
                textClass: 'status-text-integration'
            };
        case STATUS.FLAGS.MIXED:
            return {
                ...baseConfig,
                iconClass: 'status-icon-unsafe',
                textContent: 'Mixed',
                textClass: 'status-text-unsafe',
                isOutfitOnly: false // Groups don't have outfit-only status
            };
        default:
            return {
                ...baseConfig,
                iconClass: 'status-icon-error',
                textContent: 'Unknown',
                textClass: 'status-text-error',
                isReportable: false,
                isQueued: false,
                isOutfitOnly: false
            };
    }
}