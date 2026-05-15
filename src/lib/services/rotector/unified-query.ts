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
import { API_CONFIG, LOOKUP_CONTEXT, STATUS } from '../../types/constants';
import { SETTINGS_KEYS } from '../../types/settings';
import { isActionableResult } from '../../utils/status/status-utils';
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
		.toSorted((a, b) => a.order - b.order);
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

// Fans user IDs across every enabled API, routing Rotector through the cache-aware userStatusService and honoring restricted-access mode
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
	if (isRestricted && lookupContext !== LOOKUP_CONTEXT.FRIENDS) {
		const restrictedResult = createRestrictedResult();
		return new Map(userIds.map((userId) => [userId, restrictedResult]));
	}

	const endTrace = startTrace(TRACE_CATEGORIES.API, 'queryMultipleUsers', {
		userCount: userIds.length,
		lookupContext
	});
	const enabledApis = getEnabledCustomApis();

	const results = new Map<string, CombinedStatus<UserStatus>>();
	for (const userId of userIds) {
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
	}

	const setApiResult = (
		userId: string,
		api: CustomApiConfig,
		partial: { data?: UserStatus; error?: string }
	) => {
		const combined = results.get(userId);
		if (!combined) return;
		combined.set(api.id, {
			apiId: api.id,
			apiName: api.name,
			...partial,
			loading: false,
			timestamp: Date.now(),
			landscapeImageDataUrl: api.landscapeImageDataUrl
		});
		onUpdate?.(userId, new Map(combined));
	};

	const rotectorApi = enabledApis.find((api) => api.isSystem && api.id === ROTECTOR_API_ID);
	const nonRotectorApis = enabledApis.filter(
		(api) => !(api.isSystem && api.id === ROTECTOR_API_ID)
	);

	logger.debug('Unified batch query starting:', {
		userCount: userIds.length,
		totalApis: enabledApis.length
	});

	const rotectorPromise = (async () => {
		if (!rotectorApi) return;

		const toFetch: string[] = [];
		for (const userId of userIds) {
			const cached = userStatusService.getCachedStatus(userId);
			if (cached) {
				setApiResult(userId, rotectorApi, { data: cached });
			} else {
				toFetch.push(userId);
			}
		}
		if (toFetch.length === 0) return;

		const processChunk = async (chunk: string[]): Promise<void> => {
			try {
				const apiStatuses = await apiClient.checkMultipleUsers(chunk, { signal, lookupContext });
				if (signal?.aborted) return;
				const userMap = new Map(apiStatuses.map((s) => [s.id.toString(), s]));
				for (const status of apiStatuses) {
					userStatusService.updateStatus(status.id.toString(), status);
				}
				for (const userId of chunk) {
					const userStatus = userMap.get(userId);
					setApiResult(userId, rotectorApi, userStatus ? { data: userStatus } : {});
				}
			} catch (error) {
				if (signal?.aborted) return;
				const errorMessage = asApiError(error).message;
				for (const userId of chunk) {
					setApiResult(userId, rotectorApi, { error: errorMessage });
				}
				logger.error('Rotector batch error:', { chunkSize: chunk.length, error: errorMessage });
			}
		};

		const chunks = chunkArray(toFetch, API_CONFIG.BATCH_SIZE);
		for (const [i, chunk] of chunks.entries()) {
			if (i > 0) await abortableSleep(API_CONFIG.BATCH_DELAY, signal);
			if (signal?.aborted) throw getAbortError(signal);
			await processChunk(chunk);
		}
	})();

	const nonRotectorPromise = (async () => {
		if (nonRotectorApis.length === 0) return;
		const chunks = chunkArray(userIds, API_CONFIG.BATCH_SIZE);

		for (const [i, chunk] of chunks.entries()) {
			if (i > 0) {
				await abortableSleep(API_CONFIG.BATCH_DELAY, signal);
			}
			if (signal?.aborted) throw getAbortError(signal);

			await Promise.all(
				nonRotectorApis.map(async (api) => {
					try {
						const apiStatuses = await apiClient.checkMultipleUsers(chunk, {
							signal,
							apiConfig: api
						});
						if (signal?.aborted) return;
						const userMap = new Map(apiStatuses.map((s) => [s.id.toString(), s]));
						for (const userId of chunk) {
							const userStatus = userMap.get(userId);
							setApiResult(userId, api, userStatus ? { data: userStatus } : {});
						}
					} catch (error) {
						if (signal?.aborted) return;
						const errorMessage = asApiError(error).message;
						for (const userId of chunk) {
							setApiResult(userId, api, { error: errorMessage });
						}
						logger.error('API batch error:', {
							chunkSize: chunk.length,
							apiId: api.id,
							apiName: api.name,
							error: errorMessage
						});
					}
				})
			);

			if (signal?.aborted) throw getAbortError(signal);
		}
	})();

	await Promise.all([rotectorPromise, nonRotectorPromise]);

	if (signal?.aborted) throw getAbortError(signal);

	logger.debug('Unified batch query completed:', {
		userCount: userIds.length,
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
		if (isActionableResult(result)) count++;
	}
	return count;
}

// Choose the default active tab for a combined status
export function pickDefaultTab<T extends UserStatus | GroupStatus>(
	combined: CombinedStatus<T>,
	preferred: string | undefined
): string | null {
	if (preferred && combined.has(preferred)) return preferred;

	const values = [...combined.values()];
	const allSettled = values.every((result) => !result.loading);
	if (!allSettled) return null;

	const rotector = combined.get(ROTECTOR_API_ID);
	const allApisSafe = values.every(
		(result) => !result.data || result.data.flagType === STATUS.FLAGS.SAFE
	);

	if (rotector?.data?.flagType === STATUS.FLAGS.SAFE && combined.size > 1 && !allApisSafe) {
		const firstCustomWithDetection = [...combined.entries()].find(
			([id, result]) =>
				id !== ROTECTOR_API_ID && result.data && result.data.flagType !== STATUS.FLAGS.SAFE
		);
		if (firstCustomWithDetection) return firstCustomWithDetection[0];
	}

	return ROTECTOR_API_ID;
}
