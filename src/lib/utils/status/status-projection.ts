import { REASON_KEYS } from '../../types/constants';
import { ROTECTOR_API_ID } from '../../stores/custom-apis';
import type { CombinedStatus } from '../../types/custom-api';
import type { EntityStatus } from '../../types/api';
import { extractFlaggedOutfits, type FlaggedOutfitInfo } from './violation-formatter';

function getRotectorData<T extends EntityStatus>(
	combined: CombinedStatus<T> | null | undefined
): T | undefined {
	return combined?.get(ROTECTOR_API_ID)?.data;
}

// Get flagged outfit info from a combined status map (user only)
export function getRotectorOutfitEvidence(
	combined: CombinedStatus | null | undefined
): FlaggedOutfitInfo[] | null {
	const evidence = getRotectorData(combined)?.reasons[REASON_KEYS.AVATAR_OUTFIT]?.evidence;
	if (!evidence) return null;
	return extractFlaggedOutfits(evidence);
}

// Get the membership badge from rotector data, if present (user only)
export function getRotectorMembershipBadge(combined: CombinedStatus | null | undefined) {
	const data = getRotectorData(combined);
	if (!data || !('membershipBadge' in data)) return null;
	return data.membershipBadge ?? null;
}

interface VisibleBadgesInput {
	isGroup: boolean;
	isReportable: boolean;
	isQueued: boolean;
	customApiFlagCount: number;
	hasMembership: boolean;
}

// Map each visible badge to its "badge-stack-N" position class, in stack order
export function getBadgeStackClasses(opts: VisibleBadgesInput): Record<string, string> {
	const classes: Record<string, string> = {};
	let i = 0;
	if (!opts.isGroup && opts.isReportable) classes['reportable'] = `badge-stack-${String(++i)}`;
	if (opts.isQueued) classes['queue'] = `badge-stack-${String(++i)}`;
	if (opts.customApiFlagCount > 0) classes['integration'] = `badge-stack-${String(++i)}`;
	if (opts.hasMembership) classes['membership'] = `badge-stack-${String(i + 1)}`;
	return classes;
}
