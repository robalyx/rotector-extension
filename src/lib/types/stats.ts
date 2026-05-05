import type * as v from 'valibot';
import type { HourlyStatEntrySchema, StatsResponseSchema } from '../schemas/stats';

export type ActivityHours = 24 | 168 | 720;

export type HourlyStatEntry = v.InferOutput<typeof HourlyStatEntrySchema>;
export type StatsResponse = v.InferOutput<typeof StatsResponseSchema>;

export type UserCategory = 'usersConfirmed' | 'usersFlagged' | 'usersMixed' | 'usersBanned';
export type GroupCategory = 'groupsConfirmed' | 'groupsFlagged' | 'groupsMixed' | 'groupsLocked';
export type ActivityCategory = UserCategory | GroupCategory;

export type StatsState = 'loading' | 'loaded' | 'error' | 'empty';

export const STATS_CACHE_KEY_PREFIX = 'statsCache_';
export const STATS_CACHE_DURATION = 5 * 60 * 1000;
export const STATS_POLL_INTERVAL = 60 * 1000;

export const ACTIVITY_HOURS: readonly ActivityHours[] = [24, 168, 720] as const;
