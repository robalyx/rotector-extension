import { get } from 'svelte/store';
import type { CombinedStatus } from '../types/custom-api';
import { groupStatusService } from '../services/entity-status-service';
import { restrictedAccessStore } from '../stores/restricted-access';
import { wrapGroupStatus } from './status-utils';

export interface GroupQuerySubscription {
	readonly currentStatus: CombinedStatus | null;
	subscribe(callback: (status: CombinedStatus) => void): () => void;
	cancel(): void;
}

export function startGroupQuery(groupId: string): GroupQuerySubscription {
	let currentStatus: CombinedStatus | null = null;
	let cancelled = false;
	const subscribers = new Set<(status: CombinedStatus) => void>();

	function emit(status: CombinedStatus) {
		currentStatus = status;
		subscribers.forEach((cb) => {
			cb(status);
		});
	}

	// Check restricted access
	const { isRestricted } = get(restrictedAccessStore);
	if (isRestricted) {
		currentStatus = wrapGroupStatus(null, false, 'restricted_access');
		queueMicrotask(() => {
			if (!cancelled && currentStatus) emit(currentStatus);
		});
	} else {
		// Emit loading state
		currentStatus = wrapGroupStatus(null, true);
		queueMicrotask(() => {
			if (!cancelled && currentStatus) emit(currentStatus);
		});

		// Start fetch
		groupStatusService
			.getStatus(groupId)
			.then((status) => {
				if (cancelled) return;
				const wrapped = wrapGroupStatus(status, false);
				if (wrapped) emit(wrapped);
			})
			.catch((error: Error) => {
				if (cancelled) return;
				const wrapped = wrapGroupStatus(null, false, error.message);
				if (wrapped) emit(wrapped);
			});
	}

	return {
		get currentStatus() {
			return currentStatus;
		},
		subscribe(callback) {
			subscribers.add(callback);
			if (currentStatus) callback(currentStatus);
			return () => subscribers.delete(callback);
		},
		cancel() {
			cancelled = true;
			subscribers.clear();
		}
	};
}
