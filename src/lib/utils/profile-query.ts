import type { UserStatus } from '../types/api';
import type { CombinedStatus } from '../types/custom-api';
import { queryUserProgressive } from '../services/unified-query-service';

export interface ProfileQuerySubscription {
	subscribe(callback: (status: CombinedStatus<UserStatus>) => void): () => void;
	cancel(): void;
}

export function startProfileQuery(userId: string): ProfileQuerySubscription {
	let currentStatus: CombinedStatus<UserStatus> | null = null;
	const subscribers = new Set<(status: CombinedStatus<UserStatus>) => void>();

	const cancelQuery = queryUserProgressive(userId, (status) => {
		currentStatus = status;
		subscribers.forEach((cb) => {
			cb(status);
		});
	});

	return {
		subscribe(callback) {
			subscribers.add(callback);
			if (currentStatus) callback(currentStatus);
			return () => subscribers.delete(callback);
		},
		cancel() {
			cancelQuery();
			subscribers.clear();
		}
	};
}
