import { STATUS, type StatusFlag } from '../types/constants';
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

interface FlagStyle {
	iconName: StatusIconName;
	iconColor: string;
	textContent: string;
	textClass: string;
}

const STATUS_TEXT_SAFE_CLASS = 'status-text-safe';

// Translation helper for non-Svelte contexts
const t = (key: string, values?: Record<string, string | number>): string =>
	get(_)(key, { values });

// Map a flagType to its icon, color, text content, and css class
function getFlagStyle(flagType: StatusFlag, entityType: 'user' | 'group'): FlagStyle {
	switch (flagType) {
		case STATUS.FLAGS.SAFE:
			return {
				iconName: 'safe',
				iconColor: '#888888',
				textContent: t('tooltip_status_not_checked'),
				textClass: STATUS_TEXT_SAFE_CLASS
			};
		case STATUS.FLAGS.UNSAFE:
			return {
				iconName: 'unsafe',
				iconColor: '#ff4444',
				textContent: t('tooltip_status_unsafe'),
				textClass: 'status-text-unsafe'
			};
		case STATUS.FLAGS.PENDING:
			return {
				iconName: 'pending',
				iconColor: '#f97316',
				textContent: t('tooltip_status_under_review'),
				textClass: 'status-text-pending'
			};
		case STATUS.FLAGS.QUEUED:
			return {
				iconName: 'checking',
				iconColor: '#999',
				textContent: t('tooltip_status_checking'),
				textClass: 'status-text-checking'
			};
		case STATUS.FLAGS.PROVISIONAL:
			return {
				iconName: 'provisional',
				iconColor: '#888888',
				textContent: t('tooltip_status_provisional'),
				textClass: STATUS_TEXT_SAFE_CLASS
			};
		case STATUS.FLAGS.REDACTED:
			return {
				iconName: 'redacted',
				iconColor: '#ff4444',
				textContent: t('tooltip_status_redacted'),
				textClass: 'status-text-unsafe'
			};
		case STATUS.FLAGS.MIXED:
			// Users show yellow question mark, groups show orange X
			return entityType === 'user'
				? {
						iconName: 'mixed',
						iconColor: '#eab308',
						textContent: t('tooltip_status_mixed'),
						textClass: 'status-text-mixed'
					}
				: {
						iconName: 'unsafe',
						iconColor: '#f97316',
						textContent: t('tooltip_status_mixed'),
						textClass: 'status-text-pending'
					};
		case STATUS.FLAGS.PAST_OFFENDER:
			return {
				iconName: 'past-offender',
				iconColor: '#4a9eff',
				textContent: t('tooltip_status_past_offender'),
				textClass: 'status-text-past-offender'
			};
		default:
			return {
				iconName: 'error',
				iconColor: '#6b7280',
				textContent: t('tooltip_status_unknown'),
				textClass: 'status-text-error'
			};
	}
}

// Display fields for a flagType when no full status is available
export function getFlagDisplay(
	flagType: StatusFlag,
	entityType: 'user' | 'group' = 'user'
): Omit<FlagStyle, 'textClass'> {
	const { iconName, iconColor, textContent } = getFlagStyle(flagType, entityType);
	return { iconName, iconColor, textContent };
}

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
	const isQueued = !!activeStatus.isQueued;
	const baseConfig = { confidence, isReportable, isQueued, isOutfitOnly };

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
