import type { CombinedStatus } from '../types/custom-api';
import { queryUserProgressive } from '../services/unified-query-service';

export interface ProfileQuerySubscription {
	readonly currentStatus: CombinedStatus | null;
	subscribe(callback: (status: CombinedStatus) => void): () => void;
	cancel(): void;
}

export function startProfileQuery(userId: string): ProfileQuerySubscription {
	let currentStatus: CombinedStatus | null = null;
	const subscribers = new Set<(status: CombinedStatus) => void>();

	const cancelQuery = queryUserProgressive(userId, (status) => {
		currentStatus = status;
		subscribers.forEach((cb) => {
			cb(status);
		});
	});

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
			cancelQuery();
			subscribers.clear();
		}
	};
}
