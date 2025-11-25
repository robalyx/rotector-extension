import { STATUS } from '../types/constants';
import { calculateStatusBadges } from './status-utils';
import { _ } from 'svelte-i18n';
import { get } from 'svelte/store';
import type { GroupStatus, UserStatus } from '../types/api';
import type { StatusIconName } from './icon-mapping';

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

// Translation helper for non-Svelte contexts where $_() syntax is unavailable
const t = (key: string, values?: Record<string, string | number>): string =>
	get(_)(key, { values });

// Get status configuration for display
export function getStatusConfig(
	status: UserStatus | GroupStatus | null,
	cachedStatus: UserStatus | GroupStatus | null,
	loading: boolean,
	error: string | null,
	entityType: 'user' | 'group' = 'user'
): StatusConfig {
	if (error) {
		if (error === 'restricted_access') {
			return {
				iconName: 'restricted',
				iconColor: '#888888',
				textContent: t('tooltip_restricted_title'),
				textClass: 'status-text-safe',
				confidence: null,
				isReportable: false,
				isQueued: false,
				isOutfitOnly: false
			};
		}
		return {
			iconName: 'error',
			iconColor: '#ff4444',
			textContent: t('tooltip_status_unknown'),
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
			textContent: t('tooltip_status_checking'),
			textClass: '',
			confidence: null,
			isReportable: false,
			isQueued: false,
			isOutfitOnly: false
		};
	}

	const confidence = Math.round(activeStatus.confidence * 100);
	const { isReportable, isOutfitOnly } = calculateStatusBadges(activeStatus);
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
				textContent: t('tooltip_status_not_flagged'),
				textClass: 'status-text-safe'
			};
		case STATUS.FLAGS.UNSAFE:
			return {
				...baseConfig,
				iconName: 'unsafe',
				iconColor: '#ff4444',
				textContent: t('tooltip_status_unsafe'),
				textClass: 'status-text-unsafe'
			};
		case STATUS.FLAGS.PENDING:
			return {
				...baseConfig,
				iconName: 'pending',
				iconColor: '#f97316',
				textContent: `${t('tooltip_status_under_review')} (${confidence}%)`,
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
					textContent: t('tooltip_status_likely_safe'),
					textClass: 'status-text-likely-safe',
					isQueued: false
				};
			} else {
				// User is still queued and being processed by the system
				return {
					...baseConfig,
					iconName: 'checking',
					iconColor: '#999',
					textContent: t('tooltip_status_checking'),
					textClass: 'status-text-checking',
					isQueued: true
				};
			}
		}
		case STATUS.FLAGS.INTEGRATION:
			return {
				...baseConfig,
				iconName: 'integration',
				iconColor: '#14b8a6',
				textContent: `${t('tooltip_status_integration')} (${confidence}%)`,
				textClass: 'status-text-integration'
			};
		case STATUS.FLAGS.MIXED:
			// Users show yellow question mark, groups show orange X
			if (entityType === 'user') {
				return {
					...baseConfig,
					iconName: 'mixed',
					iconColor: '#eab308',
					textContent: t('tooltip_status_mixed'),
					textClass: 'status-text-mixed'
				};
			} else {
				return {
					...baseConfig,
					iconName: 'unsafe',
					iconColor: '#f97316',
					textContent: t('tooltip_status_mixed'),
					textClass: 'status-text-pending',
					isOutfitOnly: false
				};
			}
		case STATUS.FLAGS.PAST_OFFENDER:
			return {
				...baseConfig,
				iconName: 'past-offender',
				iconColor: '#4a9eff',
				textContent: t('tooltip_status_past_offender'),
				textClass: 'status-text-past-offender'
			};
		default:
			return {
				...baseConfig,
				iconName: 'error',
				iconColor: '#ff4444',
				textContent: t('tooltip_status_unknown'),
				textClass: 'status-text-error',
				isReportable: false,
				isQueued: false,
				isOutfitOnly: false
			};
	}
}
