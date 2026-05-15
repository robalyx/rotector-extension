import { SvelteMap } from 'svelte/reactivity';
import type { VoteData } from '../../types/api';
import type { VoteType } from '../../types/constants';
import { apiClient } from '../rotector/api-client';
import { getCacheTtlMs } from '../../stores/settings';
import { asApiError } from '../../utils/api/api-error';
import { logger } from '../../utils/logging/logger';

export interface VoteState {
	data: VoteData | null;
	loading: boolean;
	error: string | null;
	accessDenied: boolean;
	timestamp: number;
}

const DEFAULT_STATE: VoteState = {
	data: null,
	loading: false,
	error: null,
	accessDenied: false,
	timestamp: 0
};

const states = new SvelteMap<string, VoteState>();

export function getVoteState(userId: string | number): VoteState {
	return states.get(String(userId)) ?? DEFAULT_STATE;
}

export async function loadVoteData(userId: string | number): Promise<void> {
	const key = String(userId);
	const existing = states.get(key);
	if (existing?.data && Date.now() - existing.timestamp < getCacheTtlMs()) return;
	if (existing?.loading) return;

	states.set(key, { ...(existing ?? DEFAULT_STATE), loading: true, error: null });

	try {
		const data = await apiClient.getVotes(key);
		states.set(key, {
			data,
			loading: false,
			error: null,
			accessDenied: false,
			timestamp: Date.now()
		});
	} catch (error) {
		applyError(key, error, 'Failed to load voting data');
	}
}

export async function submitVoteData(userId: string | number, voteType: VoteType): Promise<void> {
	const key = String(userId);
	const existing = states.get(key) ?? DEFAULT_STATE;
	if (existing.loading) return;

	states.set(key, { ...existing, loading: true, error: null });

	try {
		const result = await apiClient.submitVote(key, voteType);
		states.set(key, {
			data: result.newVoteData,
			loading: false,
			error: null,
			accessDenied: false,
			timestamp: Date.now()
		});
		logger.userAction('vote_submitted', { userId: key, voteType, success: true });
	} catch (error) {
		applyError(key, error, 'Failed to submit vote');
	}
}

function applyError(key: string, err: unknown, fallbackMessage: string): void {
	const current = states.get(key) ?? DEFAULT_STATE;
	if (asApiError(err).type === 'AbuseDetectionError') {
		states.set(key, { ...current, loading: false, accessDenied: true });
		return;
	}
	states.set(key, { ...current, loading: false, error: fallbackMessage });
	logger.error(fallbackMessage, err);
}
