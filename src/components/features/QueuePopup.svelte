<script lang="ts">
  import { logger } from '../../lib/utils/logger';
  import { sanitizeUserId } from '../../lib/utils/sanitizer';
  import Modal from '../ui/Modal.svelte';

  interface Props {
    isOpen: boolean;
    userId: string | number;
    onConfirm?: (inappropriateOutfit?: boolean) => void | Promise<void>;
    onCancel?: () => void;
  }

  let {
    isOpen = $bindable(),
    userId,
    onConfirm,
    onCancel
  }: Props = $props();

  // Local state
  let inappropriateOutfit = $state(false);
  let submitting = $state(false);

  // Computed values
  const sanitizedUserId = $derived(() => {
    const id = sanitizeUserId(userId);
    return id ? id.toString() : '';
  });

  // Handle form submission
  async function handleConfirm() {
    if (submitting) return;

    submitting = true;

    try {
      logger.userAction('queue_popup_confirm', { 
        userId: sanitizedUserId(),
        inappropriateOutfit 
      });

      if (onConfirm) {
        await onConfirm(inappropriateOutfit);
      }

      // Close modal on success
      isOpen = false;
      inappropriateOutfit = false;
    } catch (error) {
      logger.error('Queue submission failed:', error);
      // Keep modal open on error so user can retry
    } finally {
      submitting = false;
    }
  }

  // Handle cancellation
  function handleCancel() {
    logger.userAction('queue_popup_cancel', { userId: sanitizedUserId() });
    
    if (onCancel) {
      onCancel();
    }

    isOpen = false;
    inappropriateOutfit = false;
  }

  // Reset state when modal closes
  $effect(() => {
    if (!isOpen) {
      inappropriateOutfit = false;
      submitting = false;
    }
  });
</script>

<Modal
  actionsLayout="horizontal"
  cancelText="Cancel"
  confirmDisabled={submitting}
  confirmText={submitting ? "Submitting..." : "Submit for Review"}
  confirmVariant="queue"
  icon="⚠️"
  onCancel={handleCancel}
  onConfirm={handleConfirm}
  title="Queue User for Review"
  bind:isOpen
>
  <div>
    <p style:color="var(--color-text)" class="!mb-4">You are about to submit this user (ID: {sanitizedUserId()}) for analysis by our system.</p>
    
    <div class="modal-content-section-warning">
      <div class="flex items-center gap-2">
        <input 
          id="inappropriateOutfitCheckbox" 
          type="checkbox" 
          bind:checked={inappropriateOutfit}
        />
        <label style:color="var(--color-text)" class="text-base cursor-pointer" for="inappropriateOutfitCheckbox">
          This user has inappropriate outfits
        </label>
      </div>
      <p style:color="var(--color-text-subtle)" style:font-style="italic" class="text-xs-plus mt-2">
        Only check this if inappropriate outfits are the primary concern and no other flaggable content exists.
      </p>
    </div>
    
    <div class="modal-content-section-info">
      <h3 class="modal-content-heading">
        <span class="text-blue-500 mr-2">✓</span>
        Review Process
      </h3>
      <ul class="modal-content-list">
        <li class="modal-content-list-item-info">Processed by our AI algorithms to detect patterns of inappropriate behavior</li>
        <li class="modal-content-list-item-info">If flagged by AI, reviewed by human moderators for final confirmation</li>
        <li class="modal-content-list-item-info">Added to our database with appropriate status if confirmed</li>
      </ul>
    </div>
    
    <div class="modal-content-section-recommendation">
      <h3 class="modal-content-heading">
        <span class="text-green-500 mr-2">✓</span>
        Only submit users who
      </h3>
      <ul class="modal-content-list">
        <li class="modal-content-list-item-recommendation">Have inappropriate content in their profile, avatar, etc.</li>
        <li class="modal-content-list-item-recommendation">Are engaging in concerning behavior</li>
        <li class="modal-content-list-item-recommendation">Have not been flagged by our system yet</li>
      </ul>
    </div>
    
    <div class="modal-content-section-warning">
      <h3 class="modal-content-heading">
        <span class="text-orange-500 mr-2">⚠️</span>
        Important Warning
      </h3>
      <p style:color="var(--color-text)"><strong>Abuse of this feature</strong> (submitting users without valid reason) may result in your IP being banned from using Rotector. We have automatic abuse detection measures in place.</p>
    </div>
  </div>
</Modal> 