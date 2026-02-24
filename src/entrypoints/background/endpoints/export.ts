import type { ExportResult } from '@/lib/types/api';
import { API_CONFIG } from '@/lib/types/constants';
import { makeRawHttpRequest } from '../http-client';
import { validateEntityId } from '../utils';

// Export tracked users for a group as JSON or CSV
export async function exportGroupTrackedUsers(
	groupId: string | number,
	params: {
		format: 'json' | 'csv';
		columns: string[];
		sort: string;
		order: 'asc' | 'desc';
	}
): Promise<ExportResult> {
	const sanitizedGroupId = validateEntityId(groupId);

	const queryParams = new URLSearchParams();
	queryParams.set('format', params.format);
	queryParams.set('columns', params.columns.join(','));
	queryParams.set('sort', params.sort);
	queryParams.set('order', params.order);

	const url = `${API_CONFIG.ENDPOINTS.EXPORT_GROUP_TRACKED_USERS}/${sanitizedGroupId}/tracked-users?${queryParams.toString()}`;

	return makeRawHttpRequest(url, { method: 'GET' });
}
