import type { ApiResponse, ContentMessage, ExtensionUserProfile } from '@/lib/types/api';
import type { QueueHistoryEntry } from '@/lib/types/queue-history';
import { API_ACTIONS, DISCORD_OAUTH_MESSAGES } from '@/lib/types/constants';
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
		(request: ContentMessage, _sender: unknown, sendResponse: (response: ApiResponse) => void) => {
			void (async () => {
				try {
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

	// Listen for external messages from OAuth callback page
	browser.runtime.onMessageExternal.addListener(
		(
			message: {
				type: string;
				uuid?: string;
				user?: ExtensionUserProfile;
				error?: string;
				state?: string;
				isNewUser?: boolean;
			},
			sender,
			_sendResponse
		) => {
			void (async () => {
				try {
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
					logger.error('Discord OAuth external message handling failed:', error);
				}
			})();
		}
	);

	logger.info('Rotector Background Script: Initialization complete');
});
