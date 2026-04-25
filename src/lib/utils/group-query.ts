import { get } from 'svelte/store';
import type { GroupStatus } from '../types/api';
import type { CombinedStatus } from '../types/custom-api';
import { groupStatusService } from '../services/entity-status-service';
import { restrictedAccessStore } from '../stores/restricted-access';
import { wrapGroupStatus } from './status-utils';

export interface GroupQuerySubscription {
	subscribe(callback: (status: CombinedStatus<GroupStatus>) => void): () => void;
	cancel(): void;
}

export function startGroupQuery(groupId: string): GroupQuerySubscription {
	let currentStatus: CombinedStatus<GroupStatus> | null = null;
	let cancelled = false;
	const subscribers = new Set<(status: CombinedStatus<GroupStatus>) => void>();

	function emit(status: CombinedStatus<GroupStatus>) {
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
			.catch((error: unknown) => {
				if (cancelled) return;
				const message = error instanceof Error ? error.message : String(error);
				const wrapped = wrapGroupStatus(null, false, message);
				if (wrapped) emit(wrapped);
			});
	}

	return {
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
