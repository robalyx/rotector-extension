import type { ApiResponse, CaptchaSession } from '@/lib/types/api';
import { isCaptchaSession, safeParseCaptchaExternalMessage } from '@/lib/schemas/captcha';
import {
	type CaptchaStartMessage,
	safeParseCaptchaStartMessage,
	safeParseContentMessage
} from '@/lib/schemas/content-message';
import * as v from 'valibot';
import type { QueueHistoryEntry } from '@/lib/types/queue-history';
import {
	API_CONFIG,
	CAPTCHA_EXTERNAL_MESSAGES,
	CAPTCHA_MESSAGES,
	STORAGE_KEYS
} from '@/lib/types/constants';
import { asApiError, createErrorResponse } from '@/lib/utils/api/api-error';
import { getAssetUrl } from '@/lib/utils/assets';
import { logger } from '@/lib/utils/logging/logger';
import {
	getAllStorage,
	getStorage,
	removeStorage,
	setStorage,
	setStorageMulti,
	subscribeStorageKey
} from '@/lib/utils/storage';
import {
	applyQueueStatusUpdate,
	QUEUE_HISTORY_KEY,
	readUnprocessedEntries
} from '@/lib/utils/queue-history-storage';
import { dispatchContentMessage } from './handlers';
import { getQueueStatus } from './endpoints/core';
import { SETTINGS_DEFAULTS } from '@/lib/types/settings';
import { loadCustomApis } from '@/lib/stores/custom-apis';
import { t } from '@/lib/utils/i18n';

async function seedDefaultSettings(): Promise<void> {
	const existingSettings = await getAllStorage('sync');
	const missingSettings: Partial<typeof SETTINGS_DEFAULTS> = {};

	for (const [key, defaultValue] of Object.entries(SETTINGS_DEFAULTS)) {
		if (!(key in existingSettings)) {
			(missingSettings as Record<string, unknown>)[key] = defaultValue;
		}
	}

	if (Object.keys(missingSettings).length > 0) {
		await setStorageMulti('sync', missingSettings);
		logger.info('Background: Initialized missing settings', missingSettings);
	}
}

let pollIntervalId: ReturnType<typeof setInterval> | null = null;
let isPolling = false;

const activeCaptchaSessions = new Set<string>();

async function sendQueueNotification(entry: QueueHistoryEntry): Promise<void> {
	const notificationId = `queue-${String(entry.userId)}-${String(Date.now())}`;

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

// Single-flight poll that stops the interval when no unprocessed entries remain and notifies on processed transitions
async function pollQueueStatus(): Promise<void> {
	if (isPolling) return;
	isPolling = true;

	try {
		const unprocessed = await readUnprocessedEntries();

		if (unprocessed.length === 0) {
			stopPolling();
			return;
		}

		const userIds = unprocessed.map((e) => e.userId);
		const response = await getQueueStatus(userIds);

		for (const [userIdStr, status] of Object.entries(response)) {
			if (!status.queued) continue;

			const completedEntry = await applyQueueStatusUpdate(parseInt(userIdStr, 10), status);

			if (completedEntry) {
				await sendQueueNotification(completedEntry);
			}
		}
	} catch (error) {
		logger.error('Queue status poll failed:', error);
	} finally {
		isPolling = false;
	}
}

async function startPollingIfNeeded(): Promise<void> {
	if (pollIntervalId) return;
	const unprocessed = await readUnprocessedEntries();
	if (unprocessed.length === 0) return;

	logger.debug('Starting queue status polling');
	void pollQueueStatus();
	pollIntervalId = setInterval(() => void pollQueueStatus(), API_CONFIG.QUEUE_POLL_INTERVAL);
}

function stopPolling(): void {
	if (pollIntervalId) {
		clearInterval(pollIntervalId);
		pollIntervalId = null;
		logger.debug('Stopped queue status polling');
	}
}

// Starts polling if unprocessed entries exist and toggles the interval as queue history changes in storage
async function initializeQueuePolling(): Promise<void> {
	await startPollingIfNeeded();

	subscribeStorageKey<QueueHistoryEntry[]>('local', QUEUE_HISTORY_KEY, (newValue) => {
		const hasUnprocessed = (newValue ?? []).some((e) => !e.processed);
		if (hasUnprocessed && !pollIntervalId) {
			void startPollingIfNeeded();
		} else if (!hasUnprocessed && pollIntervalId) {
			stopPolling();
		}
	});
}

// Persists the queue payload under a session-scoped key, garbage-collects sessions older than 10 minutes, then opens the captcha popup
async function handleCaptchaStart(
	request: CaptchaStartMessage,
	senderTabId?: number
): Promise<void> {
	const { sessionId, queueData } = request;

	// Remove orphaned (older than 10 minutes) or malformed captcha sessions
	const allItems = await browser.storage.local.get(null);
	const now = Date.now();
	await removeStorage(
		'local',
		Object.keys(allItems).filter((key) => {
			if (!key.startsWith('captcha_session_')) return false;
			const stored = allItems[key];
			return !isCaptchaSession(stored) || now - stored.timestamp > 600000;
		})
	);

	const session: CaptchaSession = {
		sessionId,
		userId: queueData.userId,
		outfitNames: queueData.outfitNames,
		...(queueData.outfitIds !== undefined && { outfitIds: queueData.outfitIds }),
		inappropriateProfile: queueData.inappropriateProfile,
		inappropriateFriends: queueData.inappropriateFriends,
		inappropriateGroups: queueData.inappropriateGroups,
		...(senderTabId !== undefined && { senderTabId }),
		timestamp: now
	};
	await setStorage('local', `captcha_session_${sessionId}`, session);

	const captchaUrl = new URL(`${API_CONFIG.BASE_URL}/captcha`);
	captchaUrl.searchParams.set('session', sessionId);

	await browser.windows.create({
		url: captchaUrl.toString(),
		type: 'popup',
		width: 450,
		height: 550,
		focused: true
	});

	logger.info('Captcha popup opened for session:', sessionId);
}

// Dedupes by sessionId, validates the session hasn't expired, closes the popup tab, and forwards the token to the originating content tab
async function handleCaptchaSuccess(
	sessionId: string,
	token: string,
	sender: { tab?: { id?: number | undefined } | undefined }
): Promise<void> {
	if (activeCaptchaSessions.has(sessionId)) {
		return;
	}
	activeCaptchaSessions.add(sessionId);

	try {
		const storageKey = `captcha_session_${sessionId}`;
		const session = await getStorage<CaptchaSession | undefined>('local', storageKey, undefined);

		if (!session) {
			logger.error('Captcha session not found:', sessionId);
			return;
		}

		if (Date.now() - session.timestamp > 600000) {
			logger.error('Captcha session expired:', sessionId);
			await removeStorage('local', storageKey);
			return;
		}

		await removeStorage('local', storageKey);

		if (sender.tab?.id) {
			await browser.tabs.remove(sender.tab.id).catch(() => {});
		}

		const message = {
			type: CAPTCHA_MESSAGES.CAPTCHA_TOKEN_READY,
			token,
			sessionId,
			queueData: {
				userId: session.userId,
				outfitNames: session.outfitNames,
				outfitIds: session.outfitIds ?? [],
				inappropriateProfile: session.inappropriateProfile,
				inappropriateFriends: session.inappropriateFriends,
				inappropriateGroups: session.inappropriateGroups
			}
		};

		if (session.senderTabId !== undefined) {
			await browser.tabs.sendMessage(session.senderTabId, message).catch((err: unknown) => {
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

async function handleCaptchaError(
	sessionId: string | undefined,
	error: string | undefined,
	sender: { tab?: { id?: number | undefined } | undefined }
): Promise<void> {
	let senderTabId: number | undefined;
	if (sessionId) {
		const storageKey = `captcha_session_${sessionId}`;
		const session = await getStorage<CaptchaSession | undefined>('local', storageKey, undefined);
		senderTabId = session?.senderTabId;
		await removeStorage('local', storageKey);
	}

	if (sender.tab?.id) {
		await browser.tabs.remove(sender.tab.id).catch(() => {});
	}

	if (senderTabId !== undefined) {
		const message = {
			type: CAPTCHA_MESSAGES.CAPTCHA_CANCELLED,
			error,
			sessionId
		};
		await browser.tabs.sendMessage(senderTabId, message).catch((err: unknown) => {
			logger.error('Failed to deliver captcha cancellation to content script:', err);
		});
	}

	logger.error('Captcha verification failed:', error);
}

// Prevent unbounded growth of dev logs/perf entries across sessions
async function clearDevDataOnStartup(): Promise<void> {
	try {
		await removeStorage('local', [STORAGE_KEYS.DEVELOPER_LOGS, STORAGE_KEYS.PERFORMANCE_ENTRIES]);
		logger.debug('Developer logs and performance entries cleared on startup');
	} catch (error) {
		logger.warn('Failed to clear dev data on startup:', error);
	}
}

export default defineBackground(() => {
	logger.info('Rotector Background Script: Starting...', {
		id: browser.runtime.id
	});

	clearDevDataOnStartup().catch((err: unknown) => {
		logger.warn('Failed to clear dev data:', err);
	});

	seedDefaultSettings().catch((err: unknown) => {
		logger.error('Failed to seed default settings:', err);
	});

	loadCustomApis().catch((err: unknown) => {
		logger.error('Failed to load custom APIs:', err);
	});

	initializeQueuePolling().catch((err: unknown) => {
		logger.error('Failed to initialize queue polling:', err);
	});

	async function dispatchCaptchaMessage(
		message: unknown,
		sender: { tab?: { id?: number | undefined } | undefined }
	): Promise<boolean> {
		const parsed = safeParseCaptchaExternalMessage(message);
		if (!parsed.success) return false;

		if (parsed.output.type === CAPTCHA_EXTERNAL_MESSAGES.SUCCESS) {
			await handleCaptchaSuccess(parsed.output.session, parsed.output.token, sender);
			return true;
		}

		await handleCaptchaError(parsed.output.session, parsed.output.error, sender);
		return true;
	}

	// Three message transports converge on dispatchContentMessage / dispatchCaptchaMessage:
	//   1. browser.runtime.onMessage:           content/popup -> background (internal)
	//   2. browser.runtime.onMessageExternal:   Chrome only, roscoe.rotector.com -> background
	//   3. roscoe-bridge.content.ts -> onMessage: Firefox shim for #2 (no externally_connectable)
	browser.runtime.onMessage.addListener(
		(request: unknown, sender, sendResponse: (response: ApiResponse) => void) => {
			void (async () => {
				try {
					if (await dispatchCaptchaMessage(request, sender)) return;

					const captchaStart = safeParseCaptchaStartMessage(request);
					if (captchaStart.success) {
						await handleCaptchaStart(captchaStart.output, sender.tab?.id);
						sendResponse({ success: true });
						return;
					}

					const contentMessage = safeParseContentMessage(request);
					if (!contentMessage.success) {
						throw new Error(`Invalid message: ${v.summarize(contentMessage.issues)}`);
					}

					const response = await dispatchContentMessage(contentMessage.output);

					sendResponse({ success: true, data: response });
					logger.debug(`Successfully handled action: ${contentMessage.output.action}`);
				} catch (error) {
					logger.error('Background script error:', error);
					sendResponse(createErrorResponse(asApiError(error)));
				}
			})();

			return true;
		}
	);

	browser.runtime.onMessageExternal.addListener(
		(
			message: { type: string; token?: string; session?: string; error?: string },
			sender,
			_sendResponse
		) => {
			void (async () => {
				try {
					await dispatchCaptchaMessage(message, sender);
				} catch (error) {
					logger.error('External message handling failed:', error);
				}
			})();

			return true;
		}
	);

	logger.info('Rotector Background Script: Initialization complete');
});
