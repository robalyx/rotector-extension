export type ActivityHours = 24 | 168 | 720;

// One hourly bucket of user and group category counts
export interface HourlyStatEntry {
	timestamp: string;
	usersConfirmed: number;
	usersFlagged: number;
	usersMixed: number;
	usersBanned: number;
	groupsConfirmed: number;
	groupsFlagged: number;
	groupsMixed: number;
	groupsLocked: number;
}

// Cumulative all-time counts across users, groups, and community activity
export interface StatTotals {
	usersConfirmed: number;
	usersFlagged: number;
	usersMixed: number;
	usersBanned: number;
	groupsConfirmed: number;
	groupsFlagged: number;
	groupsMixed: number;
	groupsLocked: number;
	votesCast: number;
	queuedUsers: number;
}

// Funding snapshot for the Ko-fi progress bar
export interface FundingSnapshot {
	donations: number;
	goal: number;
	remaining: number;
}

// Time-series payload for the activity charts
export interface ActivityData {
	hours: ActivityHours;
	entries: HourlyStatEntry[];
}

// Full response shape from GET /v1/stats?hours=N
export interface StatsResponse {
	totals: StatTotals;
	funding: FundingSnapshot;
	activity: ActivityData;
}

export type UserCategory = 'usersConfirmed' | 'usersFlagged' | 'usersMixed' | 'usersBanned';

export type GroupCategory = 'groupsConfirmed' | 'groupsFlagged' | 'groupsMixed' | 'groupsLocked';

export type ActivityCategory = UserCategory | GroupCategory;

export type StatsState = 'loading' | 'loaded' | 'error' | 'empty';

export interface StatsCache {
	data: StatsResponse;
	timestamp: number;
}

export const STATS_CACHE_KEY_PREFIX = 'statsCache_';
export const STATS_CACHE_DURATION = 5 * 60 * 1000;
export const STATS_POLL_INTERVAL = 60 * 1000;

export const ACTIVITY_HOURS: readonly ActivityHours[] = [24, 168, 720] as const;
