import type { CombinedStatus, CustomApiConfig, CustomApiResult } from '../../types/custom-api';
import type { GroupStatus, UserStatus } from '../../types/api';
import { apiClient } from './api-client';
import { userStatusService } from './entity-status';
import { customApis, ROTECTOR_API_ID } from '../../stores/custom-apis';
import { restrictedAccessStore } from '../../stores/restricted-access';
import { settings } from '../../stores/settings';
import { getLoggedInUserId } from '../../utils/client-id';
import { logger } from '../../utils/logging/logger';
import { startTrace } from '../../utils/logging/perf-tracer';
import { TRACE_CATEGORIES } from '../../types/performance';
import { chunkArray } from '../../utils/array';
import { abortableSleep, getAbortError } from '../../utils/abort';
import { asApiError } from '../../utils/api/api-error';
import { API_CONFIG, STATUS } from '../../types/constants';
import { SETTINGS_KEYS } from '../../types/settings';
import { get } from 'svelte/store';

interface QueryMultipleUsersOptions {
	lookupContext?: string | undefined;
	signal?: AbortSignal | undefined;
	onUpdate?: ((userId: string, status: CombinedStatus<UserStatus>) => void) | undefined;
}

function shouldBlockLookup(userId: string): boolean {
	const { isRestricted } = get(restrictedAccessStore);
	return isRestricted && getLoggedInUserId() !== userId;
}

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

function getEnabledCustomApis(): CustomApiConfig[] {
	const s = get(settings);
	const experimentalCustomApisEnabled = s[SETTINGS_KEYS.EXPERIMENTAL_CUSTOM_APIS_ENABLED];

	return get(customApis)
		.filter((api) => api.enabled && (api.isSystem || experimentalCustomApisEnabled))
		.sort((a, b) => a.order - b.order);
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

	enabledApis.forEach(async (api) => {
		const apiSignal = AbortSignal.any([
			controller.signal,
			AbortSignal.timeout(API_CONFIG.PROGRESSIVE_API_TIMEOUT)
		]);
		const base = {
			apiId: api.id,
			apiName: api.name,
			loading: false,
			timestamp: Date.now(),
			landscapeImageDataUrl: api.landscapeImageDataUrl
		};
		try {
			const result =
				api.isSystem && api.id === ROTECTOR_API_ID
					? await userStatusService.getStatus(userId, { signal: apiSignal })
					: await apiClient.checkUser(userId, {
							apiConfig: api,
							signal: apiSignal
						});

			if (controller.signal.aborted) return;

			apiResults.set(api.id, { ...base, data: result ?? undefined });
			onUpdate(new Map(apiResults));
		} catch (error) {
			if (controller.signal.aborted) return;

			apiResults.set(api.id, {
				...base,
				error: asApiError(error).message
			});
			onUpdate(new Map(apiResults));
		}
	});

	return () => {
		controller.abort();
	};
}

// Fans batched user IDs across every enabled API, warming the Rotector cache and honoring restricted-access mode
export async function queryMultipleUsers(
	userIds: string[],
	options?: QueryMultipleUsersOptions
): Promise<Map<string, CombinedStatus<UserStatus>>> {
	const lookupContext = options?.lookupContext;
	const signal = options?.signal;
	const onUpdate = options?.onUpdate;

	if (signal?.aborted) {
		throw getAbortError(signal);
	}

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

	const results = new Map<string, CombinedStatus<UserStatus>>();
	userIds.forEach((userId) => {
		results.set(
			userId,
			new Map(
				enabledApis.map((api) => [
					api.id,
					{
						apiId: api.id,
						apiName: api.name,
						loading: true,
						landscapeImageDataUrl: api.landscapeImageDataUrl
					}
				])
			)
		);
	});

	const chunks = chunkArray(userIds, API_CONFIG.BATCH_SIZE);

	logger.debug('Unified batch query starting:', {
		userCount: userIds.length,
		chunks: chunks.length,
		totalApis: enabledApis.length
	});

	const emitUpdate = (userId: string) => {
		const combined = results.get(userId);
		if (!combined) return;
		onUpdate?.(userId, new Map(combined));
	};

	for (const [i, chunk] of chunks.entries()) {
		if (i > 0) {
			await abortableSleep(API_CONFIG.BATCH_DELAY, signal);
		}

		if (signal?.aborted) {
			throw getAbortError(signal);
		}

		const apiRequests = enabledApis.map(async (api) => {
			const isRotector = api.isSystem && api.id === ROTECTOR_API_ID;

			try {
				const apiStatuses = await apiClient.checkMultipleUsers(chunk, {
					signal,
					...(isRotector ? { lookupContext } : { apiConfig: api })
				});

				if (signal?.aborted) return;

				const userMap = new Map(apiStatuses.map((status) => [status.id.toString(), status]));

				if (isRotector) {
					for (const status of apiStatuses) {
						userStatusService.updateStatus(status.id.toString(), status);
					}
				}

				chunk.forEach((userId) => {
					const combined = results.get(userId);
					if (!combined) return;

					const userStatus = userMap.get(userId);

					combined.set(api.id, {
						apiId: api.id,
						apiName: api.name,
						...(userStatus && { data: userStatus }),
						loading: false,
						timestamp: Date.now(),
						landscapeImageDataUrl: api.landscapeImageDataUrl
					});
					emitUpdate(userId);
				});
			} catch (error) {
				if (signal?.aborted) return;

				const errorMessage = asApiError(error).message;

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
					emitUpdate(userId);
				});

				logger.error('API batch error:', {
					chunkSize: chunk.length,
					apiId: api.id,
					apiName: api.name,
					error: errorMessage
				});
			}
		});

		await Promise.all(apiRequests);

		if (signal?.aborted) {
			throw getAbortError(signal);
		}
	}

	logger.debug('Unified batch query completed:', {
		userCount: userIds.length,
		chunks: chunks.length,
		totalApis: enabledApis.length
	});

	endTrace();
	return results;
}

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

// Choose the default active tab for a combined status
export function pickDefaultTab<T extends UserStatus | GroupStatus>(
	combined: CombinedStatus<T>,
	preferred: string | undefined
): string | null {
	if (preferred && combined.has(preferred)) return preferred;

	const values = Array.from(combined.values());
	const allSettled = values.every((result) => !result.loading);
	if (!allSettled) return null;

	const rotector = combined.get(ROTECTOR_API_ID);
	const allApisSafe = values.every(
		(result) => !result.data || result.data.flagType === STATUS.FLAGS.SAFE
	);

	if (rotector?.data?.flagType === STATUS.FLAGS.SAFE && combined.size > 1 && !allApisSafe) {
		const firstCustomWithDetection = Array.from(combined.entries()).find(
			([id, result]) =>
				id !== ROTECTOR_API_ID && result.data && result.data.flagType !== STATUS.FLAGS.SAFE
		);
		if (firstCustomWithDetection) return firstCustomWithDetection[0];
	}

	return ROTECTOR_API_ID;
}
