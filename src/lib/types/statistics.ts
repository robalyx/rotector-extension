interface WeekUsage {
	startDate: string;
	endDate: string;
	totalCost: number;
	totalRequests: number;
	totalPromptTokens: number;
	totalCompletionTokens: number;
	totalReasoningTokens: number;
}

export interface WeeklyUsage {
	week1: WeekUsage;
	week2: WeekUsage;
	week3: WeekUsage;
	week4: WeekUsage;
}

export interface Statistics {
	totalFlaggedUsers: number;
	totalConfirmedUsers: number;
	totalMixedUsers: number;
	totalBannedUsers: number;
	totalQueuedUsers: number;
	totalVotesCast: number;
	totalBloxdbUniqueUsers: number;
	totalBloxdbExistingUsers: number;
	totalFlaggedGroups: number;
	totalConfirmedGroups: number;
	totalMixedGroups: number;
	totalBannedGroups: number;
	aiTotalCost: number;
	totalDonations: number;
	remainingCosts: number;
	weeklyUsage: WeeklyUsage;
	lastUpdated: string;
}

export interface StatisticsCache {
	data: Statistics;
	timestamp: number;
}

export type StatisticsState = 'loading' | 'loaded' | 'error';

export const STATISTICS_CONFIG = {
	CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
	ANIMATION_DURATION: 1500,
	ANIMATION_DELAY: 100
};

export const STATISTICS_CACHE_KEY = 'statisticsCache';
