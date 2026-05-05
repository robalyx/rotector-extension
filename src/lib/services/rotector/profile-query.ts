import type { UserStatus } from '../../types/api';
import type { CombinedStatus } from '../../types/custom-api';
import { queryUserProgressive } from './unified-query';

export interface ProfileQuerySubscription {
	subscribe(callback: (status: CombinedStatus<UserStatus>) => void): () => void;
	refresh(): void;
	cancel(): void;
}

// Starts a progressive unified query and fans updates to subscribers, replaying the last status to late subscribers
export function startProfileQuery(userId: string): ProfileQuerySubscription {
	let currentStatus: CombinedStatus<UserStatus> | null = null;
	const subscribers = new Set<(status: CombinedStatus<UserStatus>) => void>();

	function emit(status: CombinedStatus<UserStatus>): void {
		currentStatus = status;
		subscribers.forEach((cb) => {
			cb(status);
		});
	}

	let cancelQuery = queryUserProgressive(userId, emit);

	return {
		subscribe(callback) {
			subscribers.add(callback);
			if (currentStatus) callback(currentStatus);
			return () => subscribers.delete(callback);
		},
		refresh() {
			cancelQuery();
			cancelQuery = queryUserProgressive(userId, emit);
		},
		cancel() {
			cancelQuery();
			subscribers.clear();
		}
	};
}
