<script lang="ts">
	import { apiClient } from '@/lib/services/rotector/api-client';
	import { userStatusService } from '@/lib/services/rotector/entity-status';
	import { queueHistory } from '@/lib/stores/queue-history';
	import { addQueueEntry } from '@/lib/utils/queue-history-storage';
	import { STATUS } from '@/lib/types/constants';
	import { asApiError } from '@/lib/utils/api/api-error';
	import { logger } from '@/lib/utils/logging/logger';
	import type { QueueErrorData, QueueSuccessData, UserStatus } from '@/lib/types/api';
	import QueuePopup from './QueuePopup.svelte';
	import QueueLoadingModal from './QueueLoadingModal.svelte';
	import QueueSuccessModal from './QueueSuccessModal.svelte';
	import QueueErrorModal from './QueueErrorModal.svelte';

	interface Props {
		onStatusRefresh?: (userId: string) => Promise<void> | void;
	}

	let { onStatusRefresh }: Props = $props();

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

	async function handleQueueConfirm(
		outfitNames?: string[],
		outfitIds?: number[],
		inappropriateProfile?: boolean,
		inappropriateFriends?: boolean,
		inappropriateGroups?: boolean,
		captchaToken?: string
	) {
		// Capture userId locally to avoid races with concurrent submissions mutating module state
		const userIdStr = queueUserId;
		const parsedUserId = Number.parseInt(userIdStr, 10);
		if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
			logger.error('handleQueueConfirm called with invalid queueUserId', {
				queueUserId: userIdStr
			});
			return;
		}

		showQueueModal = false;
		showLoadingModal = true;

		try {
			logger.userAction('queue_user', {
				userId: userIdStr,
				outfitNames,
				outfitIds,
				inappropriateProfile,
				inappropriateFriends,
				inappropriateGroups
			});

			const result = await apiClient.queueUser(
				userIdStr,
				outfitNames ?? [],
				outfitIds ?? [],
				inappropriateProfile,
				inappropriateFriends,
				inappropriateGroups,
				captchaToken
			);

			if (result.success) {
				successData = result.data;
				showSuccessModal = true;

				await addQueueEntry(parsedUserId);

				userStatusService.invalidateCache(userIdStr);

				if (onStatusRefresh) {
					await onStatusRefresh(userIdStr);
				}
			} else {
				errorData = {
					error: result.error || 'Unknown error occurred',
					requestId: result.requestId || 'N/A',
					code: result.code || 'UNKNOWN_ERROR',
					type: result.type || 'Error'
				};
				showErrorModal = true;
			}
		} catch (error) {
			const err = asApiError(error);
			errorData = {
				error: err.message,
				requestId: err.requestId ?? 'N/A',
				code: err.code ?? 'NETWORK_ERROR',
				type: err.type ?? 'Error'
			};
			showErrorModal = true;

			logger.error('Failed to queue user:', error);
		} finally {
			showLoadingModal = false;
		}
	}

	function handleQueueCancel() {
		logger.userAction('queue_cancel', { userId: queueUserId });
		showQueueModal = false;
		queueUserId = '';
		isReprocess = false;
		userStatus = null;
	}

	function handleSuccessModalClose() {
		showSuccessModal = false;
		successData = null;
		queueUserId = '';
	}

	function handleErrorModalClose() {
		showErrorModal = false;
		errorData = null;
		queueUserId = '';
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

<QueuePopup
	{isReprocess}
	onCancel={handleQueueCancel}
	onConfirm={handleQueueConfirm}
	userId={queueUserId}
	{userStatus}
	bind:isOpen={showQueueModal}
/>

<QueueLoadingModal isOpen={showLoadingModal} />

{#if successData}
	<QueueSuccessModal
		onClose={handleSuccessModalClose}
		{successData}
		bind:isOpen={showSuccessModal}
	/>
{/if}

{#if errorData}
	<QueueErrorModal
		{errorData}
		onClose={handleErrorModalClose}
		userId={queueUserId}
		bind:isOpen={showErrorModal}
	/>
{/if}
