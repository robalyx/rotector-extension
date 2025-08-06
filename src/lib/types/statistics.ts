// Statistics data structure
export interface Statistics {
    totalFlaggedUsers: number;
    totalConfirmedUsers: number;
    totalBannedUsers: number;
    pendingQueuedUsers: number;
    queuedUsersFlagged: number;
    queuedUsersNotFlagged: number;
    totalVotesCast: number;
    totalBloxdbUniqueUsers: number;
    totalBloxdbExistingUsers: number;
    aiTotalCost: number;
    totalDonations: number;
    remainingCosts: number;
    lastUpdated: string;
}

// Statistics cache structure
export interface StatisticsCache {
    data: Statistics;
    timestamp: number;
}

// Statistics loading states
export type StatisticsState = 'loading' | 'loaded' | 'error';

// Statistics configuration
export const STATISTICS_CONFIG = {
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
    ANIMATION_DURATION: 1500,
    ANIMATION_DELAY: 100,
};

export const STATISTICS_CACHE_KEY = 'statisticsCache'; 