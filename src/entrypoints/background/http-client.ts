import { API_CONFIG } from '@/lib/types/constants';
import { SETTINGS_KEYS } from '@/lib/types/settings';
import type { CustomApiConfig } from '@/lib/types/custom-api';
import { buildCustomApiAuthHeaders } from '@/lib/utils/api/api-auth';
import { logger } from '@/lib/utils/logging/logger';
import { type ApiError, asApiError, buildHttpError } from '@/lib/utils/api/api-error';
import { getStorage } from '@/lib/utils/storage';
import { getInstallationId } from '@/lib/utils/installation-id';
import { markSessionRestricted } from '@/lib/stores/session-state';
import {
	bumpStoredAuthExpires,
	clearStoredAuthToken,
	getStoredAuthToken
} from '@/lib/utils/roblox-auth-storage';

type BearerOverride =
	| { kind: 'membership' } // use X-Auth-Token (membership key) as Authorization
	| { kind: 'none' }; // omit Authorization entirely

async function getApiKey(): Promise<string | null> {
	try {
		return (await getStorage<string>('sync', SETTINGS_KEYS.API_KEY, '')) || null;
	} catch (error) {
		logger.error('Background: Failed to get API key:', error);
		return null;
	}
}

function computeRetryDelay(error: ApiError, baseDelay: number, attempt: number): number {
	if (error.rateLimitReset) {
		return Math.max(error.rateLimitReset * 1000 - Date.now() + 500, 0);
	}
	return baseDelay * attempt;
}

function isRetryableError(error: ApiError): boolean {
	const status = error.status;

	if (status) {
		if (status === 429 || (status >= 500 && status < 600)) {
			return true;
		}
		if (status === 408) {
			return true;
		}
	}

	return error instanceof TypeError || status === 0;
}

interface HttpRequestOptions<T = unknown> extends RequestInit {
	timeout?: number | undefined;
	maxRetries?: number | undefined;
	retryDelay?: number | undefined;
	customApi?: CustomApiConfig | undefined;
	clientId?: string | undefined;
	lookupContext?: string | undefined;
	readPrimary?: boolean | undefined;
	rawResponse?: boolean | undefined;
	parse?: ((payload: unknown) => T) | undefined;
	// When set, the response is handed off raw and the JSON parse / envelope
	// unwrap path is skipped entirely. Used for non-JSON responses (file
	// downloads). Implies maxRetries=1 because partial downloads aren't retryable.
	parseResponse?: ((response: Response) => Promise<T>) | undefined;
	// Auth bearer policy. Default uses the stored session token if present.
	bearerOverride?: BearerOverride | undefined;
}

interface RotectorHeaderOptions {
	clientId: string | undefined;
	lookupContext: string | undefined;
	readPrimary: boolean | undefined;
	bearerOverride: BearerOverride | undefined;
}

async function resolveBearer(
	override: BearerOverride | undefined,
	apiKey: string | null
): Promise<string | null> {
	if (override?.kind === 'none') return null;
	if (override?.kind === 'membership') return apiKey;
	return getStoredAuthToken();
}

async function buildRotectorHeaders(
	headers: Headers,
	{ clientId, lookupContext, readPrimary, bearerOverride }: RotectorHeaderOptions
): Promise<void> {
	const rawApiKey = await getApiKey();
	const apiKey = rawApiKey?.trim() ?? null;
	if (apiKey) {
		headers.set('X-Auth-Token', apiKey);
	}

	const bearer = await resolveBearer(bearerOverride, apiKey);
	if (bearer) {
		headers.set('Authorization', `Bearer ${bearer}`);
	}

	headers.set('X-Installation-ID', await getInstallationId());

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

function normalizeFetchError(error: unknown, timeout: number): ApiError {
	if (error instanceof Error && error.name === 'AbortError') {
		return Object.assign(new Error(`Request timeout (${String(timeout)}ms)`), { status: 408 });
	}

	if (error instanceof TypeError && !('status' in error)) {
		return Object.assign(
			new Error('Unable to connect. Check your internet connection and try again.'),
			{ status: 0 }
		);
	}

	return asApiError(error);
}

async function processRotectorResponseHeaders(headers: Headers): Promise<void> {
	const expires = headers.get('X-Token-Expires');
	if (!expires) return;
	const parsed = Number(expires);
	if (!Number.isFinite(parsed) || parsed <= 0) return;
	await bumpStoredAuthExpires(parsed);
}

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
		for (const [key, value] of new Headers(fetchHeaders).entries()) {
			headers.set(key, value);
		}
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

// Returns retry delay in ms or null when not retryable
function decideRetry(
	error: ApiError,
	attempt: number,
	maxRetries: number,
	retryDelay: number,
	isSafeMethod: boolean
): number | null {
	if (attempt >= maxRetries || !isRetryableError(error)) return null;
	const isRateLimited = error.status === 429;
	const isNetworkFailure = error.status === 0;
	if (!isSafeMethod && !isRateLimited && !isNetworkFailure) return null;
	return computeRetryDelay(error, retryDelay, attempt);
}

// Strip the Rotector success envelope (unless rawResponse) and run the optional
// parser. Custom APIs pass `rawResponse: true` and unwrap their own envelope in
// the parse hook so http-client stays envelope-agnostic.
function finalizePayload<T>(
	data: unknown,
	rawResponse: boolean,
	parse: ((payload: unknown) => T) | undefined
): T {
	let payload = data;
	if (!rawResponse) {
		if (typeof payload !== 'object' || payload === null || !('data' in payload)) {
			throw new Error('Invalid response: missing data field');
		}
		payload = payload.data;
	}
	return parse ? parse(payload) : (payload as T);
}

async function handleRotectorForbidden(error: ApiError, endpoint: string): Promise<void> {
	const isMembershipEndpoint = endpoint.startsWith('/v1/extension/membership/');
	if (error.status !== 403 || isMembershipEndpoint) return;

	if (error.message.includes('Access denied')) {
		await markSessionRestricted();
	}
}

// Endpoints whose 401 specifically means the session token is invalid or
// revoked. Other endpoints attach the bearer opportunistically (queue,
// leaderboard) or authenticate via the membership key, so a 401 there must
// not nuke the session.
function isSessionAuthEndpoint(endpoint: string): boolean {
	return (
		endpoint.startsWith('/v1/me/') ||
		endpoint === '/v1/auth/roblox/logout' ||
		endpoint === '/v1/auth/roblox/logout-all'
	);
}

async function handleSessionUnauthorized(
	error: ApiError,
	sentBearer: boolean,
	endpoint: string
): Promise<void> {
	if (!sentBearer || error.status !== 401) return;
	if (!isSessionAuthEndpoint(endpoint)) return;
	await clearStoredAuthToken();
}

// Owns retries, Retry-After honoring, safe-method gating, envelope unwrapping, and Rotector restricted-access detection
export async function makeHttpRequest<T = unknown>(
	endpoint: string,
	options: HttpRequestOptions<T> = {}
): Promise<T> {
	const startTime = Date.now();
	const {
		timeout = API_CONFIG.TIMEOUT,
		maxRetries = API_CONFIG.MAX_RETRIES,
		retryDelay = API_CONFIG.RETRY_DELAY,
		customApi,
		clientId,
		lookupContext,
		readPrimary,
		rawResponse = false,
		parse,
		parseResponse,
		bearerOverride,
		...fetchOptions
	} = options;

	const effectiveMaxRetries = parseResponse ? 1 : maxRetries;

	const isCustomApi = !!customApi;
	const url = isCustomApi ? endpoint : `${API_CONFIG.BASE_URL}${endpoint}`;

	const headers = await prepareHeaders(fetchOptions.headers, customApi, {
		clientId,
		lookupContext,
		readPrimary,
		bearerOverride
	});
	const sentBearer = !isCustomApi && headers.has('Authorization');

	const method = (fetchOptions.method ?? 'GET').toUpperCase();
	const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(method);

	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= effectiveMaxRetries; attempt++) {
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

			if (!isCustomApi) {
				await processRotectorResponseHeaders(response.headers);
			}

			if (parseResponse) {
				const result = await parseResponse(response);
				logger.apiCall(method, url, response.status, duration);
				return result;
			}

			if (response.status === 204) {
				logger.apiCall(method, url, response.status, duration);
				return null as T;
			}

			const data: unknown = await response.json();
			logger.apiCall(method, url, response.status, duration);

			await maybeWaitForRateLimit(response.headers);

			return finalizePayload(data, rawResponse, parse);
		} catch (error) {
			lastError = normalizeFetchError(error, timeout);
			const duration = Date.now() - startTime;

			logger.warn(
				`HTTP request failed (attempt ${String(attempt)}/${String(effectiveMaxRetries)})`,
				{
					url,
					error: lastError.message,
					duration
				}
			);

			const delay = decideRetry(lastError, attempt, effectiveMaxRetries, retryDelay, isSafeMethod);
			if (delay !== null) {
				logger.debug(`Retrying in ${String(delay)}ms...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}

			if (!isCustomApi) {
				await handleRotectorForbidden(lastError, endpoint);
				await handleSessionUnauthorized(lastError, sentBearer, endpoint);
			}

			break;
		} finally {
			clearTimeout(timeoutId);
		}
	}

	throw lastError ?? new Error('API error. Please try again later.');
}
