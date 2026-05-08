import * as v from 'valibot';
import { STATUS, VOTE_TYPES } from '../types/constants';
import { NullableString, NullableStringArray } from './common';

const USER_FLAG_VALUES = Object.values(STATUS.FLAGS);
const GROUP_FLAG_VALUES = [
	STATUS.FLAGS.SAFE,
	STATUS.FLAGS.PENDING,
	STATUS.FLAGS.UNSAFE,
	STATUS.FLAGS.QUEUED,
	STATUS.FLAGS.MIXED,
	STATUS.FLAGS.PAST_OFFENDER,
	STATUS.FLAGS.UNKNOWN
];

export const ReviewerInfoSchema = v.object({
	username: v.optional(v.string()),
	displayName: v.optional(v.string())
});

export const ReasonSchema = v.object({
	confidence: v.number(),
	message: v.optional(v.string()),
	evidence: v.optional(NullableStringArray)
});

const MembershipBadgeSchema = v.object({
	tier: v.picklist([1, 2, 3]),
	badgeDesign: v.number(),
	iconDesign: v.number(),
	textDesign: v.number()
});

const VersionCompatibilitySchema = v.picklist(['current', 'compatible', 'outdated', 'unknown']);

const UserStatusBaseSchema = v.object({
	id: v.number(),
	flagType: v.fallback(v.picklist(USER_FLAG_VALUES), STATUS.FLAGS.UNKNOWN),
	confidence: v.optional(v.number(), 0),
	reasons: v.optional(v.record(v.string(), ReasonSchema), () => ({})),
	reviewer: v.optional(ReviewerInfoSchema),
	engineVersion: v.optional(v.string()),
	versionCompatibility: v.optional(VersionCompatibilitySchema),
	isReportable: v.optional(v.boolean()),
	queuedAt: v.optional(v.number()),
	processed: v.optional(v.boolean()),
	processedAt: v.optional(v.number()),
	lastUpdated: v.optional(v.number()),
	badges: v.optional(
		v.array(
			v.object({
				text: v.string(),
				color: v.optional(v.string()),
				textColor: v.optional(v.string())
			})
		)
	),
	membershipBadge: v.optional(MembershipBadgeSchema)
});

const GroupStatusBaseSchema = v.object({
	id: v.number(),
	flagType: v.fallback(v.picklist(GROUP_FLAG_VALUES), STATUS.FLAGS.UNKNOWN),
	confidence: v.optional(v.number(), 0),
	reasons: v.optional(v.record(v.string(), ReasonSchema), () => ({}))
});

export const UserStatusSchema = v.pipe(UserStatusBaseSchema, v.brand('UserStatus'));
export const GroupStatusSchema = v.pipe(GroupStatusBaseSchema, v.brand('GroupStatus'));

export const VoteDataSchema = v.object({
	userId: v.number(),
	upvotes: v.number(),
	downvotes: v.number(),
	currentVote: v.optional(v.picklist([VOTE_TYPES.UPVOTE, VOTE_TYPES.DOWNVOTE]))
});

export const QueueStatusItemSchema = v.object({
	queued: v.boolean(),
	queued_at: v.optional(v.number(), 0),
	processed: v.optional(v.boolean(), false),
	processed_at: v.optional(v.nullable(v.number()), null),
	processing: v.optional(v.boolean(), false),
	flagged: v.optional(v.boolean(), false)
});

const OutfitLimitsSchema = v.object({
	current_usage: v.number(),
	limit: v.number(),
	remaining: v.number()
});

export const QueueLimitsSchema = v.object({
	current_usage: v.number(),
	limit: v.number(),
	remaining: v.number(),
	has_api_key: v.boolean(),
	reset_time: v.number(),
	outfit: OutfitLimitsSchema
});

export const QueueResultSchema = v.variant('success', [
	v.object({
		success: v.literal(true),
		data: v.object({ queued: v.number() })
	}),
	v.object({
		success: v.literal(false),
		error: v.optional(v.string()),
		requestId: v.optional(v.string()),
		code: v.optional(v.string()),
		type: v.optional(v.string())
	})
]);

export const TrackedUserSchema = v.object({
	id: v.number(),
	name: v.string(),
	displayName: v.string(),
	thumbnailUrl: NullableString,
	isActive: v.boolean()
});

export const GroupTrackedUsersSchema = v.object({
	users: v.array(TrackedUserSchema),
	totalCount: v.number(),
	nextCursor: v.nullable(v.string()),
	hasMore: v.boolean()
});

const DiscordServerInfoSchema = v.object({
	serverId: v.string(),
	serverName: v.string(),
	joinedAt: v.nullable(v.number()),
	updatedAt: v.nullable(v.number()),
	firstSeenAt: v.number(),
	isTase: v.boolean(),
	inGracePeriod: v.boolean()
});

export const RobloxAltAccountSchema = v.object({
	robloxUserId: v.number(),
	robloxUsername: v.string(),
	detectedAt: v.number(),
	updatedAt: v.number(),
	sources: v.array(v.number())
});

export const DiscordAccountInfoSchema = v.object({
	id: v.string(),
	detectedAt: v.nullable(v.number()),
	updatedAt: v.nullable(v.number()),
	servers: v.array(DiscordServerInfoSchema),
	sources: v.array(v.number())
});

export const RobloxUserDiscordLookupSchema = v.object({
	robloxUserId: v.number(),
	discordAccounts: v.array(DiscordAccountInfoSchema),
	altAccounts: v.array(RobloxAltAccountSchema)
});

const OutfitSnapshotByNameRawSchema = v.object({
	results: v.array(
		v.object({
			name: v.string(),
			urls: v.array(v.string())
		})
	)
});

const OutfitSnapshotByIdRawSchema = v.object({
	results: v.array(
		v.object({
			outfitId: v.string(),
			urls: v.array(v.string())
		})
	)
});

export const MembershipStatusSchema = v.object({
	tier: v.picklist([1, 2, 3]),
	tierName: v.picklist(['Supporter', 'Patron', 'Benefactor']),
	associatedRobloxUserId: v.number(),
	badgeDesign: v.number(),
	iconDesign: v.number(),
	textDesign: v.number(),
	queueLimit: v.number(),
	outfitLimit: v.number(),
	rateLimit: v.number(),
	createdAt: v.number(),
	updatedAt: v.number()
});

export const MembershipVerificationChallengeSchema = v.object({
	robloxUserId: v.number(),
	phrase: v.string(),
	instructions: v.string()
});

export const parseUserStatus = v.parser(UserStatusSchema);
export const parseUserStatusMap = v.parser(v.record(v.string(), UserStatusSchema));
export const parseGroupStatus = v.parser(GroupStatusSchema);
export const parseGroupStatusMap = v.parser(v.record(v.string(), GroupStatusSchema));
export const parseVoteData = v.parser(VoteDataSchema);
export const parseQueueResult = v.parser(QueueResultSchema);
export const parseQueueLimits = v.parser(QueueLimitsSchema);
export const parseQueueStatusResponse = v.parser(v.record(v.string(), QueueStatusItemSchema));
export const parseGroupTrackedUsers = v.parser(GroupTrackedUsersSchema);
export const parseRobloxUserDiscordLookup = v.parser(RobloxUserDiscordLookupSchema);
export const parseOutfitSnapshotByName = v.parser(OutfitSnapshotByNameRawSchema);
export const parseOutfitSnapshotById = v.parser(OutfitSnapshotByIdRawSchema);
export const parseMembershipStatus = v.parser(MembershipStatusSchema);
export const parseMembershipVerificationChallenge = v.parser(MembershipVerificationChallengeSchema);
