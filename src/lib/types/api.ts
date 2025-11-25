import type { StatusFlag, VoteType } from './constants';
import type { CustomApiConfig } from './custom-api';

// Reviewer information interface
export interface ReviewerInfo {
	username?: string;
	displayName?: string;
}

// Custom API badge interface
interface Badge {
	text: string;
	color?: string;
	textColor?: string;
}

// User status interface
export interface UserStatus {
	id: number;
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
	queuedAt?: number;
	processedAt?: number;
	processed?: boolean;
	lastUpdated?: number;
	badges?: Badge[];
}

// Group status interface
export interface GroupStatus {
	id: number;
	flagType: StatusFlag;
	confidence: number;
	reasons: Record<string, ReasonData>;
	isQueued?: boolean;
	timestamp?: number;
}

// Reason data structure
export interface ReasonData {
	confidence: number;
	message?: string;
	evidence?: string[];
}

// Vote data structure
export interface VoteData {
	userId: number;
	upvotes: number;
	downvotes: number;
	currentVote?: VoteType | null;
	percentage?: number;
	totalVotes: number;
}

// Vote submission result
export interface VoteResult {
	success: boolean;
	userId: number;
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
interface BatchOptions {
	batchSize?: number;
	batchDelay?: number;
	maxRetries?: number;
	retryDelay?: number;
}

// Request options for API calls
export interface RequestOptions {
	maxRetries?: number;
	retryDelay?: number;
	timeout?: number;
	apiConfig?: CustomApiConfig;
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

// Translation result
export interface TranslationResult {
	translations: Record<string, string>;
}

// Content script message data
export interface ContentMessage {
	action: string;
	clientId?: string;
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
	apiConfig?: CustomApiConfig;

	uuid?: string;
	isAnonymous?: boolean;
	reportedUserId?: number;
	reportReason?: string;
	limit?: number;
	offset?: number;
	status?: 'pending' | 'confirmed' | 'rejected';
	includeAnonymous?: boolean;

	code?: string;
	state?: string;
	zoneId?: number;
	orderId?: number;

	texts?: string[];
	targetLanguage?: string;
	sourceLanguage?: string;
}

// Extension User Profile
export interface ExtensionUserProfile {
	uuid: string;
	discordUserId: string;
	discordUsername: string;
	discordAvatar: string | null;
	totalPoints: number;
	isAnonymous: boolean;
	createdAt: string;
	lastActive: string;
}

// Extension User Report
export interface ExtensionUserReport {
	id: number;
	extensionUserUuid: string;
	reportedUserId: number;
	reportReason: string | null;
	status: 'pending' | 'confirmed' | 'rejected';
	pointsAwarded: number;
	reportedAt: string;
	processedAt: string | null;
}

// Extension Reports Response
export interface ExtensionReportsResponse {
	reports: ExtensionUserReport[];
	totalCount: number;
	hasMore: boolean;
}

// Reportable User Response
export interface ReportableUserResponse {
	userId: number;
}

// Discord OAuth Authorization URL Response
export interface DiscordAuthUrlResponse {
	authUrl: string;
	state: string;
}

// Extension Statistics
export interface ExtensionStatistics {
	totalUsers: number;
	totalReports: number;
	pendingReports: number;
	confirmedReports: number;
	rejectedReports: number;
	totalPointsAwarded: number;
	averagePointsPerUser: number;
	topUserPoints: number;
}

// Major Order
export interface MajorOrder {
	id: number;
	title: string;
	description: string;
	type: 'ban_count' | 'zone_liberation' | 'verification';
	targetValue: number;
	currentValue: number;
	startValue: number;
	progress: number;
	expiresAt: string;
	completedAt: string | null;
	rewardType: 'none' | 'recognition' | 'points' | 'badge';
	rewardDescription: string;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

// Daily Stats (shared by zone and global historical endpoints)
interface DailyStats {
	date: string;
	liberation: number;
	totalUsers: number;
	bannedUsers: number;
	flaggedUsers: number;
	confirmedUsers: number;
}

// Zone Historical Statistics (30 days)
export interface ZoneHistoricalStats {
	zoneId: number;
	period: {
		start: string;
		end: string;
	};
	dailyStats: DailyStats[];
}

// Global Historical Statistics (30 days)
export interface GlobalHistoricalStats {
	period: {
		start: string;
		end: string;
	};
	dailyStats: DailyStats[];
}

// War Zone Target
export interface Target {
	id: number;
	userId: number;
	userName: string;
	userStatus: number; // 1 = flagged, 2 = confirmed
	confidence: number;
	assignedAt: string;
	expiresAt: string;
	banAttempts: number;
}

// War Zone
export interface Zone {
	id: number;
	name: string;
	liberation: number;
	userPercentage: number;
	totalUsers: number;
	bannedUsers: number;
	flaggedUsers: number;
	confirmedUsers: number;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

// War Map Global Stats
interface WarMapGlobalStats {
	totalZones: number;
	totalTargets: number;
	totalBanned: number;
	totalFlagged: number;
	totalConfirmed: number;
	averageLiberation: number;
	activeMajorOrders: number;
}

// Complete War Map State
export interface WarMapState {
	zones: Zone[];
	activeTargets: Target[];
	majorOrders: MajorOrder[];
	globalStats: WarMapGlobalStats;
	lastUpdated: string;
}

// Zone Details with Liberation History
export interface ZoneDetails {
	zone: Zone;
	liberationHistory: Array<{
		date: string;
		liberation: number;
	}>;
}

// Leaderboard Entry
interface LeaderboardEntry {
	rank: number;
	uuid: string;
	displayName: string;
	totalPoints: number;
	totalReports: number;
	successRate: number;
	isAnonymous: boolean;
}

// Leaderboard Response
export interface LeaderboardResponse {
	leaderboard: LeaderboardEntry[];
	totalUsers: number;
	userRank: number | null;
}

// Queue Limits Data
export interface QueueLimitsData {
	current_usage: number;
	limit: number;
	remaining: number;
	has_api_key: boolean;
	reset_time: number;
}
