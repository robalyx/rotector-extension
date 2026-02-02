import type { CombinedStatus, CustomApiConfig, CustomApiResult } from '../types/custom-api';
import type { UserStatus } from '../types/api';
import { apiClient } from './api-client';
import { customApis, ROTECTOR_API_ID } from '../stores/custom-apis';
import { restrictedAccessStore } from '../stores/restricted-access';
import { settings } from '../stores/settings';
import { getLoggedInUserId } from '../utils/client-id';
import { logger } from '../utils/logger';
import { startTrace, traceAsync, TRACE_CATEGORIES } from '../utils/perf-tracer';
import { chunkArray } from '../utils/array';
import { API_CONFIG, STATUS } from '../types/constants';
import { SETTINGS_KEYS } from '../types/settings';
import { get } from 'svelte/store';

// Re-export for components
export { ROTECTOR_API_ID };

// Check if lookup should be blocked due to restricted access
function shouldBlockLookup(userId: string): boolean {
	const { isRestricted } = get(restrictedAccessStore);
	if (!isRestricted) return false;

	const loggedInUserId = getLoggedInUserId();
	return loggedInUserId !== userId;
}

// Create a restricted access result for blocked lookups
function createRestrictedResult(): CombinedStatus {
	const enabledApis = getEnabledCustomApis();
	return {
		customApis: new Map(
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
		)
	};
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
	result: PromiseSettledResult<UserStatus>
): CustomApiResult {
	const base = {
		apiId: api.id,
		apiName: api.name,
		loading: false,
		timestamp: Date.now(),
		landscapeImageDataUrl: api.landscapeImageDataUrl
	};

	if (result.status === 'fulfilled') {
		return { ...base, data: result.value };
	}

	const errorMessage = result.reason instanceof Error ? result.reason.message : 'Unknown error';
	return { ...base, error: errorMessage };
}

// Query a single user from all enabled APIs
export async function queryUser(userId: string): Promise<CombinedStatus> {
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
						? apiClient.checkUser(userId)
						: apiClient.checkUser(userId, { apiConfig: api })
				)
			);

			// Format results
			const customApiResults = new Map(
				enabledApis.map((api, i) => [api.id, formatApiResult(api, results[i])])
			);

			logger.debug('Unified query completed:', {
				userId,
				totalApis: enabledApis.length,
				successfulApis: Array.from(customApiResults.values()).filter((r) => r.data).length
			});

			return { customApis: customApiResults };
		},
		{ userId }
	);
}

// Query a single user with progressive updates as each API completes
export function queryUserProgressive(
	userId: string,
	onUpdate: (status: CombinedStatus) => void
): () => void {
	if (shouldBlockLookup(userId)) {
		onUpdate(createRestrictedResult());
		return () => {};
	}

	const enabledApis = getEnabledCustomApis();
	let cancelled = false;

	// Initialize with loading state for all APIs
	const customApis = new Map<string, CustomApiResult>(
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
	onUpdate({ customApis: new Map(customApis) });

	// Fire all requests in parallel then update on each completion
	enabledApis.forEach(async (api) => {
		try {
			const result =
				api.isSystem && api.id === ROTECTOR_API_ID
					? await apiClient.checkUser(userId)
					: await apiClient.checkUser(userId, { apiConfig: api });

			if (cancelled) return;

			customApis.set(api.id, {
				apiId: api.id,
				apiName: api.name,
				data: result,
				loading: false,
				timestamp: Date.now(),
				landscapeImageDataUrl: api.landscapeImageDataUrl
			});
			onUpdate({ customApis: new Map(customApis) });
		} catch (error) {
			if (cancelled) return;

			customApis.set(api.id, {
				apiId: api.id,
				apiName: api.name,
				error: error instanceof Error ? error.message : 'Unknown error',
				loading: false,
				timestamp: Date.now(),
				landscapeImageDataUrl: api.landscapeImageDataUrl
			});
			onUpdate({ customApis: new Map(customApis) });
		}
	});

	return () => {
		cancelled = true;
	};
}

// Query multiple users with batch chunking
export async function queryMultipleUsers(
	userIds: string[],
	lookupContext?: string
): Promise<Map<string, CombinedStatus>> {
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
	const results = new Map<string, CombinedStatus>();
	userIds.forEach((userId) => {
		results.set(userId, { customApis: new Map() });
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
			await new Promise((resolve) => setTimeout(resolve, API_CONFIG.BATCH_DELAY));
		}
		isFirstChunk = false;

		// Query APIs in parallel
		const apiResults = await Promise.allSettled(
			enabledApis.map(async (api) =>
				api.isSystem && api.id === ROTECTOR_API_ID
					? apiClient.checkMultipleUsers(chunk, { lookupContext })
					: apiClient.checkMultipleUsers(chunk, { apiConfig: api })
			)
		);

		// Process each API's results
		enabledApis.forEach((api, apiIndex) => {
			const result = apiResults[apiIndex];

			if (result.status === 'fulfilled') {
				// Map successful responses by user ID
				const userMap = new Map(result.value.map((status) => [status.id.toString(), status]));

				chunk.forEach((userId) => {
					const combined = results.get(userId);
					if (!combined) return;

					const userStatus = userMap.get(userId);

					combined.customApis.set(
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
									error: 'User not found in response',
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

					combined.customApis.set(api.id, {
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
export function countCustomApiFlags(combined: CombinedStatus): number {
	let count = 0;
	for (const [apiId, result] of combined.customApis.entries()) {
		if (apiId === ROTECTOR_API_ID) continue;

		if (
			result.data &&
			(result.data.flagType === STATUS.FLAGS.UNSAFE ||
				result.data.flagType === STATUS.FLAGS.PENDING ||
				result.data.flagType === STATUS.FLAGS.MIXED ||
				result.data.flagType === STATUS.FLAGS.PAST_OFFENDER)
		) {
			count++;
		}
	}
	return count;
}
