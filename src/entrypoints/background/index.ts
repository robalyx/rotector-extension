import type { ApiResponse, CaptchaSession, ContentMessage } from '@/lib/types/api';
import type { QueueHistoryEntry } from '@/lib/types/queue-history';
import {
	API_ACTIONS,
	API_CONFIG,
	CAPTCHA_EXTERNAL_MESSAGES,
	CAPTCHA_MESSAGES
} from '@/lib/types/constants';
import { getAssetUrl } from '@/lib/utils/assets';
import { logger } from '@/lib/utils/logger';
import {
	loadQueueHistory,
	unprocessedEntries,
	updateEntryStatus,
	markAsNotified
} from '@/lib/stores/queue-history';
import { get } from 'svelte/store';
import { actionHandlers } from './handlers';
import { createErrorResponse, initializeSettings } from './utils';
import { t } from '@/lib/utils/i18n';

const POLL_INTERVAL = 30000; // 30 seconds
let pollIntervalId: ReturnType<typeof setInterval> | null = null;
let isPolling = false;

const activeCaptchaSessions = new Set<string>();

// Send notification when queue processing completes
async function sendQueueNotification(entry: QueueHistoryEntry): Promise<void> {
	const notificationId = `queue-${entry.userId}-${Date.now()}`;

	try {
		const titleKey = entry.flagged
			? 'queue_notification_flagged_title'
			: 'queue_notification_safe_title';
		const messageKey = entry.flagged
			? 'queue_notification_flagged_message'
			: 'queue_notification_safe_message';

		const [title, message] = await Promise.all([t(titleKey), t(messageKey, { 0: entry.userId })]);

		await browser.notifications.create(notificationId, {
			type: 'basic',
			iconUrl: getAssetUrl('/icon/48.png'),
			title,
			message,
			priority: entry.flagged ? 2 : 0
		});
		logger.debug('Queue notification sent:', { userId: entry.userId, flagged: entry.flagged });
	} catch (error) {
		logger.error('Failed to create notification:', error);
	}
}

// Poll queue status for unprocessed entries
async function pollQueueStatus(): Promise<void> {
	if (isPolling) return;
	isPolling = true;

	try {
		const unprocessed = get(unprocessedEntries);

		if (unprocessed.length === 0) {
			stopPolling();
			return;
		}

		const userIds = unprocessed.map((e) => e.userId);

		const handler = actionHandlers[API_ACTIONS.GET_QUEUE_STATUS];
		const response = await handler({ action: API_ACTIONS.GET_QUEUE_STATUS, userIds });

		for (const [userIdStr, status] of Object.entries(response)) {
			if (!status.queued) continue;

			const completedEntry = await updateEntryStatus(parseInt(userIdStr, 10), status);

			if (completedEntry && !completedEntry.notified) {
				await sendQueueNotification(completedEntry);
				await markAsNotified(completedEntry.userId);
			}
		}
	} catch (error) {
		logger.error('Queue status poll failed:', error);
	} finally {
		isPolling = false;
	}
}

// Start polling if needed
function startPollingIfNeeded(): void {
	const unprocessed = get(unprocessedEntries);

	if (unprocessed.length === 0 || pollIntervalId) return;

	logger.debug('Starting queue status polling');
	void pollQueueStatus(); // Immediate first poll
	pollIntervalId = setInterval(() => void pollQueueStatus(), POLL_INTERVAL);
}

// Stop polling
function stopPolling(): void {
	if (pollIntervalId) {
		clearInterval(pollIntervalId);
		pollIntervalId = null;
		logger.debug('Stopped queue status polling');
	}
}

// Initialize queue polling
async function initializeQueuePolling(): Promise<void> {
	await loadQueueHistory();
	startPollingIfNeeded();

	// Subscribe to changes to start/stop polling
	unprocessedEntries.subscribe((entries) => {
		if (entries.length > 0 && !pollIntervalId) {
			startPollingIfNeeded();
		} else if (entries.length === 0 && pollIntervalId) {
			stopPolling();
		}
	});
}

// Handle captcha start by storing session and opening popup
async function handleCaptchaStart(
	request: {
		sessionId?: string;
		queueData?: Omit<CaptchaSession, 'sessionId' | 'senderTabId' | 'timestamp'>;
	},
	senderTabId?: number
): Promise<void> {
	const { sessionId, queueData } = request;

	if (!sessionId || !queueData) {
		throw new Error('Missing sessionId or queueData for captcha start');
	}

	// Store pending captcha session
	const session: CaptchaSession = {
		sessionId,
		...queueData,
		senderTabId,
		timestamp: Date.now()
	};
	await browser.storage.local.set({
		[`captcha_session_${sessionId}`]: session
	});

	// Build captcha URL
	const captchaUrl = new URL(`${API_CONFIG.BASE_URL}/captcha`);
	captchaUrl.searchParams.set('session', sessionId);

	// Open captcha popup
	await browser.windows.create({
		url: captchaUrl.toString(),
		type: 'popup',
		width: 450,
		height: 550,
		focused: true
	});

	logger.info('Captcha popup opened for session:', sessionId);
}

// Handle captcha success from backend
async function handleCaptchaSuccess(
	sessionId: string,
	token: string,
	sender: { tab?: { id?: number } }
): Promise<void> {
	// Skip if this session is already being processed
	if (activeCaptchaSessions.has(sessionId)) {
		return;
	}
	activeCaptchaSessions.add(sessionId);

	try {
		const storageKey = `captcha_session_${sessionId}`;
		const result = await browser.storage.local.get(storageKey);
		const session = result[storageKey] as CaptchaSession | undefined;

		if (!session) {
			logger.error('Captcha session not found:', sessionId);
			return;
		}

		// Check session expiry (10 minutes)
		if (Date.now() - session.timestamp > 600000) {
			logger.error('Captcha session expired:', sessionId);
			await browser.storage.local.remove([storageKey]);
			return;
		}

		await browser.storage.local.remove([storageKey]);

		// Close the captcha popup tab
		if (sender.tab?.id) {
			await browser.tabs.remove(sender.tab.id).catch(() => {});
		}

		// Send token to the originating content script tab
		const message = {
			type: CAPTCHA_MESSAGES.CAPTCHA_TOKEN_READY,
			token,
			sessionId,
			queueData: {
				userId: session.userId,
				outfitNames: session.outfitNames,
				inappropriateProfile: session.inappropriateProfile,
				inappropriateFriends: session.inappropriateFriends,
				inappropriateGroups: session.inappropriateGroups
			}
		};

		if (session.senderTabId !== undefined) {
			await browser.tabs.sendMessage(session.senderTabId, message).catch((err) => {
				logger.error('Failed to deliver captcha token to content script:', err);
			});
		} else {
			logger.error('No sender tab ID in captcha session — cannot deliver token');
		}

		logger.info('Captcha completed for session:', sessionId);
	} finally {
		activeCaptchaSessions.delete(sessionId);
	}
}

// Handle captcha error from backend
async function handleCaptchaError(
	sessionId: string | undefined,
	error: string | undefined,
	sender: { tab?: { id?: number } }
): Promise<void> {
	// Retrieve session to get originating tab ID
	let senderTabId: number | undefined;
	if (sessionId) {
		const storageKey = `captcha_session_${sessionId}`;
		const result = await browser.storage.local.get(storageKey);
		const session = result[storageKey] as CaptchaSession | undefined;
		senderTabId = session?.senderTabId;
		await browser.storage.local.remove([storageKey]);
	}

	// Close the captcha popup tab
	if (sender.tab?.id) {
		await browser.tabs.remove(sender.tab.id).catch(() => {});
	}

	// Notify the originating content script of cancellation
	if (senderTabId !== undefined) {
		const message = {
			type: CAPTCHA_MESSAGES.CAPTCHA_CANCELLED,
			error,
			sessionId
		};
		await browser.tabs.sendMessage(senderTabId, message).catch((err) => {
			logger.error('Failed to deliver captcha cancellation to content script:', err);
		});
	}

	logger.error('Captcha verification failed:', error);
}

// Clear developer logs and performance entries on startup to prevent unbounded growth
async function clearDevDataOnStartup(): Promise<void> {
	try {
		await browser.storage.local.remove(['developerLogs', 'performanceEntries']);
		logger.debug('Developer logs and performance entries cleared on startup');
	} catch (error) {
		logger.warn('Failed to clear dev data on startup:', error);
	}
}

export default defineBackground(() => {
	logger.info('Rotector Background Script: Starting...', {
		id: browser.runtime.id
	});

	clearDevDataOnStartup().catch((err) => {
		logger.warn('Failed to clear dev data:', err);
	});

	initializeSettings().catch((err) => {
		logger.error('Failed to initialize settings:', err);
	});

	initializeQueuePolling().catch((err) => {
		logger.error('Failed to initialize queue polling:', err);
	});

	// Handle runtime messages from content scripts and popup
	browser.runtime.onMessage.addListener(
		(
			request: ContentMessage & {
				type?: string;
				sessionId?: string;
				token?: string;
				session?: string;
				error?: string;
			},
			sender,
			sendResponse: (response: ApiResponse) => void
		) => {
			void (async () => {
				try {
					// Handle bridged captcha messages from roscoe-bridge content script
					if (
						request.type === CAPTCHA_EXTERNAL_MESSAGES.SUCCESS &&
						request.token &&
						request.session
					) {
						await handleCaptchaSuccess(request.session, request.token, sender);
						return;
					}

					if (request.type === CAPTCHA_EXTERNAL_MESSAGES.ERROR) {
						await handleCaptchaError(request.session, request.error, sender);
						return;
					}

					// Handle captcha start message
					if (request.type === CAPTCHA_MESSAGES.CAPTCHA_START) {
						await handleCaptchaStart(request, sender.tab?.id);
						sendResponse({ success: true });
						return;
					}

					// Handle API actions
					const handler = actionHandlers[request.action as keyof typeof actionHandlers];

					if (!handler) {
						throw new Error(`Unknown action: ${request.action}`);
					}

					const response = await handler(request);

					sendResponse({ success: true, data: response });
					logger.debug(`Successfully handled action: ${request.action}`);
				} catch (error) {
					logger.error(`Background script error for action ${request.action}:`, error);
					sendResponse(createErrorResponse(error as Error));
				}
			})();

			// Return true to indicate we will respond asynchronously
			return true;
		}
	);

	// Listen for external messages from captcha pages
	browser.runtime.onMessageExternal.addListener(
		(
			message: {
				type: string;
				token?: string;
				session?: string;
				error?: string;
			},
			sender,
			_sendResponse
		) => {
			void (async () => {
				try {
					if (
						message.type === CAPTCHA_EXTERNAL_MESSAGES.SUCCESS &&
						message.token &&
						message.session
					) {
						await handleCaptchaSuccess(message.session, message.token, sender);
						return;
					}

					if (message.type === CAPTCHA_EXTERNAL_MESSAGES.ERROR) {
						await handleCaptchaError(message.session, message.error, sender);
					}
				} catch (error) {
					logger.error('External message handling failed:', error);
				}
			})();

			return true;
		}
	);

	logger.info('Rotector Background Script: Initialization complete');
});
