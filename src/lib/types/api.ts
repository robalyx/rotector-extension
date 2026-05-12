import type * as v from 'valibot';
import type { PAGE_TYPES, VoteType } from './constants';
import type { CustomApiConfig } from './custom-api';
import type {
	DiscordAccountInfoSchema,
	GroupStatusSchema,
	GroupTrackedUsersSchema,
	LeaderboardSchema,
	MeProfileSchema,
	MeRefreshSchema,
	MeSessionSchema,
	MeSettingsResponseSchema,
	MembershipStatusSchema,
	MembershipVerificationChallengeSchema,
	QueueLimitsSchema,
	QueueResultSchema,
	ReasonSchema,
	ReviewerInfoSchema,
	RobloxAltAccountSchema,
	RobloxAuthChallengeSchema,
	RobloxAuthLogoutAllSchema,
	RobloxAuthProfileSchema,
	RobloxAuthSessionTokenSchema,
	RobloxUserDiscordLookupSchema,
	TrackedUserSchema,
	UserStatusSchema,
	VoteDataSchema
} from '../schemas/rotector';

export type ReviewerInfo = v.InferOutput<typeof ReviewerInfoSchema>;
export type ReasonData = v.InferOutput<typeof ReasonSchema>;
export type MembershipStatus = v.InferOutput<typeof MembershipStatusSchema>;
export type MembershipVerificationChallenge = v.InferOutput<
	typeof MembershipVerificationChallengeSchema
>;
export type MembershipTier = MembershipStatus['tier'];
export type MembershipTierName = MembershipStatus['tierName'];

export interface MembershipBadgeUpdatePayload {
	badgeDesign?: number;
	iconDesign?: number;
	textDesign?: number;
}

export type UserStatus = v.InferOutput<typeof UserStatusSchema>;
export type GroupStatus = v.InferOutput<typeof GroupStatusSchema>;
export type EntityStatus = UserStatus | GroupStatus;

export type VoteData = v.InferOutput<typeof VoteDataSchema>;

export interface VoteResult {
	success: boolean;
	userId: number;
	voteType: VoteType;
	newVoteData: VoteData;
}

export type QueueResult = v.InferOutput<typeof QueueResultSchema>;
export type QueueLimitsData = v.InferOutput<typeof QueueLimitsSchema>;

export interface QueueSuccessData {
	queued: number;
}

export interface QueueErrorData {
	error: string;
	requestId: string;
	code: string;
	type: string;
}

export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	status?: number;
	requestId?: string;
	code?: string;
	type?: string;
	rateLimitReset?: number;
	details?: Record<string, unknown>;
}

export interface RequestOptions {
	timeout?: number | undefined;
	apiConfig?: CustomApiConfig | undefined;
	lookupContext?: string | undefined;
	signal?: AbortSignal | undefined;
}

export type PageType = (typeof PAGE_TYPES)[keyof typeof PAGE_TYPES];

export interface TranslationResult {
	translations: Record<string, string>;
}

export interface OutfitSnapshotResult {
	primaryDataUrl: string | null;
	rawUrls: string[];
	primaryFailed: boolean;
}

export interface OutfitSnapshotByNameResult extends OutfitSnapshotResult {
	name: string;
}

export interface OutfitSnapshotByIdResult extends OutfitSnapshotResult {
	outfitId: string;
}

export interface OutfitSnapshotByNameResponse {
	results: OutfitSnapshotByNameResult[];
}

export interface OutfitSnapshotByIdResponse {
	results: OutfitSnapshotByIdResult[];
}

export interface CaptchaSession {
	sessionId: string;
	userId: string;
	outfitNames: string[];
	outfitIds?: number[];
	inappropriateProfile: boolean;
	inappropriateFriends: boolean;
	inappropriateGroups: boolean;
	senderTabId?: number;
	timestamp: number;
}

export type SelectedOutfit =
	| { kind: 'saved'; id: number; name: string }
	| { kind: 'current'; name: string };

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

export interface PaginatedOutfitsResult {
	outfits: OutfitWithThumbnail[];
	currentPage: number;
	hasNextPage: boolean;
	nextCursor: string | null;
}

export interface CurrentAvatarInfo {
	username: string;
	thumbnailUrl: string | null;
}

export type TrackedUser = v.InferOutput<typeof TrackedUserSchema>;
export type GroupTrackedUsersResponse = v.InferOutput<typeof GroupTrackedUsersSchema>;

export interface ExportResult {
	content: string;
	filename: string;
	mimeType: string;
}

export type DiscordAccountInfo = v.InferOutput<typeof DiscordAccountInfoSchema>;
export type RobloxAltAccount = v.InferOutput<typeof RobloxAltAccountSchema>;
export type RobloxUserDiscordLookup = v.InferOutput<typeof RobloxUserDiscordLookupSchema>;

export type RobloxAuthChallenge = v.InferOutput<typeof RobloxAuthChallengeSchema>;
export type RobloxAuthProfile = v.InferOutput<typeof RobloxAuthProfileSchema>;
export type RobloxAuthSessionToken = v.InferOutput<typeof RobloxAuthSessionTokenSchema>;
export type RobloxAuthLogoutAll = v.InferOutput<typeof RobloxAuthLogoutAllSchema>;
export type MeProfile = v.InferOutput<typeof MeProfileSchema>;
export type MeSettingsResponse = v.InferOutput<typeof MeSettingsResponseSchema>;
export type MeRefreshResult = v.InferOutput<typeof MeRefreshSchema>;
export type MeSession = v.InferOutput<typeof MeSessionSchema>;
export type Leaderboard = v.InferOutput<typeof LeaderboardSchema>;
export type LeaderboardWindow = Leaderboard['window'];
export type LeaderboardEntry = Leaderboard['entries'][number];

export interface MeSettingsPatch {
	alias?: string | null;
	show_username?: boolean;
	show_thumbnail?: boolean;
}
