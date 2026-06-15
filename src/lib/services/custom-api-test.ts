import type { CustomApiConfig } from '@/lib/types/custom-api';
import { apiClient } from '@/lib/services/rotector/api-client';
import { logger } from '@/lib/utils/logging/logger';

const TEST_USER_ID = 1;

// Probe single + batch endpoints where both must validate against the schema for
// the test to pass. Routed through background so retries and rate-limit handling apply.
export async function testCustomApiConnection(api: CustomApiConfig): Promise<boolean> {
	try {
		await apiClient.checkUser(TEST_USER_ID, { apiConfig: api });
		await apiClient.checkMultipleUsers([TEST_USER_ID], { apiConfig: api });
		return true;
	} catch (error) {
		logger.debug('Custom API connection test failed:', {
			apiId: api.id,
			singleUrl: api.singleUrl,
			batchUrl: api.batchUrl,
			error
		});
		return false;
	}
}
