import { get } from 'svelte/store';
import type { GroupStatus } from '../../types/api';
import type { CombinedStatus } from '../../types/custom-api';
import { groupStatusService } from './entity-status';
import { restrictedAccessStore } from '../../stores/restricted-access';
import { asApiError } from '../../utils/api/api-error';
import { wrapGroupStatus } from '../../utils/status/status-utils';

export interface GroupQuerySubscription {
	subscribe(callback: (status: CombinedStatus<GroupStatus>) => void): () => void;
	cancel(): void;
}

// Emits a loading status synchronously, then resolves to the real group status or restricted-access marker
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

	const { isRestricted } = get(restrictedAccessStore);
	if (isRestricted) {
		currentStatus = wrapGroupStatus(null, false, 'restricted_access');
	} else {
		currentStatus = wrapGroupStatus(null, true);

		groupStatusService
			.getStatus(groupId)
			.then((status) => {
				if (cancelled) return;
				const wrapped = wrapGroupStatus(status, false);
				if (wrapped) emit(wrapped);
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				const message = asApiError(error).message;
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
