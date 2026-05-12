import type { MembershipBadgeUpdatePayload, MeSettingsPatch } from '@/lib/types/api';
import type { ContentMessage } from '@/lib/schemas/content-message';
import { API_ACTIONS } from '@/lib/types/constants';
import {
	getUnprocessedUserIdsFromStorage,
	isUserBeingProcessedInStorage
} from '@/lib/utils/queue-history-storage';
import {
	checkGroupStatus,
	checkMultipleGroups,
	checkMultipleUsers,
	checkUserStatus,
	getGroupTrackedUsers,
	getQueueLimits,
	getStats,
	getVotes,
	lookupRobloxUserDiscord,
	queueUser,
	submitVote
} from './endpoints/core';
import { fetchOutfitImages, lookupOutfitsById, lookupOutfitsByName } from './endpoints/outfits';
import {
	clearMembershipBadge,
	confirmMembershipVerification,
	getMembershipStatus,
	getMembershipVerification,
	updateMembershipBadge
} from './endpoints/extension';
import { customApiCheckUser, customApiCheckMultipleUsers } from './endpoints/custom';
import { exportGroupTrackedUsers } from './endpoints/export';
import { translateTexts } from './endpoints/translate';
import {
	exchangeMembershipForSession,
	logoutAllRobloxAuth,
	logoutRobloxAuth,
	requestRobloxAuthChallenge,
	verifyRobloxAuth
} from './endpoints/roblox-auth';
import {
	getMeProfile,
	listMeSessions,
	refreshMeIdentity,
	revokeMeSession,
	updateMeSettings
} from './endpoints/me';
import { getLeaderboard } from './endpoints/leaderboard';

// Dispatches a validated content message to its endpoint handler. Required-field
// validation lives in the schema (`ContentMessageSchema`), so handlers here
// receive narrowed payloads and only encode action-specific orchestration.
export async function dispatchContentMessage(msg: ContentMessage): Promise<unknown> {
	switch (msg.action) {
		case API_ACTIONS.CHECK_USER_STATUS: {
			if (msg.apiConfig) {
				return customApiCheckUser(msg.apiConfig, msg.userId);
			}
			// Use primary database if user is queued but not yet processed
			const userId = typeof msg.userId === 'string' ? parseInt(msg.userId, 10) : msg.userId;
			const readPrimary = await isUserBeingProcessedInStorage(userId);
			return checkUserStatus(msg.userId, msg.clientId, readPrimary);
		}
		case API_ACTIONS.CHECK_GROUP_STATUS:
			return checkGroupStatus(msg.groupId, msg.clientId);
		case API_ACTIONS.CHECK_MULTIPLE_USERS: {
			if (msg.apiConfig) {
				return customApiCheckMultipleUsers(msg.apiConfig, msg.userIds);
			}
			// Use primary database if any user is queued but not yet processed
			const userIds = msg.userIds.map((id) => (typeof id === 'string' ? parseInt(id, 10) : id));
			const readPrimary = (await getUnprocessedUserIdsFromStorage(userIds)).length > 0;
			return checkMultipleUsers(msg.userIds, msg.clientId, msg.lookupContext, readPrimary);
		}
		case API_ACTIONS.CHECK_MULTIPLE_GROUPS:
			return checkMultipleGroups(msg.groupIds, msg.clientId, msg.lookupContext);
		case API_ACTIONS.GET_GROUP_TRACKED_USERS:
			return getGroupTrackedUsers(msg.groupId, msg.cursor, msg.limit, msg.active);
		case API_ACTIONS.QUEUE_USER:
			return queueUser(
				msg.userId,
				msg.outfitNames ?? [],
				msg.outfitIds ?? [],
				msg.inappropriateProfile,
				msg.inappropriateFriends,
				msg.inappropriateGroups,
				msg.clientId,
				msg.captchaToken
			);
		case API_ACTIONS.GET_QUEUE_LIMITS:
			return getQueueLimits(msg.clientId);
		case API_ACTIONS.SUBMIT_VOTE:
			return submitVote(msg.userId, msg.voteType, msg.clientId);
		case API_ACTIONS.GET_VOTES:
			return getVotes(msg.userId, msg.clientId);
		case API_ACTIONS.GET_STATS:
			return getStats(msg.hours);
		case API_ACTIONS.EXTENSION_GET_MEMBERSHIP_STATUS:
			return getMembershipStatus();
		case API_ACTIONS.EXTENSION_UPDATE_MEMBERSHIP_BADGE: {
			const payload: MembershipBadgeUpdatePayload = {
				...(msg.badgeDesign !== undefined && { badgeDesign: msg.badgeDesign }),
				...(msg.iconDesign !== undefined && { iconDesign: msg.iconDesign }),
				...(msg.textDesign !== undefined && { textDesign: msg.textDesign })
			};
			if (Object.keys(payload).length === 0) {
				throw new Error('Provide at least one of badgeDesign, iconDesign, or textDesign.');
			}
			return updateMembershipBadge(payload);
		}
		case API_ACTIONS.EXTENSION_CLEAR_MEMBERSHIP_BADGE:
			return clearMembershipBadge();
		case API_ACTIONS.EXTENSION_GET_MEMBERSHIP_VERIFICATION:
			return getMembershipVerification(msg.robloxUserId);
		case API_ACTIONS.EXTENSION_CONFIRM_MEMBERSHIP_VERIFICATION:
			return confirmMembershipVerification(msg.robloxUserId);
		case API_ACTIONS.LOOKUP_ROBLOX_USER_DISCORD:
			return lookupRobloxUserDiscord(msg.userId, msg.clientId);
		case API_ACTIONS.LOOKUP_OUTFITS_BY_NAME:
			return lookupOutfitsByName(msg.userId, msg.names, msg.clientId);
		case API_ACTIONS.LOOKUP_OUTFITS_BY_ID:
			return lookupOutfitsById(msg.userId, msg.ids, msg.clientId);
		case API_ACTIONS.FETCH_OUTFIT_IMAGES:
			return fetchOutfitImages(msg.imageUrls);
		case API_ACTIONS.EXPORT_GROUP_TRACKED_USERS:
			return exportGroupTrackedUsers(msg.groupId, {
				format: msg.exportFormat,
				columns: msg.exportColumns,
				sort: msg.exportSort,
				order: msg.exportOrder
			});
		case API_ACTIONS.TRANSLATE_TEXT:
			return translateTexts(msg.texts, msg.targetLanguage, msg.sourceLanguage);
		case API_ACTIONS.HAS_TRANSLATE_PERMISSION: {
			const hasPermission = await browser.permissions.contains({
				origins: ['https://translate.googleapis.com/*']
			});
			return { hasPermission };
		}
		case API_ACTIONS.REQUEST_TRANSLATE_PERMISSION: {
			const granted = await browser.permissions.request({
				origins: ['https://translate.googleapis.com/*']
			});
			return { granted };
		}
		case API_ACTIONS.ROBLOX_AUTH_CHALLENGE:
			return requestRobloxAuthChallenge(msg.robloxUserId);
		case API_ACTIONS.ROBLOX_AUTH_VERIFY:
			return verifyRobloxAuth(msg.challengeId);
		case API_ACTIONS.ROBLOX_AUTH_EXCHANGE:
			return exchangeMembershipForSession();
		case API_ACTIONS.ROBLOX_AUTH_LOGOUT:
			return logoutRobloxAuth();
		case API_ACTIONS.ROBLOX_AUTH_LOGOUT_ALL:
			return logoutAllRobloxAuth();
		case API_ACTIONS.ME_GET_PROFILE:
			return getMeProfile();
		case API_ACTIONS.ME_UPDATE_SETTINGS: {
			const patch: MeSettingsPatch = {};
			if (msg.alias !== undefined) patch.alias = msg.alias;
			if (msg.showUsername !== undefined) patch.show_username = msg.showUsername;
			if (msg.showThumbnail !== undefined) patch.show_thumbnail = msg.showThumbnail;
			if (Object.keys(patch).length === 0) {
				throw new Error('Provide at least one settings field to update.');
			}
			return updateMeSettings(patch);
		}
		case API_ACTIONS.ME_REFRESH_IDENTITY:
			return refreshMeIdentity();
		case API_ACTIONS.ME_LIST_SESSIONS:
			return listMeSessions();
		case API_ACTIONS.ME_REVOKE_SESSION:
			return revokeMeSession(msg.sessionId);
		case API_ACTIONS.GET_LEADERBOARD:
			return getLeaderboard(msg.window, msg.limit, msg.cursor);
	}
}
