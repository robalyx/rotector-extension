<script lang="ts">
  import { apiClient } from '../../lib/services/api-client';
  import { logger } from '../../lib/utils/logger';
  import type { QueueSuccessData, QueueErrorData } from '../../lib/types/api';
  import QueuePopup from './QueuePopup.svelte';
  import QueueSuccessModal from './QueueSuccessModal.svelte';
  import QueueErrorModal from './QueueErrorModal.svelte';

  interface Props {
    onStatusRefresh?: (userId: string) => Promise<void> | void;
  }

  let {
    onStatusRefresh
  }: Props = $props();

  // Queue modal state
  let showQueueModal = $state(false);
  let queueUserId = $state<string>('');
  let showSuccessModal = $state(false);
  let showErrorModal = $state(false);
  let successData = $state<QueueSuccessData | null>(null);
  let errorData = $state<QueueErrorData | null>(null);

  // Public methods for parent components
  export function showQueue(userId: string) {
    queueUserId = userId;
    showQueueModal = true;
  }

  export function hideQueue() {
    showQueueModal = false;
    queueUserId = '';
  }

  // Handle queue confirmation from modal
  async function handleQueueConfirm(inappropriateOutfit = false, inappropriateProfile = false, inappropriateFriends = false, inappropriateGroups = false) {
    try {
      logger.userAction('queue_user', { 
        userId: queueUserId, 
        inappropriateOutfit, 
        inappropriateProfile, 
        inappropriateFriends, 
        inappropriateGroups 
      });
      
      const result = await apiClient.queueUser(queueUserId, inappropriateOutfit, inappropriateProfile, inappropriateFriends, inappropriateGroups);
      
      // Handle successful queue submission
      if (result.success && result.data) {
        successData = result.data;
        showSuccessModal = true;
        
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
      // Reset queue modal state
      showQueueModal = false;
      queueUserId = '';
    }
  }

  // Handle queue cancellation from modal
  function handleQueueCancel() {
    logger.userAction('queue_cancel', { userId: queueUserId });
    showQueueModal = false;
    queueUserId = '';
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
</script>

<!-- Queue confirmation modal -->
<QueuePopup
  onCancel={handleQueueCancel}
  onConfirm={handleQueueConfirm}
  userId={queueUserId}
  bind:isOpen={showQueueModal}
/>

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