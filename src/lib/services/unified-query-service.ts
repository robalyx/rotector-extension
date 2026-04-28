import type { CombinedStatus, CustomApiConfig, CustomApiResult } from '../types/custom-api';
import type { GroupStatus, UserStatus } from '../types/api';
import { apiClient } from './api-client';
import { userStatusService } from './entity-status-service';
import { customApis, ROTECTOR_API_ID } from '../stores/custom-apis';
import { restrictedAccessStore } from '../stores/restricted-access';
import { settings } from '../stores/settings';
import { getLoggedInUserId } from '../utils/client-id';
import { logger } from '../utils/logger';
import { startTrace, traceAsync, TRACE_CATEGORIES } from '../utils/perf-tracer';
import { chunkArray } from '../utils/array';
import { abortableSleep, getAbortError } from '../utils/abort';
import { API_CONFIG, STATUS } from '../types/constants';
import { SETTINGS_KEYS } from '../types/settings';
import { get } from 'svelte/store';

interface QueryMultipleUsersOptions {
	lookupContext?: string | undefined;
	signal?: AbortSignal | undefined;
}

const PROGRESSIVE_API_TIMEOUT_MS = 15_000;

// Check if lookup should be blocked due to restricted access
function shouldBlockLookup(userId: string): boolean {
	const { isRestricted } = get(restrictedAccessStore);
	if (!isRestricted) return false;

	const loggedInUserId = getLoggedInUserId();
	return loggedInUserId !== userId;
}

// Create a restricted access result for blocked lookups
function createRestrictedResult(): CombinedStatus<UserStatus> {
	const enabledApis = getEnabledCustomApis();
	return new Map(
		enabledApis.map((api) => [
			api.id,
			{
				apiId: api.id,
				apiName: api.name,
				error: 'restricted_access',
				loading: false,
				timestamp: Date.now(),
				landscapeImageDataUrl: api.landscapeImageDataUrl
			}
		])
	);
}

// Get enabled custom APIs sorted by order
function getEnabledCustomApis(): CustomApiConfig[] {
	const s = get(settings);
	const experimentalCustomApisEnabled = s[SETTINGS_KEYS.EXPERIMENTAL_CUSTOM_APIS_ENABLED];

	return get(customApis)
		.filter((api) => {
			if (!api.enabled) return false;
			if (api.isSystem) return true;
			return experimentalCustomApisEnabled;
		})
		.sort((a, b) => a.order - b.order);
}

// Format API result from Promise settlement
function formatApiResult(
	api: CustomApiConfig,
	result: PromiseSettledResult<UserStatus | null>
): CustomApiResult<UserStatus> {
	const base = {
		apiId: api.id,
		apiName: api.name,
		loading: false,
		timestamp: Date.now(),
		landscapeImageDataUrl: api.landscapeImageDataUrl
	};

	if (result.status === 'fulfilled') {
		return { ...base, data: result.value ?? undefined };
	}

	const errorMessage = result.reason instanceof Error ? result.reason.message : 'Unknown error';
	return { ...base, error: errorMessage };
}

// Query a single user from all enabled APIs
export async function queryUser(userId: string): Promise<CombinedStatus<UserStatus>> {
	if (shouldBlockLookup(userId)) {
		return createRestrictedResult();
	}

	return traceAsync(
		TRACE_CATEGORIES.API,
		'queryUser',
		async () => {
			const enabledApis = getEnabledCustomApis();

			// Query all APIs in parallel
			const results = await Promise.allSettled(
				enabledApis.map(async (api) =>
					api.isSystem && api.id === ROTECTOR_API_ID
						? userStatusService.getStatus(userId)
						: apiClient.checkUser(userId, { apiConfig: api })
				)
			);

			// Format results
			const customApiResults = new Map(
				enabledApis.map((api, i) => {
					const result = results[i];
					if (!result) throw new Error('Internal: API list/result length mismatch');
					return [api.id, formatApiResult(api, result)];
				})
			);

			logger.debug('Unified query completed:', {
				userId,
				totalApis: enabledApis.length,
				successfulApis: Array.from(customApiResults.values()).filter((r) => r.data).length
			});

			return customApiResults;
		},
		{ userId }
	);
}

// Query a single user with progressive updates as each API completes
export function queryUserProgressive(
	userId: string,
	onUpdate: (status: CombinedStatus<UserStatus>) => void
): () => void {
	if (shouldBlockLookup(userId)) {
		onUpdate(createRestrictedResult());
		return () => {};
	}

	const enabledApis = getEnabledCustomApis();
	const controller = new AbortController();

	// Initialize with loading state for all APIs
	const apiResults = new Map<string, CustomApiResult<UserStatus>>(
		enabledApis.map((api) => [
			api.id,
			{
				apiId: api.id,
				apiName: api.name,
				loading: true,
				landscapeImageDataUrl: api.landscapeImageDataUrl
			}
		])
	);
	onUpdate(new Map(apiResults));

	// Fire all requests in parallel then update on each completion
	enabledApis.forEach(async (api) => {
		const apiSignal = AbortSignal.any([
			controller.signal,
			AbortSignal.timeout(PROGRESSIVE_API_TIMEOUT_MS)
		]);
		try {
			const result =
				api.isSystem && api.id === ROTECTOR_API_ID
					? await userStatusService.getStatus(userId, { signal: apiSignal })
					: await apiClient.checkUser(userId, {
							apiConfig: api,
							signal: apiSignal
						});

			if (controller.signal.aborted) return;

			apiResults.set(api.id, {
				apiId: api.id,
				apiName: api.name,
				data: result ?? undefined,
				loading: false,
				timestamp: Date.now(),
				landscapeImageDataUrl: api.landscapeImageDataUrl
			});
			onUpdate(new Map(apiResults));
		} catch (error) {
			if (controller.signal.aborted) return;

			apiResults.set(api.id, {
				apiId: api.id,
				apiName: api.name,
				error: error instanceof Error ? error.message : 'Unknown error',
				loading: false,
				timestamp: Date.now(),
				landscapeImageDataUrl: api.landscapeImageDataUrl
			});
			onUpdate(new Map(apiResults));
		}
	});

	return () => {
		controller.abort();
	};
}

// Query multiple users with batch chunking
export async function queryMultipleUsers(
	userIds: string[],
	options?: QueryMultipleUsersOptions
): Promise<Map<string, CombinedStatus<UserStatus>>> {
	const lookupContext = options?.lookupContext;
	const signal = options?.signal;

	if (signal?.aborted) {
		throw getAbortError(signal);
	}

	// Block batch lookups when restricted unless it's own friends lookup
	const { isRestricted } = get(restrictedAccessStore);
	if (isRestricted && lookupContext !== 'friends') {
		const restrictedResult = createRestrictedResult();
		return new Map(userIds.map((userId) => [userId, restrictedResult]));
	}

	const endTrace = startTrace(TRACE_CATEGORIES.API, 'queryMultipleUsers', {
		userCount: userIds.length,
		lookupContext
	});
	const enabledApis = getEnabledCustomApis();

	// Initialize results map
	const results = new Map<string, CombinedStatus<UserStatus>>();
	userIds.forEach((userId) => {
		results.set(userId, new Map());
	});

	// Split user IDs into chunks
	const chunks = chunkArray(userIds, API_CONFIG.BATCH_SIZE);

	logger.debug('Unified batch query starting:', {
		userCount: userIds.length,
		chunks: chunks.length,
		totalApis: enabledApis.length
	});

	// Process each chunk
	let isFirstChunk = true;
	for (const chunk of chunks) {
		if (!isFirstChunk) {
			await abortableSleep(API_CONFIG.BATCH_DELAY, signal);
		}
		isFirstChunk = false;

		if (signal?.aborted) {
			throw getAbortError(signal);
		}

		// Query APIs in parallel
		const apiResults = await Promise.allSettled(
			enabledApis.map(async (api) =>
				api.isSystem && api.id === ROTECTOR_API_ID
					? apiClient.checkMultipleUsers(chunk, { lookupContext, signal })
					: apiClient.checkMultipleUsers(chunk, { apiConfig: api, signal })
			)
		);

		// Drop results if the caller aborted while requests were in flight
		if (signal?.aborted) {
			throw getAbortError(signal);
		}

		// Process each API's results
		enabledApis.forEach((api, apiIndex) => {
			const result = apiResults[apiIndex];
			if (!result) return;

			if (result.status === 'fulfilled') {
				// Map successful responses by user ID
				const userMap = new Map(result.value.map((status) => [status.id.toString(), status]));

				// Warm the shared cache for Rotector so per-user lookups hit cache
				if (api.isSystem && api.id === ROTECTOR_API_ID) {
					for (const status of result.value) {
						userStatusService.updateStatus(status.id.toString(), status);
					}
				}

				chunk.forEach((userId) => {
					const combined = results.get(userId);
					if (!combined) return;

					const userStatus = userMap.get(userId);

					combined.set(
						api.id,
						userStatus
							? {
									apiId: api.id,
									apiName: api.name,
									data: userStatus,
									loading: false,
									timestamp: Date.now(),
									landscapeImageDataUrl: api.landscapeImageDataUrl
								}
							: {
									apiId: api.id,
									apiName: api.name,
									loading: false,
									timestamp: Date.now(),
									landscapeImageDataUrl: api.landscapeImageDataUrl
								}
					);
				});
			} else {
				const errorMessage =
					result.reason instanceof Error ? result.reason.message : 'Unknown error';

				chunk.forEach((userId) => {
					const combined = results.get(userId);
					if (!combined) return;

					combined.set(api.id, {
						apiId: api.id,
						apiName: api.name,
						error: errorMessage,
						loading: false,
						timestamp: Date.now(),
						landscapeImageDataUrl: api.landscapeImageDataUrl
					});
				});

				logger.error('API batch error:', {
					chunkSize: chunk.length,
					apiId: api.id,
					apiName: api.name,
					error: result.reason as Error
				});
			}
		});
	}

	logger.debug('Unified batch query completed:', {
		userCount: userIds.length,
		chunks: chunks.length,
		totalApis: enabledApis.length
	});

	endTrace();
	return results;
}

// Count how many custom APIs flagged a user
export function countCustomApiFlags<T extends UserStatus | GroupStatus>(
	combined: CombinedStatus<T>
): number {
	let count = 0;
	for (const [apiId, result] of combined.entries()) {
		if (apiId === ROTECTOR_API_ID) continue;

		if (
			result.data &&
			(result.data.flagType === STATUS.FLAGS.UNSAFE ||
				result.data.flagType === STATUS.FLAGS.PENDING ||
				result.data.flagType === STATUS.FLAGS.MIXED ||
				result.data.flagType === STATUS.FLAGS.PAST_OFFENDER ||
				result.data.flagType === STATUS.FLAGS.REDACTED)
		) {
			count++;
		}
	}
	return count;
}
