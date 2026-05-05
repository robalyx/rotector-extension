import * as v from 'valibot';
import { logger } from '@/lib/utils/logging/logger';
import { getStorage, setStorage, subscribeStorageKey } from '@/lib/utils/storage';

const SESSION_CACHE_KEY = '_session_cache';

const SessionStateSchema = v.object({
	_v: v.literal(1),
	_t: v.number()
});

export interface SessionRestrictedState {
	isRestricted: boolean;
	timestamp: number | null;
}

const NOT_RESTRICTED: SessionRestrictedState = { isRestricted: false, timestamp: null };

function parseSessionState(stored: unknown): SessionRestrictedState {
	const result = v.safeParse(SessionStateSchema, stored);
	return result.success ? { isRestricted: true, timestamp: result.output._t } : NOT_RESTRICTED;
}

// Records a new restriction incident. Each call refreshes the timestamp so
// reactive observers can distinguish a new incident from a previously-acknowledged one.
export async function markSessionRestricted(): Promise<void> {
	await setStorage('local', SESSION_CACHE_KEY, { _v: 1, _t: Date.now() });
	logger.warn('Session restriction recorded');
}

export async function readSessionRestricted(): Promise<SessionRestrictedState> {
	const stored = await getStorage<unknown>('local', SESSION_CACHE_KEY, undefined);
	return parseSessionState(stored);
}

export function subscribeSessionRestricted(
	handler: (state: SessionRestrictedState) => void
): () => void {
	return subscribeStorageKey<unknown>('local', SESSION_CACHE_KEY, (newValue) => {
		handler(parseSessionState(newValue));
	});
}
