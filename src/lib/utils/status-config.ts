import {STATUS} from '../types/constants';
import {calculateStatusBadges} from './status-utils';
import type {GroupStatus, UserStatus} from '../types/api';
import type {StatusIconName} from './icon-mapping';

interface StatusConfig {
    iconName: StatusIconName;
    iconColor: string;
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
            iconName: 'error',
            iconColor: '#999',
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
            iconName: 'loading',
            iconColor: '#666',
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
                iconName: 'safe',
                iconColor: '#888888',
                textContent: 'Not Flagged',
                textClass: 'status-text-safe'
            };
        case STATUS.FLAGS.UNSAFE:
            return {
                ...baseConfig,
                iconName: 'unsafe',
                iconColor: '#ff4444',
                textContent: 'Unsafe',
                textClass: 'status-text-unsafe'
            };
        case STATUS.FLAGS.PENDING:
            return {
                ...baseConfig,
                iconName: 'pending',
                iconColor: '#ff9800',
                textContent: `Under Review (${confidence}%)`,
                textClass: 'status-text-pending'
            };
        case STATUS.FLAGS.QUEUED: {
            const userStatus = activeStatus as UserStatus;
            if (userStatus.processed === true) {
                // User was queued and processed but not flagged
                return {
                    ...baseConfig,
                    iconName: 'likely-safe',
                    iconColor: '#44cc44',
                    textContent: 'Likely Safe',
                    textClass: 'status-text-likely-safe',
                    isQueued: false
                };
            } else {
                // User is still being processed by the system
                return {
                    ...baseConfig,
                    iconName: 'checking',
                    iconColor: '#999',
                    textContent: 'Checking...',
                    textClass: 'status-text-checking',
                    isQueued: false
                };
            }
        }
        case STATUS.FLAGS.INTEGRATION:
            return {
                ...baseConfig,
                iconName: 'integration',
                iconColor: '#14b8a6',
                textContent: `Integration (${confidence}%)`,
                textClass: 'status-text-integration'
            };
        case STATUS.FLAGS.MIXED:
            return {
                ...baseConfig,
                iconName: 'unsafe',
                iconColor: '#ff4444',
                textContent: 'Mixed',
                textClass: 'status-text-unsafe',
                isOutfitOnly: false // Groups don't have outfit-only status
            };
        case STATUS.FLAGS.PAST_OFFENDER:
            return {
                ...baseConfig,
                iconName: 'past-offender',
                iconColor: '#4a9eff',
                textContent: 'Past Offender',
                textClass: 'status-text-past-offender'
            };
        default:
            return {
                ...baseConfig,
                iconName: 'error',
                iconColor: '#999',
                textContent: 'Unknown',
                textClass: 'status-text-error',
                isReportable: false,
                isQueued: false,
                isOutfitOnly: false
            };
    }
}