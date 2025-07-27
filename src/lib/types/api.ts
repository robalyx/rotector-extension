import type { StatusFlag, ReasonType, VoteType } from './constants';

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
  versionCompatibility?: 'current' | 'compatible' | 'outdated' | 'deprecated';
  timestamp?: number;
  reviewer?: ReviewerInfo;
}

// Reason data structure
export interface ReasonData {
  type: ReasonType;
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
  apiKey?: string;
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
  | 'groups'
  | 'report';

// Content script message data
export interface ContentMessage {
  action: string;
  userId?: string | number;
  userIds?: (string | number)[];
  voteType?: VoteType;
  inappropriateOutfit?: boolean;
  inappropriateProfile?: boolean;
  inappropriateFriends?: boolean;
  inappropriateGroups?: boolean;
  options?: BatchOptions;
} 