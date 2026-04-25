import { logger } from '../utils/logger';

const BLOCK_USER_ENDPOINT = 'https://apis.roblox.com/user-blocking-api/v1/users';

// Block a Roblox user via the user-blocking API. Handles Roblox's CSRF flow by retrying
// once with the X-CSRF-TOKEN header returned from the initial 403 response.
export async function blockUser(userId: string | number): Promise<void> {
	const url = `${BLOCK_USER_ENDPOINT}/${String(userId)}/block-user`;

	const send = async (token?: string) => {
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (token) headers['X-CSRF-TOKEN'] = token;
		return fetch(url, { method: 'POST', credentials: 'include', headers, body: '{}' });
	};

	let response = await send();

	if (response.status === 403) {
		const token = response.headers.get('X-CSRF-TOKEN');
		if (!token) {
			throw new Error('Block failed: CSRF token missing from 403 response');
		}
		response = await send(token);
	}

	if (!response.ok) {
		throw new Error(`Block failed: HTTP ${String(response.status)}`);
	}

	logger.debug('Blocked user', { userId });
}
