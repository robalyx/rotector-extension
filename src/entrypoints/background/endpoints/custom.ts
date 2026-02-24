import type { UserStatus } from '@/lib/types/api';
import type { CustomApiConfig } from '@/lib/types/custom-api';
import { makeHttpRequest } from '../http-client';
import { validateUserStatusResponse } from '@/lib/stores/custom-apis';
import { logger } from '@/lib/utils/logger';
import { validateEntityId, processBatchEntityIds } from '../utils';

// Check user status from a custom API
export async function customApiCheckUser(
	apiConfig: CustomApiConfig,
	userId: string | number
): Promise<UserStatus> {
	const sanitizedUserId = validateEntityId(userId);

	logger.debug('Background: Custom API check user', {
		apiId: apiConfig.id,
		apiName: apiConfig.name,
		userId: sanitizedUserId
	});

	const fullUrl = apiConfig.singleUrl.replace('{userId}', sanitizedUserId);

	const data = await makeHttpRequest(fullUrl, {
		method: 'GET',
		customApi: apiConfig,
		timeout: apiConfig.timeout
	});

	// Validate response schema
	const validation = validateUserStatusResponse(data);
	if (!validation.valid) {
		throw new Error(`Invalid response schema: ${validation.errors.join(', ')}`);
	}

	return data as UserStatus;
}

// Check multiple users from a custom API with batching
export async function customApiCheckMultipleUsers(
	apiConfig: CustomApiConfig,
	userIds: Array<string | number>
): Promise<UserStatus[]> {
	const sanitizedUserIds = processBatchEntityIds(userIds);

	logger.debug('Background: Custom API check multiple users', {
		apiId: apiConfig.id,
		apiName: apiConfig.name,
		count: sanitizedUserIds.length
	});

	const data = await makeHttpRequest(apiConfig.batchUrl, {
		method: 'POST',
		body: JSON.stringify({ ids: sanitizedUserIds.map((id) => parseInt(id, 10)) }),
		customApi: apiConfig,
		timeout: apiConfig.timeout
	});

	// Batch response data is an object with user IDs as keys
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		throw new Error('Batch response data must be an object with user IDs as keys');
	}

	// Convert object to array of UserStatus objects
	const userStatusArray = Object.values(data);

	// Validate each response in the batch
	for (const item of userStatusArray) {
		const validation = validateUserStatusResponse(item);
		if (!validation.valid) {
			throw new Error(`Invalid response schema in batch: ${validation.errors.join(', ')}`);
		}
	}

	return userStatusArray as UserStatus[];
}
