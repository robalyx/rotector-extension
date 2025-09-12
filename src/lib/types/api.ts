import type {GroupReasonType, StatusFlag, UserReasonType, VoteType} from './constants';

// Reviewer information interface
export interface ReviewerInfo {
    username?: string;
    displayName?: string;
}

// User status interface
export interface UserStatus {
    id: string;
    flagType: StatusFlag;
    confidence: number;
    reasons: Record<string, ReasonData>;
    isQueued?: boolean;
    isReportable?: boolean;
    isOutfitOnly?: boolean;
    engineVersion?: string;
    integrationSources?: Record<string, string>;
    versionCompatibility?: 'current' | 'compatible' | 'outdated' | 'deprecated';
    timestamp?: number;
    reviewer?: ReviewerInfo;
    queuedAt?: number;
    processedAt?: number;
    processed?: boolean;
}

// Group status interface
export interface GroupStatus {
    id: string;
    flagType: StatusFlag;
    confidence: number;
    reasons: Record<string, ReasonData>;
    isQueued?: boolean;
    timestamp?: number;
}

// Reason data structure  
export interface ReasonData {
    type: UserReasonType | GroupReasonType;
    confidence: number;
    message?: string;
    evidence?: string[] | null;
    timestamp?: number;
}

// Vote data structure
export interface VoteData {
    userId: string;
    upvotes: number;
    downvotes: number;
    currentVote?: VoteType | null;
    percentage?: number;
    totalVotes: number;
}

// Vote submission result
export interface VoteResult {
    success: boolean;
    userId: string;
    voteType: VoteType;
    newVoteData: VoteData;
}

// Queue submission result
export interface QueueSuccessData {
    queued: number;
}

export interface QueueErrorData {
    error: string;
    requestId: string;
    code: string;
    type: string;
}

export interface QueueResult {
    success: boolean;
    data?: QueueSuccessData;
    error?: string;
    requestId?: string;
    code?: string;
    type?: string;
}

// Generic API response wrapper
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    status?: number;
}

// Batch processing options
export interface BatchOptions {
    batchSize?: number;
    batchDelay?: number;
    maxRetries?: number;
    retryDelay?: number;
}

// API client configuration
export interface ApiClientConfig {
    baseUrl: string;
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
}

// Request options for API calls
export interface RequestOptions {
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number;
}

// Page types for content script controllers
export type PageType =
    | 'home'
    | 'friends-list'
    | 'friends-carousel'
    | 'profile'
    | 'members'
    | 'report'
    | 'search-user';

// Content script message data
export interface ContentMessage {
    action: string;
    userId?: string | number;
    userIds?: Array<string | number>;
    groupId?: string | number;
    groupIds?: Array<string | number>;
    voteType?: VoteType;
    inappropriateOutfit?: boolean;
    inappropriateProfile?: boolean;
    inappropriateFriends?: boolean;
    inappropriateGroups?: boolean;
    options?: BatchOptions;
} 