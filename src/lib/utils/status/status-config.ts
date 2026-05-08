import { STATUS, type StatusFlag } from '../../types/constants';
import { calculateStatusBadges } from './status-utils';
import { _ } from 'svelte-i18n';
import { get } from 'svelte/store';
import type { GroupStatus, UserStatus } from '../../types/api';
import type { StatusIconName } from '../icon-mapping';

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

const STATUS_TEXT_SAFE_CLASS = 'status-text-safe';

interface FlagPresentation {
	iconName: StatusIconName;
	iconColor: string;
	textKey: string;
	textClass: string;
	badgeClass: string;
}

export const STATUS_FLAG_PRESENTATION: Record<StatusFlag, FlagPresentation> = {
	[STATUS.FLAGS.SAFE]: {
		iconName: 'safe',
		iconColor: '#888888',
		textKey: 'tooltip_status_not_checked',
		textClass: STATUS_TEXT_SAFE_CLASS,
		badgeClass: 'safe'
	},
	[STATUS.FLAGS.UNSAFE]: {
		iconName: 'unsafe',
		iconColor: '#ff4444',
		textKey: 'tooltip_status_unsafe',
		textClass: 'status-text-unsafe',
		badgeClass: 'unsafe'
	},
	[STATUS.FLAGS.PENDING]: {
		iconName: 'pending',
		iconColor: '#f97316',
		textKey: 'tooltip_status_under_review',
		textClass: 'status-text-pending',
		badgeClass: 'pending'
	},
	[STATUS.FLAGS.QUEUED]: {
		iconName: 'checking',
		iconColor: '#999',
		textKey: 'tooltip_status_checking',
		textClass: 'status-text-checking',
		badgeClass: 'pending'
	},
	[STATUS.FLAGS.PROVISIONAL]: {
		iconName: 'provisional',
		iconColor: '#888888',
		textKey: 'tooltip_status_provisional',
		textClass: STATUS_TEXT_SAFE_CLASS,
		badgeClass: 'safe'
	},
	[STATUS.FLAGS.MIXED]: {
		iconName: 'mixed',
		iconColor: '#eab308',
		textKey: 'tooltip_status_mixed',
		textClass: 'status-text-mixed',
		badgeClass: 'mixed'
	},
	[STATUS.FLAGS.PAST_OFFENDER]: {
		iconName: 'past-offender',
		iconColor: '#4a9eff',
		textKey: 'tooltip_status_past_offender',
		textClass: 'status-text-past-offender',
		badgeClass: 'past-offender'
	},
	[STATUS.FLAGS.REDACTED]: {
		iconName: 'redacted',
		iconColor: '#ff4444',
		textKey: 'tooltip_status_redacted',
		textClass: 'status-text-unsafe',
		badgeClass: 'unsafe'
	},
	[STATUS.FLAGS.UNKNOWN]: {
		iconName: 'unknown',
		iconColor: '#f97316',
		textKey: 'tooltip_status_update_required',
		textClass: 'status-text-pending',
		badgeClass: 'pending'
	}
};

// MIXED groups present as orange X instead of yellow question-mark
export const MIXED_GROUP: FlagPresentation = {
	iconName: 'unsafe',
	iconColor: '#f97316',
	textKey: 'tooltip_status_mixed',
	textClass: 'status-text-pending',
	badgeClass: 'unsafe'
};

// Translation helper for non-Svelte contexts
const t = (key: string, values?: Record<string, string | number>): string =>
	get(_)(key, { values });

function getFlagStyle(flagType: StatusFlag, entityType: 'user' | 'group') {
	const base =
		flagType === STATUS.FLAGS.MIXED && entityType === 'group'
			? MIXED_GROUP
			: STATUS_FLAG_PRESENTATION[flagType];
	return {
		iconName: base.iconName,
		iconColor: base.iconColor,
		textContent: t(base.textKey),
		textClass: base.textClass
	};
}

// Display fields for a flagType when no full status is available
export function getFlagDisplay(flagType: StatusFlag, entityType: 'user' | 'group' = 'user') {
	const { iconName, iconColor, textContent } = getFlagStyle(flagType, entityType);
	return { iconName, iconColor, textContent };
}

// Resolves icon, text, and badge state across loading, error, outfit-only, queued, and flagged paths
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
				textClass: STATUS_TEXT_SAFE_CLASS,
				confidence: null,
				isReportable: false,
				isQueued: false,
				isOutfitOnly: false
			};
		}
		return {
			iconName: 'error',
			iconColor: '#6b7280',
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
	const userStatus = entityType === 'user' ? (activeStatus as UserStatus) : null;
	const { isReportable, isOutfitOnly } = calculateStatusBadges(userStatus);
	const baseConfig = { confidence, isReportable, isQueued: false, isOutfitOnly };

	// Outfit-only users show distinct dashed indicator
	if (isOutfitOnly) {
		return {
			...baseConfig,
			iconName: 'outfit',
			iconColor: '#888888',
			textContent: t('tooltip_status_outfit_detected'),
			textClass: STATUS_TEXT_SAFE_CLASS
		};
	}

	// Queued users that have been processed but not flagged display as safe
	if (activeStatus.flagType === STATUS.FLAGS.QUEUED && userStatus?.processed === true) {
		return {
			...baseConfig,
			iconName: 'safe',
			iconColor: '#888888',
			textContent: t('tooltip_status_not_flagged'),
			textClass: STATUS_TEXT_SAFE_CLASS,
			isQueued: false
		};
	}

	const style = getFlagStyle(activeStatus.flagType, entityType);

	// PENDING annotates text with confidence percentage
	if (activeStatus.flagType === STATUS.FLAGS.PENDING) {
		return {
			...baseConfig,
			...style,
			textContent: `${style.textContent} (${String(confidence)}%)`
		};
	}

	// QUEUED still being processed so explicitly mark as queued
	if (activeStatus.flagType === STATUS.FLAGS.QUEUED) {
		return { ...baseConfig, ...style, isQueued: true };
	}

	return { ...baseConfig, ...style };
}
