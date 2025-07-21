<script lang="ts">
  import { logger } from '../../lib/utils/logger';
  import { sanitizeUserId } from '../../lib/utils/sanitizer';
  import type { UserStatus } from '../../lib/types/api';
  import Modal from '../ui/Modal.svelte';
  import LoadingSpinner from '../ui/LoadingSpinner.svelte';

  interface Props {
    isOpen?: boolean;
    userId?: string | number | null;
    status?: UserStatus | null;
    isCard?: boolean;
    onFillForm?: () => void | Promise<void>;
    onClose?: () => void;
  }

  let {
    isOpen = $bindable(true),
    userId = null,
    status = null,
    isCard = false,
    onFillForm,
    onClose
  }: Props = $props();

  // Local state
  let processing = $state(false);

  // Computed values
  const sanitizedUserId = $derived(() => {
    if (!userId) return '';
    const id = sanitizeUserId(userId);
    return id ? id.toString() : '';
  });

  const isReportable = $derived(() => {
    if (!status) return false;
    return "0" in (status.reasons || {});
  });

  const reportableContent = $derived(() => {
    if (!status || !isReportable()) return null;
    
    const profileReason = status.reasons?.["0"];
    
    return {
      message: profileReason?.message || 'Inappropriate content detected',
      evidence: profileReason?.evidence || [],
      confidence: profileReason?.confidence || status.confidence || 0
    };
  });

  const canAutoFill = $derived(() => {
    return isReportable() && onFillForm;
  });

  // Handle fill form button click
  async function handleFillForm() {
    if (!canAutoFill() || processing) return;
    
    processing = true;
    
    try {
      // Call the parent's fill form handler
      await onFillForm?.();
    } catch (error) {
      logger.error('Failed to fill report form:', error);
      throw error;
    } finally {
      processing = false;
    }
  }

  // Handle close
  function handleClose() {
    if (!isCard) {
      isOpen = false;
    }
    onClose?.();
  }
</script>

{#if isCard}
  <div class="report-helper-card {isReportable() ? 'reportable' : 'not-reportable'}">
    <div class="report-helper-header">
      <div class="report-helper-icon {isReportable() ? 'reportable' : 'not-reportable'}"></div>
      <h3 class="report-helper-title">
        {isReportable() ? 'Reportable Content Found' : 'No Reportable Content Detected'}
      </h3>
    </div>

    <div class="report-helper-content">
      {#if isReportable()}
        {#if canAutoFill()}
          <!-- Can auto-fill -->
          <p class="report-helper-subtitle">
            Rotector identified profile content violating Roblox's Terms of Service.
          </p>

          {#if reportableContent()}
            <div class="report-helper-evidence-section">
              <h4 class="report-helper-evidence-header">Detected Issue</h4>
              <div class="report-helper-evidence-details">
                <strong>Reason:</strong> {reportableContent()?.message}<br /><br />
                
                {#if reportableContent()?.evidence && reportableContent()!.evidence.length > 0}
                  <strong>Evidence Snippets:</strong>
                  <ul class="report-helper-evidence-list">
                    {#each reportableContent()!.evidence as item (item)}
                      <li class="report-helper-evidence-item">{item}</li>
                    {/each}
                  </ul>
                {/if}
              </div>
            </div>
          {/if}

          <div class="report-helper-action-section">
            <p>Click below and Rotector will automatically fill the report form with the appropriate category and details.</p>
            
            <button
              class="report-helper-button primary"
              disabled={processing}
              onclick={handleFillForm}
            >
              {#if processing}
                <LoadingSpinner size="small" />
                Filling...
              {:else}
                Fill Report Form
              {/if}
            </button>
          </div>

          <div class="report-helper-warning-section">
            <div class="report-helper-warning-icon"></div>
            <div class="report-helper-warning-text">
              <strong>Important:</strong> Reports are filed under <strong>your</strong> Roblox account. Review all information before submitting and only report genuine violations.
            </div>
          </div>
        {/if}
      {:else}
        <!-- Not reportable -->
        <p class="report-helper-subtitle">
          Rotector hasn't detected any clearly reportable content in this user's profile description yet.
        </p>
        
        <div class="report-helper-info-section">
          <div class="report-helper-info-icon"></div>
          <div class="report-helper-info-text">
            <p><strong>You can still submit a report</strong> if you believe this user is violating Roblox's Terms of Service.</p>
            <p>Rotector allows reporting of inappropriate content in profile descriptions. We don't detect most report categories, including:</p>
            
            <div class="report-helper-list">
              <div class="report-helper-list-item">Asking for or giving private information</div>
              <div class="report-helper-list-item">Bullying, harassment, discrimination</div>
              <div class="report-helper-list-item">Exploiting, cheating, scamming</div>
              <div class="report-helper-list-item">Account theft (phishing, hacking, trading)</div>
              <div class="report-helper-list-item">Real life threats or suicide threats</div>
            </div>
            
            <p>If you're reporting any of these violations, please continue with your report and provide specific details to help Roblox moderators.</p>
          </div>
        </div>
      {/if}
    </div>
  </div>
{:else}
  <Modal
    confirmText="Close"
    icon="📋"
    onConfirm={handleClose}
    showCancel={false}
    title="Report Helper"
    bind:isOpen
  >
    <div class="space-y-4">
      <!-- User Information -->
      {#if sanitizedUserId()}
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Report Target:
          </div>
          <div class="font-medium text-gray-800 dark:text-gray-200">
            User ID: {sanitizedUserId()}
          </div>
          {#if status}
            <div class="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Status: {status.flagType === 2 ? 'Unsafe' : status.flagType === 1 ? 'Pending' : 'Safe'}
              {#if status.confidence > 0}
                ({Math.round(status.confidence * 100)}% confidence)
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Report Status -->
      {#if isReportable()}
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <div class="flex items-center gap-2">
            <div class="text-red-600 dark:text-red-400">⚠️</div>
            <div class="text-sm text-red-800 dark:text-red-200">
              Reportable content detected in profile
            </div>
          </div>
        </div>
      {:else}
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div class="flex items-center gap-2">
            <div class="text-blue-600 dark:text-blue-400">ℹ️</div>
            <div class="text-sm text-blue-800 dark:text-blue-200">
              No reportable content detected
            </div>
          </div>
        </div>
      {/if}

      <!-- Instructions -->
      <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
        <div class="flex items-start gap-2">
          <div class="text-yellow-600 dark:text-yellow-400 text-sm">💡</div>
          <div class="text-xs text-yellow-800 dark:text-yellow-200">
            <strong>How to Report:</strong>
            <ul class="mt-1 space-y-1 list-disc list-inside">
              <li>Navigate to the user's profile page</li>
              <li>Click the "Report Abuse" link</li>
              <li>Use Rotector's auto-fill feature if available</li>
              <li>Submit the report through Roblox's official system</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </Modal>
{/if}