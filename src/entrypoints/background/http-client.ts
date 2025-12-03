import { API_CONFIG } from '@/lib/types/constants';
import { SETTINGS_KEYS } from '@/lib/types/settings';
import type { CustomApiConfig } from '@/lib/types/custom-api';
import { logger } from '@/lib/utils/logger';

const ACCESS_STATE_KEY = '_session_cache';

// Mark access state in storage
async function markAccessRestricted(): Promise<void> {
	await browser.storage.local.set({
		[ACCESS_STATE_KEY]: {
			_v: 1,
			_t: Date.now()
		}
	});
	logger.warn('Access state updated due to 403 response');
}

// Get API key from settings
async function getApiKey(): Promise<string | null> {
	try {
		const result = await browser.storage.sync.get([SETTINGS_KEYS.API_KEY]);
		const apiKey = result[SETTINGS_KEYS.API_KEY] as string | undefined;
		return typeof apiKey === 'string' ? apiKey || null : null;
	} catch (error) {
		logger.error('Background: Failed to get API key:', error);
		return null;
	}
}

// Get extension UUID from storage
async function getExtensionUuid(): Promise<string | null> {
	try {
		const result = await browser.storage.local.get(['extension_uuid']);
		return (result.extension_uuid as string) ?? null;
	} catch (error) {
		logger.error('Failed to get extension UUID:', error);
		return null;
	}
}

// Determine if error should trigger retry
function isRetryableError(error: Error): boolean {
	const status = (error as Error & { status?: number }).status;

	if (status) {
		// Rate limits and server errors
		if (status === 429 || (status >= 500 && status < 600)) {
			return true;
		}
		// Request timeout
		if (status === 408) {
			return true;
		}
	}

	return false;
}

// Unwrap custom API response from required wrapper format
function unwrapCustomApiResponse(data: unknown): unknown {
	// Require {success: boolean, data?: unknown, error?: string} wrapper format
	if (!data || typeof data !== 'object' || !('success' in data)) {
		throw new Error(
			'Invalid response format: must be {success: boolean, data?: unknown, error?: string}'
		);
	}

	const wrapped = data as { success: boolean; data?: unknown; error?: string };

	// Handle error response
	if (!wrapped.success) {
		const errorMessage = wrapped.error ?? 'API returned error without message';
		throw new Error(errorMessage);
	}

	// Handle success response
	if (!('data' in wrapped)) {
		throw new Error('Invalid response format: success=true but missing data field');
	}

	return wrapped.data;
}

interface HttpRequestOptions extends RequestInit {
	timeout?: number;
	maxRetries?: number;
	retryDelay?: number;
	customApi?: CustomApiConfig;
	requireAuth?: boolean;
	clientId?: string;
	lookupContext?: string;
}

// Unified HTTP client for both Rotector and Custom APIs
export async function makeHttpRequest(
	endpoint: string,
	options: HttpRequestOptions = {}
): Promise<unknown> {
	const startTime = Date.now();
	const {
		timeout = API_CONFIG.TIMEOUT,
		maxRetries = API_CONFIG.MAX_RETRIES,
		retryDelay = API_CONFIG.RETRY_DELAY,
		customApi,
		requireAuth = false,
		clientId,
		lookupContext,
		...fetchOptions
	} = options;

	// Determine URL and headers based on API type
	const isCustomApi = !!customApi;
	const url = isCustomApi ? `${customApi.url}${endpoint}` : `${API_CONFIG.BASE_URL}${endpoint}`;

	const headers = new Headers({
		'Content-Type': 'application/json',
		Accept: 'application/json'
	});

	if (fetchOptions.headers) {
		new Headers(fetchOptions.headers).forEach((value, key) => {
			headers.set(key, value);
		});
	}

	// Add authentication headers for Rotector API
	if (!isCustomApi) {
		const apiKey = await getApiKey();
		if (apiKey?.trim()) {
			headers.set('X-Auth-Token', apiKey.trim());
		}

		if (requireAuth) {
			const uuid = await getExtensionUuid();
			if (!uuid) {
				throw new Error('Extension not authenticated. Please login with Discord.');
			}
			headers.set('X-Extension-UUID', uuid);
		}

		// Add client ID header for integrity verification
		if (clientId) {
			headers.set('X-Client-ID', clientId);
		}

		// Add lookup context header for friend lookups
		if (lookupContext) {
			headers.set('X-Lookup-Context', lookupContext);
		}
	}

	const method = (fetchOptions.method ?? 'GET').toUpperCase();
	const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(method);

	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => {
			controller.abort();
		}, timeout);
		const requestOptions: RequestInit = {
			...fetchOptions,
			headers,
			signal: controller.signal
		};

		try {
			logger.debug(`HTTP Request attempt ${attempt}: ${method} ${url}`);

			const response = await fetch(url, requestOptions);
			const duration = Date.now() - startTime;

			if (!response.ok) {
				let errorData: {
					error?: string;
					requestId?: string;
					code?: string;
					type?: string;
				};
				try {
					const jsonData: unknown = await response.json();
					errorData =
						typeof jsonData === 'object' && jsonData !== null
							? (jsonData as {
									error?: string;
									requestId?: string;
									code?: string;
									type?: string;
								})
							: {};
				} catch {
					const errorText = await response.text().catch(() => 'Unknown error');
					errorData = { error: errorText };
				}

				const error = new Error(
					errorData.error ?? `HTTP ${response.status}: ${response.statusText}`
				) as Error & {
					status: number;
					requestId?: string;
					code?: string;
					type?: string;
				};

				Object.assign(error, {
					status: response.status,
					...(errorData.requestId && { requestId: errorData.requestId }),
					...(errorData.code && { code: errorData.code }),
					...(errorData.type && { type: errorData.type })
				});

				throw error;
			}

			if (response.status === 204) {
				logger.apiCall(method, url, response.status, duration);
				return null;
			}

			let data: unknown = await response.json();
			logger.apiCall(method, url, response.status, duration);

			// Unwrap custom API response if needed
			if (isCustomApi) {
				data = unwrapCustomApiResponse(data);
			}

			return data;
		} catch (error) {
			lastError = error as Error;
			const duration = Date.now() - startTime;

			if (lastError.name === 'AbortError') {
				const timeoutError = new Error(`Request timeout (${timeout}ms)`) as Error & {
					status?: number;
				};
				timeoutError.status = 408;
				lastError = timeoutError;
			}

			logger.warn(`HTTP request failed (attempt ${attempt}/${maxRetries})`, {
				url,
				error: lastError.message,
				duration
			});

			// Check if error is retryable
			if (isSafeMethod && attempt < maxRetries && isRetryableError(lastError)) {
				const delay = retryDelay * attempt;
				logger.debug(`Retrying in ${delay}ms...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}

			if (!isCustomApi) {
				const err = lastError as Error & { status?: number };

				// Handle 403 responses
				if (err.status === 403) {
					if (requireAuth && err.message.includes('UUID invalidated')) {
						await browser.storage.local.remove(['extension_uuid']);
						logger.info('Stored UUID cleared due to invalidation');
					}

					if (err.message.includes('Access denied')) {
						await markAccessRestricted();
					}
				}
			}

			break;
		} finally {
			clearTimeout(timeoutId);
		}
	}

	throw lastError ?? new Error('API error. Please try again later.');
}
