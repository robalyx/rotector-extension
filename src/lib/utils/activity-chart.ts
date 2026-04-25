import type { ActivityCategory, ActivityHours, HourlyStatEntry } from '../types/stats';

export interface CategoryDescriptor {
	key: ActivityCategory;
	labelKey: string;
	color: string;
}

interface YBounds {
	min: number;
	max: number;
}

export const USER_CATEGORIES: readonly CategoryDescriptor[] = [
	{ key: 'usersConfirmed', labelKey: 'stats_activity_category_confirmed', color: '#f87171' },
	{ key: 'usersFlagged', labelKey: 'stats_activity_category_flagged', color: '#fb923c' },
	{ key: 'usersMixed', labelKey: 'stats_activity_category_mixed', color: '#fbbf24' },
	{ key: 'usersBanned', labelKey: 'stats_activity_category_banned', color: '#b91c1c' }
] as const;

export const GROUP_CATEGORIES: readonly CategoryDescriptor[] = [
	{ key: 'groupsConfirmed', labelKey: 'stats_activity_category_confirmed', color: '#f87171' },
	{ key: 'groupsFlagged', labelKey: 'stats_activity_category_flagged', color: '#fb923c' },
	{ key: 'groupsMixed', labelKey: 'stats_activity_category_mixed', color: '#fbbf24' },
	{ key: 'groupsLocked', labelKey: 'stats_activity_category_locked', color: '#b91c1c' }
] as const;

// Net change per bucket, length N-1 where N is the entry count
export function computeDeltas(entries: HourlyStatEntry[], field: ActivityCategory): number[] {
	const deltas: number[] = [];
	for (let i = 1; i < entries.length; i++) {
		const curr = entries[i];
		const prev = entries[i - 1];
		if (!curr || !prev) continue;
		deltas.push(curr[field] - prev[field]);
	}
	return deltas;
}

// IQR-based bounds smooth outliers in multi-day views
export function computeYBounds(datasets: number[][]): YBounds | undefined {
	const all = datasets.flat().filter((v) => v !== 0);
	if (all.length < 4) return undefined;

	all.sort((a, b) => a - b);
	const q1 = all[Math.floor(all.length * 0.25)];
	const q3 = all[Math.floor(all.length * 0.75)];
	if (q1 === undefined || q3 === undefined) return undefined;
	const iqr = q3 - q1;
	if (iqr === 0) return undefined;

	const fence = 3 * iqr;
	let lower = q1 - fence;
	let upper = q3 + fence;

	const padding = (upper - lower) * 0.2;
	lower -= padding;
	upper += padding;

	if (lower > 0) lower = 0;
	if (upper < 0) upper = 0;

	return { min: Math.floor(lower), max: Math.ceil(upper) };
}

export function formatTickLabel(timestamp: Date, hours: ActivityHours): string {
	if (hours === 24) {
		return `${timestamp.getHours().toString().padStart(2, '0')}h`;
	}
	if (hours === 168) {
		return timestamp.toLocaleDateString(undefined, { weekday: 'short' });
	}
	return timestamp.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}
