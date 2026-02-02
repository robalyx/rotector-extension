import type {
	ApiResponse,
	CaptchaSession,
	ContentMessage,
	ExtensionUserProfile
} from '@/lib/types/api';
import type { QueueHistoryEntry } from '@/lib/types/queue-history';
import {
	API_ACTIONS,
	API_CONFIG,
	CAPTCHA_EXTERNAL_MESSAGES,
	CAPTCHA_MESSAGES,
	DISCORD_OAUTH_MESSAGES
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
async function handleCaptchaStart(request: {
	sessionId?: string;
	queueData?: Omit<CaptchaSession, 'sessionId' | 'timestamp'>;
}): Promise<void> {
	const { sessionId, queueData } = request;

	if (!sessionId || !queueData) {
		throw new Error('Missing sessionId or queueData for captcha start');
	}

	// Store pending captcha session
	const session: CaptchaSession = {
		sessionId,
		...queueData,
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
	const storageKey = `captcha_session_${sessionId}`;
	const inProgressKey = `captcha_in_progress_${sessionId}`;
	const result = await browser.storage.local.get([storageKey, inProgressKey]);

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

	// Prevent duplicate processing of the same session
	if (result[inProgressKey]) {
		logger.warn('Captcha already being processed for session:', sessionId);
		return;
	}

	await browser.storage.local.set({ [inProgressKey]: true });

	try {
		// Clean up session
		await browser.storage.local.remove([storageKey]);

		// Close the captcha popup tab
		if (sender.tab?.id) {
			await browser.tabs.remove(sender.tab.id).catch(() => {});
		}

		// Broadcast token to content scripts in Roblox tabs
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

		const tabs = await browser.tabs.query({ url: '*://*.roblox.com/*' });
		for (const tab of tabs) {
			if (tab.id) {
				browser.tabs.sendMessage(tab.id, message).catch(() => {
					// Tab may not have content script loaded
				});
			}
		}

		logger.info('Captcha completed for session:', sessionId);
	} finally {
		await browser.storage.local.remove([inProgressKey]);
	}
}

// Handle captcha error from backend
async function handleCaptchaError(
	sessionId: string | undefined,
	error: string | undefined,
	sender: { tab?: { id?: number } }
): Promise<void> {
	if (sessionId) {
		await browser.storage.local.remove([`captcha_session_${sessionId}`]);
	}

	// Close the captcha popup tab
	if (sender.tab?.id) {
		await browser.tabs.remove(sender.tab.id).catch(() => {});
	}

	// Notify content scripts of cancellation in Roblox tabs
	const message = {
		type: CAPTCHA_MESSAGES.CAPTCHA_CANCELLED,
		error,
		sessionId
	};

	const tabs = await browser.tabs.query({ url: '*://*.roblox.com/*' });
	for (const tab of tabs) {
		if (tab.id) {
			browser.tabs.sendMessage(tab.id, message).catch(() => {
				// Tab may not have content script loaded
			});
		}
	}

	logger.error('Captcha verification failed:', error);
}

export default defineBackground(() => {
	logger.info('Rotector Background Script: Starting...', {
		id: browser.runtime.id
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
			},
			_sender: unknown,
			sendResponse: (response: ApiResponse) => void
		) => {
			void (async () => {
				try {
					// Handle captcha start message
					if (request.type === CAPTCHA_MESSAGES.CAPTCHA_START) {
						await handleCaptchaStart(request);
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

	// Listen for external messages from OAuth callback and captcha pages
	browser.runtime.onMessageExternal.addListener(
		(
			message: {
				type: string;
				uuid?: string;
				user?: ExtensionUserProfile;
				error?: string;
				state?: string;
				isNewUser?: boolean;
				token?: string;
				session?: string;
			},
			sender,
			_sendResponse
		) => {
			void (async () => {
				try {
					// Handle captcha success from backend
					if (
						message.type === CAPTCHA_EXTERNAL_MESSAGES.SUCCESS &&
						message.token &&
						message.session
					) {
						await handleCaptchaSuccess(message.session, message.token, sender);
						return;
					}

					// Handle captcha error from backend
					if (message.type === CAPTCHA_EXTERNAL_MESSAGES.ERROR) {
						await handleCaptchaError(message.session, message.error, sender);
						return;
					}

					// Handle Discord OAuth success
					if (
						message.type === DISCORD_OAUTH_MESSAGES.AUTH_SUCCESS &&
						message.uuid &&
						message.user
					) {
						// Verify OAuth state parameter matches stored value
						if (!message.state) {
							logger.error('Discord OAuth callback missing required state parameter');
							if (sender.tab?.id) {
								await browser.tabs.remove(sender.tab.id);
							}
							return;
						}

						// Check for concurrent OAuth processing
						const result = await browser.storage.local.get([
							'discordOAuthState',
							'discordOAuthTimestamp',
							'oauthInProgress'
						]);

						if (result.oauthInProgress) {
							logger.warn('OAuth callback already in progress, rejecting duplicate request');
							if (sender.tab?.id) {
								await browser.tabs.remove(sender.tab.id);
							}
							return;
						}

						// Set lock to prevent concurrent processing
						await browser.storage.local.set({ oauthInProgress: true });

						try {
							const isExpired =
								(result.discordOAuthTimestamp as number) &&
								Date.now() - (result.discordOAuthTimestamp as number) > 600000;

							if (
								!result.discordOAuthState ||
								result.discordOAuthState !== message.state ||
								isExpired
							) {
								logger.error('OAuth state validation failed', {
									hasStoredState: !!result.discordOAuthState,
									stateMatch: (result.discordOAuthState as string) === message.state,
									isExpired
								});

								// Clear invalid state and close tab
								await browser.storage.local.remove(['discordOAuthState', 'discordOAuthTimestamp']);
								if (sender.tab?.id) {
									await browser.tabs.remove(sender.tab.id);
								}
								return;
							}

							// State is valid, remove it to prevent reuse
							await browser.storage.local.remove(['discordOAuthState', 'discordOAuthTimestamp']);

							// Store UUID from OAuth callback
							await browser.storage.local.set({ extension_uuid: message.uuid });

							// Close OAuth tab
							if (sender.tab?.id) {
								try {
									await browser.tabs.remove(sender.tab.id);
								} catch (error) {
									logger.warn('Failed to close OAuth tab:', error);
								}
							}

							// Notify components about successful authentication
							try {
								await browser.runtime.sendMessage({
									type: 'DISCORD_AUTH_COMPLETE',
									uuid: message.uuid,
									user: message.user,
									isNewUser: message.isNewUser
								});
							} catch (error) {
								logger.warn('Failed to notify components about Discord authentication:', error);
							}

							logger.info('Discord authentication successful', {
								discordUserId: message.user.discordUserId,
								discordUsername: message.user.discordUsername,
								isNewUser: message.isNewUser
							});
						} finally {
							// Always release the lock
							await browser.storage.local.remove(['oauthInProgress']);
						}
					} else if (message.type === DISCORD_OAUTH_MESSAGES.AUTH_ERROR) {
						// Close OAuth tab
						if (sender.tab?.id) {
							try {
								await browser.tabs.remove(sender.tab.id);
							} catch (error) {
								logger.warn('Failed to close OAuth tab:', error);
							}
						}

						logger.error('Discord OAuth error:', message.error ?? 'Unknown error');
					}
				} catch (error) {
					logger.error('External message handling failed:', error);
				}
			})();
		}
	);

	logger.info('Rotector Background Script: Initialization complete');
});
