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

// Compute retry delay from rate limit reset timestamp or linear backoff
function computeRetryDelay(error: Error, baseDelay: number, attempt: number): number {
	const { rateLimitReset } = error as Error & { rateLimitReset?: number };
	if (rateLimitReset) {
		return Math.max(rateLimitReset * 1000 - Date.now() + 500, 0);
	}
	return baseDelay * attempt;
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

interface RawHttpResult {
	content: string;
	filename: string;
	mimeType: string;
}

// HTTP client for non-JSON responses
export async function makeRawHttpRequest(
	endpoint: string,
	options: { method?: string; timeout?: number } = {}
): Promise<RawHttpResult> {
	const { method = 'GET', timeout = 30000 } = options;
	const url = `${API_CONFIG.BASE_URL}${endpoint}`;

	const headers = new Headers({ Accept: '*/*' });

	// Authenticate with Rotector API
	const apiKey = await getApiKey();
	if (apiKey?.trim()) {
		headers.set('X-Auth-Token', apiKey.trim());
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => {
		controller.abort();
	}, timeout);

	try {
		logger.debug(`Raw HTTP Request: ${method} ${url}`);
		const startTime = Date.now();

		const response = await fetch(url, {
			method,
			headers,
			signal: controller.signal
		});

		const duration = Date.now() - startTime;

		if (!response.ok) {
			// Error responses may still be JSON even for raw endpoints
			let errorData: { error?: string; code?: string; type?: string };
			try {
				const jsonData: unknown = await response.json();
				errorData =
					typeof jsonData === 'object' && jsonData !== null
						? (jsonData as { error?: string; code?: string; type?: string })
						: {};
			} catch {
				const errorText = await response.text().catch(() => 'Unknown error');
				errorData = { error: errorText };
			}

			const error = new Error(
				errorData.error ?? `HTTP ${response.status}: ${response.statusText}`
			) as Error & { status: number; code?: string; type?: string };

			Object.assign(error, {
				status: response.status,
				...(errorData.code && { code: errorData.code }),
				...(errorData.type && { type: errorData.type })
			});

			throw error;
		}

		const content = await response.text();
		logger.apiCall(method, url, response.status, duration);

		// Parse filename from Content-Disposition header
		const disposition = response.headers.get('Content-Disposition');
		if (!disposition) {
			throw new Error('Response missing Content-Disposition header');
		}
		const filenameMatch = /filename="?([^";\n]+)"?/.exec(disposition);
		if (!filenameMatch?.[1]) {
			throw new Error('Content-Disposition header missing filename');
		}
		const filename = filenameMatch[1];

		const mimeType = response.headers.get('Content-Type');
		if (!mimeType) {
			throw new Error('Response missing Content-Type header');
		}

		return { content, filename, mimeType };
	} catch (error) {
		if ((error as Error).name === 'AbortError') {
			const timeoutError = new Error(`Request timeout (${timeout}ms)`) as Error & {
				status: number;
			};
			timeoutError.status = 408;
			throw timeoutError;
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}

interface HttpRequestOptions extends RequestInit {
	timeout?: number;
	maxRetries?: number;
	retryDelay?: number;
	customApi?: CustomApiConfig;
	requireAuth?: boolean;
	clientId?: string;
	lookupContext?: string;
	readPrimary?: boolean;
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
		readPrimary,
		...fetchOptions
	} = options;

	// Determine URL and headers based on API type
	const isCustomApi = !!customApi;
	const url = isCustomApi ? endpoint : `${API_CONFIG.BASE_URL}${endpoint}`;

	const headers = new Headers({
		'Content-Type': 'application/json',
		Accept: 'application/json'
	});

	if (fetchOptions.headers) {
		new Headers(fetchOptions.headers).forEach((value, key) => {
			headers.set(key, value);
		});
	}

	// Add authentication headers
	if (isCustomApi) {
		if (customApi.apiKey?.trim()) {
			headers.set('X-Auth-Token', customApi.apiKey.trim());
		}
	} else {
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

		// Force read from primary database to avoid replication lag
		if (readPrimary) {
			headers.set('X-Read-Primary', 'true');
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
					rateLimitReset?: number;
				};

				Object.assign(error, {
					status: response.status,
					...(errorData.requestId && { requestId: errorData.requestId }),
					...(errorData.code && { code: errorData.code }),
					...(errorData.type && { type: errorData.type })
				});

				// Capture Retry-After for 429 responses
				if (response.status === 429) {
					const retryAfter = response.headers.get('Retry-After');
					if (retryAfter) {
						error.rateLimitReset = Math.ceil(Date.now() / 1000) + Number(retryAfter);
					}
				}

				throw error;
			}

			if (response.status === 204) {
				logger.apiCall(method, url, response.status, duration);
				return null;
			}

			let data: unknown = await response.json();
			logger.apiCall(method, url, response.status, duration);

			// Proactively wait when rate limit is exhausted
			const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
			const rateLimitReset = response.headers.get('X-RateLimit-Reset');
			if (rateLimitRemaining !== null && rateLimitReset !== null) {
				const remaining = Number(rateLimitRemaining);
				if (remaining <= 0) {
					const waitMs = Number(rateLimitReset) * 1000 - Date.now() + 500;
					if (waitMs > 0) {
						logger.debug(`Rate limit exhausted, waiting ${waitMs}ms for reset`);
						await new Promise((resolve) => setTimeout(resolve, waitMs));
					}
				}
			}

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

			// Retry on retryable errors
			const isRateLimited = (lastError as Error & { status?: number }).status === 429;
			if (attempt < maxRetries && isRetryableError(lastError) && (isSafeMethod || isRateLimited)) {
				const delay = computeRetryDelay(lastError, retryDelay, attempt);
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
