import type { ContentMessage } from '@/lib/types/api';
import { API_ACTIONS } from '@/lib/types/constants';
import { isUserBeingProcessed, getUnprocessedUserIds } from '@/lib/stores/queue-history';
import {
	checkGroupStatus,
	checkMultipleGroups,
	checkMultipleUsers,
	checkUserStatus,
	getGroupTrackedUsers,
	getMultipleVotes,
	getQueueLimits,
	getQueueStatus,
	getStatistics,
	getVotes,
	lookupRobloxUserDiscord,
	queueUser,
	submitVote
} from './endpoints/core';
import {
	getDiscordLoginUrl,
	getExtensionProfile,
	getExtensionReports,
	getExtensionStatistics,
	getLeaderboard,
	getReportableUser,
	resetExtensionUuid,
	submitExtensionReport,
	updateExtensionAnonymous
} from './endpoints/extension';
import {
	getGlobalStatisticsHistory,
	getWarMap,
	getWarOrder,
	getWarOrders,
	getWarZone,
	getWarZoneStatistics
} from './endpoints/war';
import { customApiCheckUser, customApiCheckMultipleUsers } from './endpoints/custom';
import { translateTexts } from './endpoints/translate';

// Action handlers with validation
export const actionHandlers = {
	[API_ACTIONS.CHECK_USER_STATUS]: async (request: ContentMessage) => {
		if (!request.userId) throw new Error('User ID is required for check user status');
		if (request.apiConfig) {
			return customApiCheckUser(request.apiConfig, request.userId);
		}
		// Use primary database if user is queued but not yet processed
		const userId =
			typeof request.userId === 'string' ? parseInt(request.userId, 10) : request.userId;
		const readPrimary = isUserBeingProcessed(userId);
		return checkUserStatus(request.userId, request.clientId, readPrimary);
	},
	[API_ACTIONS.CHECK_GROUP_STATUS]: async (request: ContentMessage) => {
		if (!request.groupId) throw new Error('Group ID is required for check group status');
		return checkGroupStatus(request.groupId, request.clientId);
	},
	[API_ACTIONS.CHECK_MULTIPLE_USERS]: async (request: ContentMessage) => {
		if (!request.userIds) throw new Error('User IDs are required for check multiple users');
		if (request.apiConfig) {
			return customApiCheckMultipleUsers(request.apiConfig, request.userIds);
		}
		// Use primary database if any user is queued but not yet processed
		const userIds = request.userIds.map((id) => (typeof id === 'string' ? parseInt(id, 10) : id));
		const readPrimary = getUnprocessedUserIds(userIds).length > 0;
		return checkMultipleUsers(
			request.userIds,
			request.clientId,
			request.lookupContext,
			readPrimary
		);
	},
	[API_ACTIONS.CHECK_MULTIPLE_GROUPS]: async (request: ContentMessage) => {
		if (!request.groupIds) throw new Error('Group IDs are required for check multiple groups');
		return checkMultipleGroups(request.groupIds, request.clientId, request.lookupContext);
	},
	[API_ACTIONS.GET_GROUP_TRACKED_USERS]: async (request: ContentMessage) => {
		if (!request.groupId) throw new Error('Group ID is required for get group tracked users');
		return getGroupTrackedUsers(request.groupId, request.cursor, request.limit);
	},
	[API_ACTIONS.QUEUE_USER]: async (request: ContentMessage) => {
		if (!request.userId) throw new Error('User ID is required for queue user');
		return queueUser(
			request.userId,
			request.outfitNames ?? [],
			request.inappropriateProfile,
			request.inappropriateFriends,
			request.inappropriateGroups,
			request.clientId,
			request.captchaToken
		);
	},
	[API_ACTIONS.GET_QUEUE_LIMITS]: async (request: ContentMessage) =>
		getQueueLimits(request.clientId),
	[API_ACTIONS.GET_QUEUE_STATUS]: async (request: ContentMessage) => {
		if (!request.userIds || request.userIds.length === 0) {
			throw new Error('User IDs are required for queue status check');
		}
		return getQueueStatus(
			request.userIds.map((id) => (typeof id === 'string' ? parseInt(id, 10) : id)),
			request.clientId
		);
	},
	[API_ACTIONS.SUBMIT_VOTE]: async (request: ContentMessage) => {
		if (!request.userId || request.voteType === undefined || request.voteType === null)
			throw new Error('User ID and vote type are required for submit vote');
		return submitVote(request.userId, request.voteType, request.clientId);
	},
	[API_ACTIONS.GET_VOTES]: async (request: ContentMessage) => {
		if (!request.userId) throw new Error('User ID is required for get votes');
		return getVotes(request.userId, request.clientId);
	},
	[API_ACTIONS.GET_MULTIPLE_VOTES]: async (request: ContentMessage) => {
		if (!request.userIds) throw new Error('User IDs are required for get multiple votes');
		return getMultipleVotes(request.userIds, request.clientId);
	},
	[API_ACTIONS.GET_STATISTICS]: async () => getStatistics(),

	[API_ACTIONS.EXTENSION_GET_PROFILE]: async () => getExtensionProfile(),
	[API_ACTIONS.EXTENSION_UPDATE_ANONYMOUS]: async (request: ContentMessage) => {
		if (request.isAnonymous === undefined) {
			throw new Error('Anonymous status is required');
		}
		return updateExtensionAnonymous(request.isAnonymous);
	},
	[API_ACTIONS.EXTENSION_RESET_UUID]: async () => resetExtensionUuid(),
	[API_ACTIONS.INITIATE_DISCORD_LOGIN]: async () => {
		const { authUrl, state } = await getDiscordLoginUrl();

		// Store OAuth state to prevent CSRF attacks
		await browser.storage.local.set({
			discordOAuthState: state,
			discordOAuthTimestamp: Date.now()
		});

		await browser.tabs.create({ url: authUrl });
		return { success: true };
	},
	[API_ACTIONS.EXTENSION_SUBMIT_REPORT]: async (request: ContentMessage) => {
		if (!request.reportedUserId || request.reportedUserId <= 0) {
			throw new Error('Invalid user ID provided.');
		}
		return submitExtensionReport(request.reportedUserId, request.reportReason);
	},
	[API_ACTIONS.EXTENSION_GET_REPORTS]: async (request: ContentMessage) =>
		getExtensionReports(request.limit, request.offset, request.status),
	[API_ACTIONS.EXTENSION_GET_REPORTABLE_USER]: async () => getReportableUser(),
	[API_ACTIONS.EXTENSION_GET_STATISTICS]: async () => getExtensionStatistics(),

	[API_ACTIONS.WAR_GET_ZONE_STATS]: async (request: ContentMessage) => {
		if (typeof request.zoneId !== 'number' || request.zoneId < 0) {
			throw new Error('Invalid zone ID provided.');
		}
		return getWarZoneStatistics(request.zoneId);
	},
	[API_ACTIONS.WAR_GET_ORDERS]: async () => getWarOrders(),
	[API_ACTIONS.WAR_GET_ORDER]: async (request: ContentMessage) => {
		if (!request.orderId || request.orderId <= 0) {
			throw new Error('Invalid order ID provided.');
		}
		return getWarOrder(request.orderId);
	},
	[API_ACTIONS.WAR_GET_STATS_HISTORY]: async () => getGlobalStatisticsHistory(),
	[API_ACTIONS.WAR_GET_MAP]: async () => getWarMap(),
	[API_ACTIONS.WAR_GET_ZONE]: async (request: ContentMessage) => {
		if (typeof request.zoneId !== 'number' || request.zoneId < 0) {
			throw new Error('Invalid zone ID provided.');
		}
		return getWarZone(request.zoneId);
	},
	[API_ACTIONS.EXTENSION_GET_LEADERBOARD]: async (request: ContentMessage) =>
		getLeaderboard(request.limit, request.includeAnonymous),
	[API_ACTIONS.LOOKUP_ROBLOX_USER_DISCORD]: async (request: ContentMessage) => {
		if (!request.userId) throw new Error('User ID is required for Discord lookup');
		return lookupRobloxUserDiscord(request.userId, request.clientId);
	},
	[API_ACTIONS.TRANSLATE_TEXT]: async (request: ContentMessage) => {
		if (!request.texts || request.texts.length === 0) {
			throw new Error('Texts are required for translation');
		}
		if (!request.targetLanguage) {
			throw new Error('Target language is required for translation');
		}
		return translateTexts(request.texts, request.targetLanguage, request.sourceLanguage);
	},
	[API_ACTIONS.HAS_TRANSLATE_PERMISSION]: async () => {
		const result = await browser.permissions.contains({
			origins: ['https://translate.googleapis.com/*']
		});
		return { hasPermission: result };
	},
	[API_ACTIONS.REQUEST_TRANSLATE_PERMISSION]: async () => {
		const granted = await browser.permissions.request({
			origins: ['https://translate.googleapis.com/*']
		});
		return { granted };
	}
} as const;
