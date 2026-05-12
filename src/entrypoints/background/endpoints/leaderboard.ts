import type { Leaderboard, LeaderboardWindow } from '@/lib/types/api';
import { API_CONFIG } from '@/lib/types/constants';
import { parseLeaderboard } from '@/lib/schemas/rotector';
import { makeHttpRequest } from '../http-client';

export async function getLeaderboard(
	window: LeaderboardWindow,
	limit: number | undefined,
	cursor: number | undefined
): Promise<Leaderboard> {
	const params = new URLSearchParams({ window });
	if (limit !== undefined) params.set('limit', String(limit));
	if (cursor !== undefined) params.set('cursor', String(cursor));
	return makeHttpRequest(`${API_CONFIG.ENDPOINTS.LEADERBOARD}?${params.toString()}`, {
		method: 'GET',
		parse: parseLeaderboard
	});
}
