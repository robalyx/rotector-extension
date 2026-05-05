import type { ExportResult } from '@/lib/types/api';
import { API_CONFIG } from '@/lib/types/constants';
import { makeHttpRequest } from '../http-client';
import { validateEntityId } from '@/lib/utils/dom/sanitizer';

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

	return makeHttpRequest<ExportResult>(url, {
		method: 'GET',
		timeout: API_CONFIG.EXPORT_TIMEOUT,
		headers: { Accept: '*/*' },
		parseResponse: async (response) => {
			const content = await response.text();

			const disposition = response.headers.get('Content-Disposition');
			if (!disposition) {
				throw new Error('Response missing Content-Disposition header');
			}
			const filenameMatch = /filename="?([^";\n]+)"?/.exec(disposition);
			if (!filenameMatch?.[1]) {
				throw new Error('Content-Disposition header missing filename');
			}

			const mimeType = response.headers.get('Content-Type');
			if (!mimeType) {
				throw new Error('Response missing Content-Type header');
			}

			return { content, filename: filenameMatch[1], mimeType };
		}
	});
}
