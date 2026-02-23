<script lang="ts">
	import { apiClient } from '@/lib/services/api-client';
	import { userStatusService } from '@/lib/services/entity-status-service';
	import { addQueueEntry, queueHistory } from '@/lib/stores/queue-history';
	import { STATUS } from '@/lib/types/constants';
	import { logger } from '@/lib/utils/logger';
	import type { QueueErrorData, QueueSuccessData, UserStatus } from '@/lib/types/api';
	import QueuePopup from './QueuePopup.svelte';
	import QueueLoadingModal from './QueueLoadingModal.svelte';
	import QueueSuccessModal from './QueueSuccessModal.svelte';
	import QueueErrorModal from './QueueErrorModal.svelte';

	interface Props {
		onStatusRefresh?: (userId: string) => Promise<void> | void;
	}

	let { onStatusRefresh }: Props = $props();

	// Queue modal state
	let showQueueModal = $state(false);
	let queueUserId = $state<string>('');
	let isReprocess = $state(false);
	let userStatus = $state<UserStatus | null>(null);
	let showLoadingModal = $state(false);
	let showSuccessModal = $state(false);
	let showErrorModal = $state(false);
	let successData = $state<QueueSuccessData | null>(null);
	let errorData = $state<QueueErrorData | null>(null);

	export function showQueue(userId: string, reprocess = false, status: UserStatus | null = null) {
		queueUserId = userId;
		isReprocess = reprocess;
		userStatus = status;
		showQueueModal = true;
	}

	export function hideQueue() {
		showQueueModal = false;
		queueUserId = '';
		isReprocess = false;
		userStatus = null;
	}

	// Handle queue confirmation from modal
	async function handleQueueConfirm(
		outfitNames?: string[],
		inappropriateProfile?: boolean,
		inappropriateFriends?: boolean,
		inappropriateGroups?: boolean,
		captchaToken?: string
	) {
		// Close queue popup and show loading modal
		showQueueModal = false;
		showLoadingModal = true;

		try {
			logger.userAction('queue_user', {
				userId: queueUserId,
				outfitNames,
				inappropriateProfile,
				inappropriateFriends,
				inappropriateGroups
			});

			const result = await apiClient.queueUser(
				queueUserId,
				outfitNames ?? [],
				inappropriateProfile,
				inappropriateFriends,
				inappropriateGroups,
				captchaToken
			);

			// Handle successful queue submission
			if (result.success && result.data) {
				successData = result.data;
				showSuccessModal = true;

				// Add to queue history for tracking
				await addQueueEntry(parseInt(queueUserId, 10));

				// Invalidate cached status to refresh
				userStatusService.invalidateCache(queueUserId);

				// Refresh user status in parent component
				if (onStatusRefresh) {
					await onStatusRefresh(queueUserId);
				}
			} else {
				// Handle API error response
				errorData = {
					error: result.error || 'Unknown error occurred',
					requestId: result.requestId || 'N/A',
					code: result.code || 'UNKNOWN_ERROR',
					type: result.type || 'Error'
				};
				showErrorModal = true;
			}
		} catch (error) {
			// Handle network or other errors
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			const errorObj = error as Error & { requestId?: string; code?: string; type?: string };

			errorData = {
				error: errorMessage,
				requestId: errorObj.requestId || 'N/A',
				code: errorObj.code || 'NETWORK_ERROR',
				type: errorObj.type || 'Error'
			};
			showErrorModal = true;

			logger.error('Failed to queue user:', error);
		} finally {
			// Close loading modal and reset queue state
			showLoadingModal = false;
			queueUserId = '';
		}
	}

	// Handle queue cancellation from modal
	function handleQueueCancel() {
		logger.userAction('queue_cancel', { userId: queueUserId });
		showQueueModal = false;
		queueUserId = '';
		isReprocess = false;
		userStatus = null;
	}

	// Handle success modal close
	function handleSuccessModalClose() {
		showSuccessModal = false;
		successData = null;
	}

	// Handle error modal close
	function handleErrorModalClose() {
		showErrorModal = false;
		errorData = null;
	}

	// Auto-refresh status when background polling detects queue processing completed
	$effect(() => {
		for (const entry of $queueHistory) {
			if (!entry.processed) continue;

			const id = entry.userId.toString();
			const cached = userStatusService.getCachedStatus(id);
			if (cached?.flagType === STATUS.FLAGS.QUEUED) {
				userStatusService.invalidateCache(id);
				if (onStatusRefresh) {
					void onStatusRefresh(id);
				}
			}
		}
	});
</script>

<!-- Queue confirmation modal -->
<QueuePopup
	{isReprocess}
	onCancel={handleQueueCancel}
	onConfirm={handleQueueConfirm}
	userId={queueUserId}
	{userStatus}
	bind:isOpen={showQueueModal}
/>

<!-- Loading Modal -->
<QueueLoadingModal bind:isOpen={showLoadingModal} />

<!-- Success Modal -->
{#if successData}
	<QueueSuccessModal
		onClose={handleSuccessModalClose}
		{successData}
		bind:isOpen={showSuccessModal}
	/>
{/if}

<!-- Error Modal -->
{#if errorData}
	<QueueErrorModal
		{errorData}
		onClose={handleErrorModalClose}
		userId={queueUserId}
		bind:isOpen={showErrorModal}
	/>
{/if}
