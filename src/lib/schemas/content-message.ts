import * as v from 'valibot';
import { API_ACTIONS, CAPTCHA_MESSAGES } from '@/lib/types/constants';
import { PersistedCustomApiSchema } from './custom-api';

const UserId = v.union([v.string(), v.number()]);
const ClientId = v.optional(v.string());

const QueueDataSchema = v.object({
	userId: v.string(),
	outfitNames: v.array(v.string()),
	outfitIds: v.optional(v.array(v.number())),
	inappropriateProfile: v.boolean(),
	inappropriateFriends: v.boolean(),
	inappropriateGroups: v.boolean()
});

const CaptchaStartMessageSchema = v.object({
	type: v.literal(CAPTCHA_MESSAGES.CAPTCHA_START),
	sessionId: v.string(),
	queueData: QueueDataSchema
});

const ContentMessageSchema = v.variant('action', [
	v.object({
		action: v.literal(API_ACTIONS.CHECK_USER_STATUS),
		userId: UserId,
		apiConfig: v.optional(PersistedCustomApiSchema),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.CHECK_GROUP_STATUS),
		groupId: UserId,
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.CHECK_MULTIPLE_USERS),
		userIds: v.array(UserId),
		apiConfig: v.optional(PersistedCustomApiSchema),
		lookupContext: v.optional(v.string()),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.CHECK_MULTIPLE_GROUPS),
		groupIds: v.array(UserId),
		lookupContext: v.optional(v.string()),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.GET_GROUP_TRACKED_USERS),
		groupId: UserId,
		cursor: v.optional(v.string()),
		limit: v.optional(v.number()),
		active: v.optional(v.picklist(['true', 'false'])),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.QUEUE_USER),
		userId: UserId,
		outfitNames: v.optional(v.array(v.string())),
		outfitIds: v.optional(v.array(v.number())),
		inappropriateProfile: v.optional(v.boolean()),
		inappropriateFriends: v.optional(v.boolean()),
		inappropriateGroups: v.optional(v.boolean()),
		captchaToken: v.optional(v.string()),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.GET_QUEUE_LIMITS),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.SUBMIT_VOTE),
		userId: UserId,
		voteType: v.number(),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.GET_VOTES),
		userId: UserId,
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.GET_STATS),
		hours: v.picklist([24, 168, 720]),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.EXTENSION_GET_MEMBERSHIP_STATUS),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.EXTENSION_UPDATE_MEMBERSHIP_BADGE),
		badgeDesign: v.optional(v.number()),
		iconDesign: v.optional(v.number()),
		textDesign: v.optional(v.number()),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.EXTENSION_CLEAR_MEMBERSHIP_BADGE),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.EXTENSION_GET_MEMBERSHIP_VERIFICATION),
		robloxUserId: v.pipe(v.number(), v.minValue(1)),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.EXTENSION_CONFIRM_MEMBERSHIP_VERIFICATION),
		robloxUserId: v.pipe(v.number(), v.minValue(1)),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.LOOKUP_ROBLOX_USER_DISCORD),
		userId: UserId,
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.LOOKUP_OUTFITS_BY_NAME),
		userId: UserId,
		names: v.pipe(v.array(v.string()), v.minLength(1)),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.LOOKUP_OUTFITS_BY_ID),
		userId: UserId,
		ids: v.pipe(v.array(v.string()), v.minLength(1)),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.FETCH_OUTFIT_IMAGES),
		imageUrls: v.pipe(v.array(v.string()), v.minLength(1)),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.EXPORT_GROUP_TRACKED_USERS),
		groupId: UserId,
		exportFormat: v.picklist(['json', 'csv']),
		exportColumns: v.pipe(v.array(v.string()), v.minLength(1)),
		exportSort: v.string(),
		exportOrder: v.picklist(['asc', 'desc']),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.TRANSLATE_TEXT),
		texts: v.pipe(v.array(v.string()), v.minLength(1)),
		targetLanguage: v.string(),
		sourceLanguage: v.optional(v.string()),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.HAS_TRANSLATE_PERMISSION),
		clientId: ClientId
	}),
	v.object({
		action: v.literal(API_ACTIONS.REQUEST_TRANSLATE_PERMISSION),
		clientId: ClientId
	})
]);

export type ContentMessage = v.InferOutput<typeof ContentMessageSchema>;
export type CaptchaStartMessage = v.InferOutput<typeof CaptchaStartMessageSchema>;

export const safeParseContentMessage = v.safeParser(ContentMessageSchema);
export const safeParseCaptchaStartMessage = v.safeParser(CaptchaStartMessageSchema);
