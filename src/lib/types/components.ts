/**
 * Component instance types for Svelte components
 */

import type { UserStatus } from './api';

export interface QueueModalManagerInstance {
	showQueue: (userId: string, isReprocess?: boolean, userStatus?: UserStatus | null) => void;
	hideQueue: () => void;
}
