import type { StatusFlag, VoteType } from './constants';
import type { CustomApiConfig } from './custom-api';

export interface ReviewerInfo {
	username?: string;
	displayName?: string;
}

interface Badge {
	text: string;
	color?: string;
	textColor?: string;
}

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

export interface GroupStatus {
	id: number;
	flagType: StatusFlag;
	confidence: number;
	reasons: Record<string, ReasonData>;
	isQueued?: boolean;
	timestamp?: number;
}

export interface ReasonData {
	confidence: number;
	message?: string;
	evidence?: string[];
}

export interface VoteData {
	userId: number;
	upvotes: number;
	downvotes: number;
	currentVote?: VoteType | null;
	percentage?: number;
	totalVotes: number;
}

export interface VoteResult {
	success: boolean;
	userId: number;
	voteType: VoteType;
	newVoteData: VoteData;
}

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
	lookupContext?: string;
}

// Page types for content script controllers
export type PageType =
	| 'home'
	| 'friends-list'
	| 'friends-carousel'
	| 'profile'
	| 'members'
	| 'report'
	| 'search-user'
	| 'group-members-carousel'
	| 'group-configure-members';

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
	outfitNames?: string[];
	inappropriateProfile?: boolean;
	inappropriateFriends?: boolean;
	inappropriateGroups?: boolean;
	options?: BatchOptions;
	apiConfig?: CustomApiConfig;
	lookupContext?: string;

	uuid?: string;
	isAnonymous?: boolean;
	reportedUserId?: number;
	reportReason?: string;
	limit?: number;
	offset?: number;
	cursor?: string;
	status?: 'pending' | 'confirmed' | 'rejected';
	includeAnonymous?: boolean;

	code?: string;
	state?: string;
	zoneId?: number;
	orderId?: number;

	texts?: string[];
	targetLanguage?: string;
	sourceLanguage?: string;

	captchaToken?: string;
}

export interface CaptchaSession {
	sessionId: string;
	userId: string;
	outfitNames: string[];
	inappropriateProfile: boolean;
	inappropriateFriends: boolean;
	inappropriateGroups: boolean;
	timestamp: number;
}

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

export interface ExtensionReportsResponse {
	reports: ExtensionUserReport[];
	totalCount: number;
	hasMore: boolean;
}

export interface ReportableUserResponse {
	userId: number;
}

export interface DiscordAuthUrlResponse {
	authUrl: string;
	state: string;
}

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

interface WarMapGlobalStats {
	totalZones: number;
	totalTargets: number;
	totalBanned: number;
	totalFlagged: number;
	totalConfirmed: number;
	averageLiberation: number;
	activeMajorOrders: number;
}

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

interface LeaderboardEntry {
	rank: number;
	uuid: string;
	displayName: string;
	totalPoints: number;
	totalReports: number;
	successRate: number;
	isAnonymous: boolean;
}

export interface LeaderboardResponse {
	leaderboard: LeaderboardEntry[];
	totalUsers: number;
	userRank: number | null;
}

interface OutfitLimitsData {
	current_usage: number;
	limit: number;
	remaining: number;
}

export interface QueueLimitsData {
	current_usage: number;
	limit: number;
	remaining: number;
	has_api_key: boolean;
	reset_time: number;
	outfit: OutfitLimitsData;
}

// Roblox Outfit from avatar API
interface RobloxOutfit {
	id: number;
	name: string;
	isEditable: boolean;
	outfitType: string;
}

export interface OutfitWithThumbnail extends RobloxOutfit {
	thumbnailUrl: string | null;
	thumbnailState: 'pending' | 'completed' | 'error';
}

export interface RobloxOutfitsResponse {
	data: RobloxOutfit[];
	paginationToken: string | null;
}

export interface PaginatedOutfitsResult {
	outfits: OutfitWithThumbnail[];
	currentPage: number;
	hasNextPage: boolean;
	nextCursor: string | null;
}

// Current avatar info for display in outfit picker
export interface CurrentAvatarInfo {
	username: string;
	thumbnailUrl: string | null;
}

interface RobloxThumbnailItem {
	targetId: number;
	state: 'Completed' | 'Pending' | 'Blocked' | 'Error';
	imageUrl: string | null;
}

export interface RobloxThumbnailResponse {
	data: RobloxThumbnailItem[];
}

export interface TrackedUser {
	id: number;
	name: string;
	displayName: string;
	thumbnailUrl: string;
}

export interface GroupTrackedUsersResponse {
	users: TrackedUser[];
	totalCount: number;
	nextCursor: string | null;
	hasMore: boolean;
}

// Discord lookup types for Roblox user
export interface DiscordServerInfo {
	serverId: string;
	serverName: string;
	joinedAt: number | null;
	updatedAt: number | null;
	isTase: boolean;
}

export interface DiscordAccountInfo {
	id: string;
	detectedAt: number | null;
	updatedAt: number | null;
	servers: DiscordServerInfo[];
	sources: number[];
}

export interface RobloxAltAccount {
	robloxUserId: number;
	robloxUsername: string;
	detectedAt: number;
	updatedAt: number;
	sources: number[];
}

export interface RobloxUserDiscordLookup {
	robloxUserId: number;
	discordAccounts: DiscordAccountInfo[];
	altAccounts: RobloxAltAccount[];
}

// Verification source names for Discord-Roblox connections
export const VERIFICATION_SOURCE_NAMES: Record<number, string> = {
	0: 'Bloxlink',
	1: 'Rover',
	2: 'Profile'
};
