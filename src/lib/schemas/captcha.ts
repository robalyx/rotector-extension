import * as v from 'valibot';
import { CAPTCHA_EXTERNAL_MESSAGES } from '../types/constants';

const CaptchaSessionSchema = v.object({
	sessionId: v.string(),
	userId: v.string(),
	outfitNames: v.array(v.string()),
	outfitIds: v.optional(v.array(v.number())),
	inappropriateProfile: v.boolean(),
	inappropriateFriends: v.boolean(),
	inappropriateGroups: v.boolean(),
	senderTabId: v.optional(v.number()),
	timestamp: v.number()
});

// Inbound message from the roscoe-bridge content script
const CaptchaExternalMessageSchema = v.variant('type', [
	v.object({
		type: v.literal(CAPTCHA_EXTERNAL_MESSAGES.SUCCESS),
		token: v.string(),
		session: v.string()
	}),
	v.object({
		type: v.literal(CAPTCHA_EXTERNAL_MESSAGES.ERROR),
		session: v.optional(v.string()),
		error: v.optional(v.string())
	})
]);

export const isCaptchaSession = (
	value: unknown
): value is v.InferOutput<typeof CaptchaSessionSchema> => v.is(CaptchaSessionSchema, value);

export const safeParseCaptchaExternalMessage = (value: unknown) =>
	v.safeParse(CaptchaExternalMessageSchema, value);
