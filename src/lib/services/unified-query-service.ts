import type { CombinedStatus, CustomApiConfig, CustomApiResult } from '../types/custom-api';
import type { UserStatus } from '../types/api';
import { apiClient } from './api-client';
import { customApis, ROTECTOR_API_ID } from '../stores/custom-apis';
import { logger } from '../utils/logger';
import { STATUS } from '../types/constants';
import { get } from 'svelte/store';

// Re-export for components
export { ROTECTOR_API_ID };

// Get enabled custom APIs sorted by order
function getEnabledCustomApis(): CustomApiConfig[] {
	return get(customApis)
		.filter((api) => api.enabled)
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
}

// Query a single user with progressive updates as each API completes
export function queryUserProgressive(
	userId: string,
	onUpdate: (status: CombinedStatus) => void
): () => void {
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

// Query multiple users with batch optimization
export async function queryMultipleUsers(
	userIds: string[],
	lookupContext?: string
): Promise<Map<string, CombinedStatus>> {
	const enabledApis = getEnabledCustomApis();

	// Query all APIs in parallel
	const apiResults = await Promise.allSettled(
		enabledApis.map(async (api) =>
			api.isSystem && api.id === ROTECTOR_API_ID
				? apiClient.checkMultipleUsers(userIds, { lookupContext })
				: apiClient.checkMultipleUsers(userIds, { apiConfig: api })
		)
	);

	// Initialize results map
	const results = new Map<string, CombinedStatus>();
	userIds.forEach((userId) => {
		results.set(userId, { customApis: new Map() });
	});

	// Process each API's results
	enabledApis.forEach((api, apiIndex) => {
		const result = apiResults[apiIndex];

		if (result.status === 'fulfilled') {
			// Map successful responses by user ID
			const userMap = new Map(result.value.map((status) => [status.id.toString(), status]));

			userIds.forEach((userId) => {
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
			const errorMessage = result.reason instanceof Error ? result.reason.message : 'Unknown error';

			userIds.forEach((userId) => {
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
				userCount: userIds.length,
				apiId: api.id,
				apiName: api.name,
				error: result.reason as Error
			});
		}
	});

	logger.debug('Unified batch query completed:', {
		userCount: userIds.length,
		totalApis: enabledApis.length
	});

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
