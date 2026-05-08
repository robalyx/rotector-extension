import { fetchAllFriendIds } from '../roblox/friends';
import { fetchAllUserGroupIds } from '../roblox/groups';
import { groupStatusService } from './entity-status';
import { queryMultipleUsers } from './unified-query';
import { ROTECTOR_API_ID } from '../../stores/custom-apis';
import { LOOKUP_CONTEXT, STATUS } from '../../types/constants';

export type ScanCategory = 'safe' | 'pending' | 'unsafe' | 'mixed' | 'past';
export type ScanCounts = Map<ScanCategory, number>;

function flagToCategory(flagType: number): ScanCategory {
	switch (flagType) {
		case STATUS.FLAGS.PENDING:
			return 'pending';
		case STATUS.FLAGS.UNSAFE:
		case STATUS.FLAGS.REDACTED:
			return 'unsafe';
		case STATUS.FLAGS.MIXED:
			return 'mixed';
		case STATUS.FLAGS.PAST_OFFENDER:
			return 'past';
		default:
			return 'safe';
	}
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
		(fetched) => onProgress(Math.min(fetched * 0.15, 30)),
		signal
	);

	if (friendIds.length === 0) return counts;

	onProgress(30);

	const lookupContext = isOwnFriends ? LOOKUP_CONTEXT.FRIENDS : undefined;

	const results = await queryMultipleUsers(
		friendIds.map((id) => id.toString()),
		{ lookupContext, signal }
	);

	onProgress(80);

	for (const combined of results.values()) {
		const flagType = combined.get(ROTECTOR_API_ID)?.data?.flagType;
		if (flagType === undefined) continue;
		increment(counts, flagToCategory(flagType));
	}

	onProgress(100);
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
		(fetched) => onProgress(Math.min(fetched * 0.15, 30)),
		signal
	);

	if (groupIds.length === 0) return counts;

	onProgress(30);

	const results = await groupStatusService.getStatuses(
		groupIds.map((id) => id.toString()),
		{ lookupContext: LOOKUP_CONTEXT.GROUPS, signal }
	);

	onProgress(80);

	for (const status of results.values()) {
		if (!status) continue;
		increment(counts, flagToCategory(status.flagType));
	}

	onProgress(100);
	return counts;
}
