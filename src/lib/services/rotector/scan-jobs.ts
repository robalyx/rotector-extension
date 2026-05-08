import { fetchAllFriendIds } from '../roblox/friends';
import { fetchAllUserGroupIds } from '../roblox/groups';
import { groupStatusService } from './entity-status';
import { queryMultipleUsers } from './unified-query';
import { ROTECTOR_API_ID } from '../../stores/custom-apis';
import type { UserStatus } from '../../types/api';
import { LOOKUP_CONTEXT, STATUS } from '../../types/constants';
import { calculateStatusBadges } from '../../utils/status/status-utils';

const SCAN_PHASE_CHECK_START = 30;
const SCAN_PHASE_CHECK_RANGE = 70;
const FRIEND_SCAN_PROGRESS_MAX = 95;

export type ScanCategory =
	| 'unsafe'
	| 'redacted'
	| 'mixed'
	| 'pending'
	| 'past'
	| 'provisional'
	| 'queued'
	| 'outfit'
	| 'safe';
export type ScanCounts = Map<ScanCategory, number>;

function flagToCategory(flagType: number): ScanCategory {
	switch (flagType) {
		case STATUS.FLAGS.PENDING:
			return 'pending';
		case STATUS.FLAGS.UNSAFE:
			return 'unsafe';
		case STATUS.FLAGS.REDACTED:
			return 'redacted';
		case STATUS.FLAGS.MIXED:
			return 'mixed';
		case STATUS.FLAGS.PAST_OFFENDER:
			return 'past';
		case STATUS.FLAGS.PROVISIONAL:
			return 'provisional';
		case STATUS.FLAGS.QUEUED:
			return 'queued';
		default:
			return 'safe';
	}
}

// Layers outfit-only and queued+processed overrides on top of the flag mapping
function userResultToCategory(status: UserStatus): ScanCategory {
	if (calculateStatusBadges(status).isOutfitOnly) return 'outfit';
	if (status.flagType === STATUS.FLAGS.QUEUED && status.processed === true) return 'safe';
	return flagToCategory(status.flagType);
}

function increment(counts: ScanCounts, category: ScanCategory): void {
	counts.set(category, (counts.get(category) ?? 0) + 1);
}

export async function scanFriendsForUser(
	userId: string,
	isOwnFriends: boolean,
	onProgress: (pct: number) => void,
	signal: AbortSignal
): Promise<ScanCounts> {
	const counts: ScanCounts = new Map();

	const friendIds = await fetchAllFriendIds(
		userId,
		(fetched) => onProgress(Math.min(fetched * 0.15, SCAN_PHASE_CHECK_START)),
		signal
	);

	if (friendIds.length === 0) return counts;

	onProgress(SCAN_PHASE_CHECK_START);

	const lookupContext = isOwnFriends ? LOOKUP_CONTEXT.FRIENDS : undefined;
	const completed = new Set<string>();
	const total = friendIds.length;

	const results = await queryMultipleUsers(
		friendIds.map((id) => id.toString()),
		{
			lookupContext,
			signal,
			onUpdate: (friendId, combined) => {
				const r = combined.get(ROTECTOR_API_ID);
				if (!r || r.loading || completed.has(friendId)) return;
				completed.add(friendId);
				const pct = SCAN_PHASE_CHECK_START + (completed.size / total) * SCAN_PHASE_CHECK_RANGE;
				onProgress(Math.min(pct, FRIEND_SCAN_PROGRESS_MAX));
			}
		}
	);

	for (const combined of results.values()) {
		const data = combined.get(ROTECTOR_API_ID)?.data;
		if (!data) continue;
		increment(counts, userResultToCategory(data));
	}

	return counts;
}

export async function scanGroupsForUser(
	userId: string,
	onProgress: (pct: number) => void,
	signal: AbortSignal
): Promise<ScanCounts> {
	const counts: ScanCounts = new Map();

	const groupIds = await fetchAllUserGroupIds(
		userId,
		(fetched) => onProgress(Math.min(fetched * 0.15, SCAN_PHASE_CHECK_START)),
		signal
	);

	if (groupIds.length === 0) return counts;

	onProgress(SCAN_PHASE_CHECK_START);

	const results = await groupStatusService.getStatuses(
		groupIds.map((id) => id.toString()),
		{
			lookupContext: LOOKUP_CONTEXT.GROUPS,
			signal,
			onProgress: (completed, total) => {
				onProgress(SCAN_PHASE_CHECK_START + (completed / total) * SCAN_PHASE_CHECK_RANGE);
			}
		}
	);

	for (const status of results.values()) {
		if (!status) continue;
		increment(counts, flagToCategory(status.flagType));
	}

	return counts;
}
