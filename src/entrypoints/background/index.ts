import type { ApiResponse, ContentMessage, ExtensionUserProfile } from '@/lib/types/api';
import { DISCORD_OAUTH_MESSAGES } from '@/lib/types/constants';
import { logger } from '@/lib/utils/logger';
import { actionHandlers } from './handlers';
import { createErrorResponse, initializeSettings } from './utils';

export default defineBackground(() => {
	logger.info('Rotector Background Script: Starting...', {
		id: browser.runtime.id
	});

	initializeSettings().catch((err) => {
		logger.error('Failed to initialize settings:', err);
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
