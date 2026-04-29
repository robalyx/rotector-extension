import { API_CONFIG } from '@/lib/types/constants';
import { SETTINGS_KEYS } from '@/lib/types/settings';
import type { CustomApiConfig } from '@/lib/types/custom-api';
import { buildCustomApiAuthHeaders } from '@/lib/stores/custom-apis';
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
		return (result['extension_uuid'] as string | undefined) ?? null;
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

	// Network failures
	return error instanceof TypeError || status === 0;
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
				errorData = typeof jsonData === 'object' && jsonData !== null ? jsonData : {};
			} catch {
				const errorText = await response.text().catch(() => 'Unknown error');
				errorData = { error: errorText };
			}

			const error = new Error(
				errorData.error ?? `HTTP ${String(response.status)}: ${response.statusText}`
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
			const timeoutError = new Error(`Request timeout (${String(timeout)}ms)`) as Error & {
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
	timeout?: number | undefined;
	maxRetries?: number | undefined;
	retryDelay?: number | undefined;
	customApi?: CustomApiConfig | undefined;
	requireAuth?: boolean | undefined;
	clientId?: string | undefined;
	lookupContext?: string | undefined;
	readPrimary?: boolean | undefined;
}

interface RotectorHeaderOptions {
	requireAuth: boolean;
	clientId: string | undefined;
	lookupContext: string | undefined;
	readPrimary: boolean | undefined;
}

// Build request headers for Rotector API
async function buildRotectorHeaders(
	headers: Headers,
	{ requireAuth, clientId, lookupContext, readPrimary }: RotectorHeaderOptions
): Promise<void> {
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

	if (clientId) {
		headers.set('X-Client-ID', clientId);
	}

	if (lookupContext) {
		headers.set('X-Lookup-Context', lookupContext);
	}

	if (readPrimary) {
		headers.set('X-Read-Primary', 'true');
	}
}

// Build an Error from a non-OK response
async function buildHttpError(response: Response): Promise<Error & { status: number }> {
	let errorData: {
		error?: string;
		requestId?: string;
		code?: string;
		type?: string;
		details?: Record<string, unknown>;
	};
	try {
		const jsonData: unknown = await response.json();
		errorData = typeof jsonData === 'object' && jsonData !== null ? jsonData : {};
	} catch {
		const errorText = await response.text().catch(() => 'Unknown error');
		errorData = { error: errorText };
	}

	const error = new Error(
		errorData.error ?? `HTTP ${String(response.status)}: ${response.statusText}`
	) as Error & {
		status: number;
		requestId?: string;
		code?: string;
		type?: string;
		details?: Record<string, unknown>;
		rateLimitReset?: number;
	};

	Object.assign(error, {
		status: response.status,
		...(errorData.requestId && { requestId: errorData.requestId }),
		...(errorData.code && { code: errorData.code }),
		...(errorData.type && { type: errorData.type }),
		...(errorData.details && { details: errorData.details })
	});

	if (response.status === 429) {
		const retryAfter = response.headers.get('Retry-After');
		if (retryAfter) {
			error.rateLimitReset = Math.ceil(Date.now() / 1000) + Number(retryAfter);
		}
	}

	return error;
}

// Classify a thrown error into its retryable shape
function normalizeFetchError(error: Error, timeout: number): Error {
	if (error.name === 'AbortError') {
		const timeoutError = new Error(`Request timeout (${String(timeout)}ms)`) as Error & {
			status?: number;
		};
		timeoutError.status = 408;
		return timeoutError;
	}

	if (!('status' in error) && error instanceof TypeError) {
		const networkError = new Error(
			'Unable to connect. Check your internet connection and try again.'
		) as Error & { status?: number };
		networkError.status = 0;
		return networkError;
	}

	return error;
}

// Assemble request headers with base content-type, caller overrides, and auth
async function prepareHeaders(
	fetchHeaders: HeadersInit | undefined,
	customApi: CustomApiConfig | undefined,
	rotectorOpts: RotectorHeaderOptions
): Promise<Headers> {
	const headers = new Headers({
		'Content-Type': 'application/json',
		Accept: 'application/json'
	});

	if (fetchHeaders) {
		new Headers(fetchHeaders).forEach((value, key) => {
			headers.set(key, value);
		});
	}

	if (customApi) {
		const authHeaders = buildCustomApiAuthHeaders(customApi);
		for (const [name, value] of Object.entries(authHeaders)) {
			headers.set(name, value);
		}
	} else {
		await buildRotectorHeaders(headers, rotectorOpts);
	}

	return headers;
}

// Pause when X-RateLimit headers indicate the window is exhausted
async function maybeWaitForRateLimit(headers: Headers): Promise<void> {
	const remaining = headers.get('X-RateLimit-Remaining');
	const reset = headers.get('X-RateLimit-Reset');
	if (remaining === null || reset === null) return;
	if (Number(remaining) > 0) return;

	const waitMs = Number(reset) * 1000 - Date.now() + 500;
	if (waitMs > 0) {
		logger.debug(`Rate limit exhausted, waiting ${String(waitMs)}ms for reset`);
		await new Promise((resolve) => setTimeout(resolve, waitMs));
	}
}

// Decide whether to retry after a request failure. Returns delay ms or null
function decideRetry(
	error: Error,
	attempt: number,
	maxRetries: number,
	retryDelay: number,
	isSafeMethod: boolean
): number | null {
	if (attempt >= maxRetries || !isRetryableError(error)) return null;
	const status = (error as Error & { status?: number }).status;
	const isRateLimited = status === 429;
	const isNetworkFailure = status === 0;
	if (!isSafeMethod && !isRateLimited && !isNetworkFailure) return null;
	return computeRetryDelay(error, retryDelay, attempt);
}

// Handle 403 side-effects for Rotector API
async function handleRotectorForbidden(
	error: Error & { status?: number; message: string },
	endpoint: string,
	requireAuth: boolean
): Promise<void> {
	const isMembershipEndpoint = endpoint.startsWith('/v1/extension/membership/');
	if (error.status !== 403 || isMembershipEndpoint) return;

	if (requireAuth && error.message.includes('UUID invalidated')) {
		await browser.storage.local.remove(['extension_uuid']);
		logger.info('Stored UUID cleared due to invalidation');
	}

	if (error.message.includes('Access denied')) {
		await markAccessRestricted();
	}
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

	const headers = await prepareHeaders(fetchOptions.headers, customApi, {
		requireAuth,
		clientId,
		lookupContext,
		readPrimary
	});

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
			logger.debug(`HTTP Request attempt ${String(attempt)}: ${method} ${url}`);

			const response = await fetch(url, requestOptions);
			const duration = Date.now() - startTime;

			if (!response.ok) {
				throw await buildHttpError(response);
			}

			if (response.status === 204) {
				logger.apiCall(method, url, response.status, duration);
				return null;
			}

			let data: unknown = await response.json();
			logger.apiCall(method, url, response.status, duration);

			await maybeWaitForRateLimit(response.headers);

			// Unwrap custom API response if needed
			if (isCustomApi) {
				data = unwrapCustomApiResponse(data);
			}

			return data;
		} catch (error) {
			lastError = normalizeFetchError(error as Error, timeout);
			const duration = Date.now() - startTime;

			logger.warn(`HTTP request failed (attempt ${String(attempt)}/${String(maxRetries)})`, {
				url,
				error: lastError.message,
				duration
			});

			const delay = decideRetry(lastError, attempt, maxRetries, retryDelay, isSafeMethod);
			if (delay !== null) {
				logger.debug(`Retrying in ${String(delay)}ms...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}

			if (!isCustomApi) {
				await handleRotectorForbidden(lastError, endpoint, requireAuth);
			}

			break;
		} finally {
			clearTimeout(timeoutId);
		}
	}

	throw lastError ?? new Error('API error. Please try again later.');
}
