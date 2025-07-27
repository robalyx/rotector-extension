<script lang="ts">
  import { logger } from '../../lib/utils/logger';
  import { sanitizeUserId } from '../../lib/utils/sanitizer';
  import Modal from '../ui/Modal.svelte';

  interface Props {
    isOpen: boolean;
    userId: string | number;
    onConfirm?: (inappropriateOutfit?: boolean, inappropriateProfile?: boolean, inappropriateFriends?: boolean, inappropriateGroups?: boolean) => void | Promise<void>;
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
  let inappropriateProfile = $state(false);
  let inappropriateFriends = $state(false);
  let inappropriateGroups = $state(false);
  let submitting = $state(false);
  let optionsLocked = $state(false);
  let showValidationError = $state(false);
  
  // Unlock hold state
  let unlockHoldTimer = $state<ReturnType<typeof setInterval> | null>(null);
  let unlockProgress = $state(0);
  let isUnlocking = $state(false);

  // Constants
  const UNLOCK_HOLD_DURATION = 1000; // 1 second
  const UNLOCK_UPDATE_INTERVAL = 50; // 50ms for smooth animation

  // Computed values
  const sanitizedUserId = $derived(() => {
    const id = sanitizeUserId(userId);
    return id ? id.toString() : '';
  });

  const hasSelection = $derived(inappropriateOutfit || inappropriateProfile || inappropriateFriends || inappropriateGroups);
  const canLockOptions = $derived(hasSelection && !optionsLocked);
  const canSubmit = $derived(optionsLocked && !submitting);

  // Handle options lock-in
  function handleLockOptions() {
    if (!hasSelection) {
      showValidationError = true;
      setTimeout(() => {
        showValidationError = false;
      }, 3000);
      return;
    }
    
    optionsLocked = true;
    showValidationError = false;
    
    logger.userAction('queue_popup_options_locked', { 
      userId: sanitizedUserId(),
      inappropriateOutfit,
      inappropriateProfile,
      inappropriateFriends,
      inappropriateGroups
    });
  }

  // Handle form submission
  async function handleConfirm() {
    if (submitting) return;

    if (!optionsLocked) {
      showValidationError = true;
      setTimeout(() => {
        showValidationError = false;
      }, 3000);
      return;
    }

    submitting = true;

    try {
      logger.userAction('queue_popup_confirm', { 
        userId: sanitizedUserId(),
        inappropriateOutfit,
        inappropriateProfile,
        inappropriateFriends,
        inappropriateGroups
      });

      if (onConfirm) {
        await onConfirm(inappropriateOutfit, inappropriateProfile, inappropriateFriends, inappropriateGroups);
      }

      // Close modal on success
      isOpen = false;
      resetAllState();
    } catch (error) {
      logger.error('Queue submission failed:', error);
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
    resetAllState();
  }

  // Helper to clear unlock timer
  function clearUnlockTimer() {
    if (unlockHoldTimer) {
      clearInterval(unlockHoldTimer);
      unlockHoldTimer = null;
    }
  }

  // Helper to reset all state
  function resetAllState() {
    clearUnlockTimer();
    inappropriateOutfit = false;
    inappropriateProfile = false;
    inappropriateFriends = false;
    inappropriateGroups = false;
    submitting = false;
    optionsLocked = false;
    showValidationError = false;
    isUnlocking = false;
    unlockProgress = 0;
  }

  // Handle unlock hold start
  function handleUnlockStart() {
    if (!optionsLocked || isUnlocking) return;
    
    isUnlocking = true;
    unlockProgress = 0;
    
    const progressIncrement = (UNLOCK_UPDATE_INTERVAL / UNLOCK_HOLD_DURATION) * 100;
    
    unlockHoldTimer = setInterval(() => {
      unlockProgress += progressIncrement;
      
      if (unlockProgress >= 100) {
        handleUnlockComplete();
      }
    }, UNLOCK_UPDATE_INTERVAL);
    
    logger.userAction('queue_popup_unlock_start', { userId: sanitizedUserId() });
  }

  // Handle unlock hold end
  function handleUnlockEnd() {
    clearUnlockTimer();
    
    if (isUnlocking && unlockProgress < 100) {
      isUnlocking = false;
      unlockProgress = 0;
      logger.userAction('queue_popup_unlock_cancelled', { userId: sanitizedUserId() });
    }
  }

  // Handle unlock completion
  function handleUnlockComplete() {
    clearUnlockTimer();
    
    optionsLocked = false;
    isUnlocking = false;
    unlockProgress = 0;
    
    logger.userAction('queue_popup_unlock_complete', { userId: sanitizedUserId() });
  }

  // Reset state when modal closes
  $effect(() => {
    if (!isOpen) {
      resetAllState();
    }
  });
</script>

<Modal
  actionsLayout="horizontal"
  cancelText="Cancel"
  confirmDisabled={!canSubmit}
  confirmText={submitting ? "Submitting..." : "Submit for Review"}
  confirmVariant="queue"
  icon="warning"
  onCancel={handleCancel}
  onConfirm={handleConfirm}
  title="Queue User for Review"
  bind:isOpen
>
  <div>
    <p style:color="var(--color-text)" class="!mb-6">You are about to submit this user (ID: {sanitizedUserId()}) for analysis by our system.</p>
    
    <!-- Option Selection Section -->
    <div class="queue-selection-section">
      {#if !optionsLocked}
        <!-- Option Selection Cards -->
        <div class="space-y-4 mb-6">
          <h3 style:color="var(--color-text)" class="text-lg font-semibold mb-3">Select flagging reason(s):</h3>
      
      <!-- Inappropriate Outfit Card -->
      <div 
        class="queue-option-card-outfit" class:locked={optionsLocked} class:selected={inappropriateOutfit}
        aria-disabled={optionsLocked}
        aria-pressed={inappropriateOutfit}
        onclick={() => !optionsLocked && (inappropriateOutfit = !inappropriateOutfit)}
        onkeydown={(e) => {
          if (!optionsLocked && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            inappropriateOutfit = !inappropriateOutfit;
          }
        }}
        role="button"
        tabindex={optionsLocked ? -1 : 0}
      >
        <div class="queue-option-header">
          <div class="outfit-icon"></div>
          <div class="queue-option-title">Inappropriate Outfits</div>
        </div>
        <div class="queue-option-description">
          This user has inappropriate outfits or avatars.
        </div>
      </div>
      
      <!-- Inappropriate Profile Card -->
      <div 
        class="queue-option-card-profile" class:locked={optionsLocked} class:selected={inappropriateProfile}
        aria-disabled={optionsLocked}
        aria-pressed={inappropriateProfile}
        onclick={() => !optionsLocked && (inappropriateProfile = !inappropriateProfile)}
        onkeydown={(e) => {
          if (!optionsLocked && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            inappropriateProfile = !inappropriateProfile;
          }
        }}
        role="button"
        tabindex={optionsLocked ? -1 : 0}
      >
        <div class="queue-option-header">
          <div class="profile-icon"></div>
          <div class="queue-option-title">Inappropriate Profile</div>
        </div>
        <div class="queue-option-description">
          This user has inappropriate content in their username, display name, or description.
        </div>
      </div>
      
      <!-- Inappropriate Friends Card -->
      <div 
        class="queue-option-card-friends" class:locked={optionsLocked} class:selected={inappropriateFriends}
        aria-disabled={optionsLocked}
        aria-pressed={inappropriateFriends}
        onclick={() => !optionsLocked && (inappropriateFriends = !inappropriateFriends)}
        onkeydown={(e) => {
          if (!optionsLocked && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            inappropriateFriends = !inappropriateFriends;
          }
        }}
        role="button"
        tabindex={optionsLocked ? -1 : 0}
      >
        <div class="queue-option-header">
          <div class="friends-icon"></div>
          <div class="queue-option-title">Inappropriate Friends</div>
        </div>
        <div class="queue-option-description">
          This user has inappropriate friends.
        </div>
      </div>
      
      <!-- Inappropriate Groups Card -->
      <div 
        class="queue-option-card-groups" class:locked={optionsLocked} class:selected={inappropriateGroups}
        aria-disabled={optionsLocked}
        aria-pressed={inappropriateGroups}
        onclick={() => !optionsLocked && (inappropriateGroups = !inappropriateGroups)}
        onkeydown={(e) => {
          if (!optionsLocked && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            inappropriateGroups = !inappropriateGroups;
          }
        }}
        role="button"
        tabindex={optionsLocked ? -1 : 0}
      >
        <div class="queue-option-header">
          <div class="groups-icon"></div>
          <div class="queue-option-title">Inappropriate Groups</div>
        </div>
        <div class="queue-option-description">
          This user is in inappropriate groups.
        </div>
      </div>
    </div>

        <!-- Lock Options Section -->
        {#if showValidationError}
          <div class="queue-validation-error mb-4">
            <div class="flex items-center gap-2">
              <div class="mature-content-warning-icon"></div>
              <strong>Selection Required:</strong> Please select at least one flagging reason before proceeding.
            </div>
          </div>
        {/if}
        
        <div class="text-center">
          <button
            style:margin-bottom="16px"
            class="queue-lock-button"
            disabled={!canLockOptions}
            onclick={handleLockOptions}
          >
            Lock In My Selection
          </button>
          <p style:color="var(--color-text-subtle)" class="text-sm">
            You must lock in your selection before submitting.
          </p>
        </div>
      {:else}
        <!-- Summary View -->
        <div class="queue-summary-container">
          <h3 style:color="var(--color-text)" class="text-lg font-semibold mb-4">Selected Options:</h3>
          
          <!-- Outfit Option Summary -->
          <div class={inappropriateOutfit ? "queue-summary-item-selected" : "queue-summary-item-unselected"}>
            <div class={inappropriateOutfit ? "queue-summary-icon-selected" : "queue-summary-icon-unselected"}>
              {inappropriateOutfit ? "✓" : "✗"}
            </div>
            <div class="outfit-icon"></div>
            <div class="queue-summary-content">
              <div class="queue-summary-title">Inappropriate Outfits</div>
              <div class="queue-summary-description">
                {inappropriateOutfit ? "Will be prioritized for inappropriate outfits" : "Not selected"}
              </div>
            </div>
          </div>
          
          <!-- Profile Option Summary -->
          <div class={inappropriateProfile ? "queue-summary-item-selected" : "queue-summary-item-unselected"}>
            <div class={inappropriateProfile ? "queue-summary-icon-selected" : "queue-summary-icon-unselected"}>
              {inappropriateProfile ? "✓" : "✗"}
            </div>
            <div class="profile-icon"></div>
            <div class="queue-summary-content">
              <div class="queue-summary-title">Inappropriate Profile</div>
              <div class="queue-summary-description">
                {inappropriateProfile ? "Will be prioritized for inappropriate profile content" : "Not selected"}
              </div>
            </div>
          </div>
          
          <!-- Friends Option Summary -->
          <div class={inappropriateFriends ? "queue-summary-item-selected" : "queue-summary-item-unselected"}>
            <div class={inappropriateFriends ? "queue-summary-icon-selected" : "queue-summary-icon-unselected"}>
              {inappropriateFriends ? "✓" : "✗"}
            </div>
            <div class="friends-icon"></div>
            <div class="queue-summary-content">
              <div class="queue-summary-title">Inappropriate Friends</div>
              <div class="queue-summary-description">
                {inappropriateFriends ? "Will be prioritized for inappropriate friends" : "Not selected"}
              </div>
            </div>
          </div>
          
          <!-- Groups Option Summary -->
          <div class={inappropriateGroups ? "queue-summary-item-selected" : "queue-summary-item-unselected"}>
            <div class={inappropriateGroups ? "queue-summary-icon-selected" : "queue-summary-icon-unselected"}>
              {inappropriateGroups ? "✓" : "✗"}
            </div>
            <div class="groups-icon"></div>
            <div class="queue-summary-content">
              <div class="queue-summary-title">Inappropriate Groups</div>
              <div class="queue-summary-description">
                {inappropriateGroups ? "Will be prioritized for inappropriate groups" : "Not selected"}
              </div>
            </div>
          </div>
        </div>
        
        <div class="text-center">
          <div 
            style:margin-bottom="16px" 
            class={isUnlocking ? "queue-lock-button-unlocking" : "queue-lock-button-locked"}
            aria-label={isUnlocking ? "Unlocking options..." : "Hold to unlock your selection"}
            onkeydown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (!isUnlocking) {
                  handleUnlockStart();
                } else {
                  handleUnlockEnd();
                }
              }
            }}
            onkeyup={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                handleUnlockEnd();
              }
            }}
            onmousedown={handleUnlockStart}
            onmouseleave={handleUnlockEnd}
            onmouseup={handleUnlockEnd}
            ontouchend={handleUnlockEnd}
            ontouchstart={handleUnlockStart}
            role="button"
            tabindex="0"
          >
            {#if isUnlocking}
              <div class="unlock-progress-container">
                <div 
                  style:width="{unlockProgress}%" 
                  class="unlock-progress-bar"
                ></div>
                <span class="unlock-progress-text">
                  Unlocking... {Math.round(unlockProgress)}%
                </span>
              </div>
            {:else}
              ✓ Selection Locked - Hold to Unlock
            {/if}
          </div>
          <p style:color="var(--color-text-subtle)" class="text-sm">
            {#if isUnlocking}
              Continue holding to unlock your selection and make changes.
            {:else}
              Your flagging reasons have been confirmed.
            {/if}
          </p>
        </div>
      {/if}
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
      <h3 class="modal-content-heading flex items-center">
        <div class="warning-triangle-icon mr-2"></div>
        Important Warning
      </h3>
      <p style:color="var(--color-text)"><strong>Abuse of this feature</strong> (submitting users without valid reason) may result in your IP being banned from using Rotector. We have automatic abuse detection measures in place.</p>
    </div>
  </div>
</Modal> 