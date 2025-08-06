<script lang="ts">
    import {sanitizeUserId} from '@/lib/utils/sanitizer';
    import Modal from '../ui/Modal.svelte';
    import type {QueueErrorData} from '@/lib/types/api';

    interface Props {
        isOpen: boolean;
        userId: string | number;
        errorData: QueueErrorData;
        onClose?: () => void;
    }

    let {
        isOpen = $bindable(),
        userId,
        errorData,
        onClose
    }: Props = $props();

    // Computed values
    const sanitizedUserId = $derived(() => {
        const id = sanitizeUserId(userId);
        return id ? id.toString() : '';
    });

    const errorMessage = $derived(() => {
        return errorData.error || 'Unknown error occurred';
    });

    const requestId = $derived(() => {
        return errorData.requestId || 'N/A';
    });

    const errorCode = $derived(() => {
        return errorData.code || 'UNKNOWN_ERROR';
    });

    // Handle close
    function handleClose() {
        if (onClose) {
            onClose();
        }
        isOpen = false;
    }
</script>

<Modal
    actionsLayout="horizontal"
    confirmText="Close"
    confirmVariant="danger"
    modalType="queue-error"
    onConfirm={handleClose}
    showCancel={false}
    title="Error"
    bind:isOpen
>
  <div>
    <p style:color="var(--color-text)" class="!mb-4">
      Failed to queue user ID {sanitizedUserId()} for review.
    </p>

    <div class="modal-content-section-warning">
      <h3 class="modal-content-heading">
        <span class="text-orange-500 mr-2">⚠️</span>
        Error Details
      </h3>
      <div>
        <p style:color="var(--color-text)">
          {errorMessage()}
        </p>
        <br/>
        <p style:color="var(--color-text-subtle)" class="text-sm">
          <strong>Error Code:</strong> {errorCode()}
        </p>
        <p style:color="var(--color-text-subtle)" class="text-sm">
          <strong>Request ID:</strong> {requestId()}
        </p>
      </div>
    </div>

    <div class="modal-content-section-info">
      <h3 class="modal-content-heading">
        <span class="text-blue-500 mr-2">ℹ️</span>
        What to do next
      </h3>
      <ul class="modal-content-list">
        <li class="modal-content-list-item-info">Check if the user has already been flagged by our system</li>
        <li class="modal-content-list-item-info">If the error persists, try again in a few minutes</li>
        <li class="modal-content-list-item-info">If you need support, include the Request ID above</li>
      </ul>
    </div>
  </div>
</Modal>