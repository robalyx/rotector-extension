import type { UserStatus } from '@/lib/types/api';

// Public handle exposed by QueueModalManager.svelte via `bind:this`
export interface QueueModalManagerInstance {
	showQueue: (userId: string, isReprocess?: boolean, userStatus?: UserStatus | null) => void;
}
