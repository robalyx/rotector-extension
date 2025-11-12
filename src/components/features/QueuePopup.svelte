<script lang="ts">
	import { t } from '@/lib/stores/i18n';
	import { logger } from '@/lib/utils/logger';
	import { sanitizeEntityId } from '@/lib/utils/sanitizer';
	import { STATUS } from '@/lib/types/constants';
	import {
		Shirt,
		Clipboard,
		User,
		Users,
		AlertCircle,
		AlertTriangle,
		Check,
		X
	} from 'lucide-svelte';
	import Modal from '../ui/Modal.svelte';
	import type { UserStatus } from '@/lib/types/api';

	interface Props {
		isOpen: boolean;
		userId: string | number;
		isReprocess?: boolean;
		userStatus?: UserStatus | null;
		onConfirm?: (
			inappropriateOutfit?: boolean,
			inappropriateProfile?: boolean,
			inappropriateFriends?: boolean,
			inappropriateGroups?: boolean
		) => void | Promise<void>;
		onCancel?: () => void;
	}

	let {
		isOpen = $bindable(),
		userId,
		isReprocess = false,
		userStatus = null,
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
	let submissionType = $state<'inappropriate' | 'general-check' | null>(null);

	// Computed values
	const sanitizedUserId = $derived(() => {
		const id = sanitizeEntityId(userId);
		return id ? id.toString() : '';
	});

	const isReanalysis = $derived(
		isReprocess ||
			(userStatus &&
				(userStatus.flagType === STATUS.FLAGS.UNSAFE ||
					userStatus.flagType === STATUS.FLAGS.PENDING ||
					userStatus.flagType === STATUS.FLAGS.MIXED))
	);
	const hasSelection = $derived(
		inappropriateOutfit || inappropriateProfile || inappropriateFriends || inappropriateGroups
	);
	const canLockOptions = $derived(hasSelection && !optionsLocked);
	const canSubmit = $derived(() => {
		if (submitting) return false;
		if (isReanalysis) return true; // Re-analysis can submit directly
		if (submissionType === 'general-check') return true; // General check can submit directly
		return optionsLocked; // Inappropriate content requires locked options
	});

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

		// Do not proceed if submit is currently disabled
		if (!canSubmit()) {
			logger.warn('Queue submit attempted while disabled', {
				userId: sanitizedUserId(),
				isReanalysis,
				submissionType
			});
			return;
		}

		// Validation for new analysis with inappropriate content
		if (!isReanalysis && submissionType === 'inappropriate' && !optionsLocked) {
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
				isReanalysis,
				submissionType,
				inappropriateOutfit,
				inappropriateProfile,
				inappropriateFriends,
				inappropriateGroups
			});

			if (onConfirm) {
				if (isReanalysis) {
					// Re-analysis: omit all flags
					await onConfirm();
				} else if (submissionType === 'general-check') {
					// General check: send all flags as false
					await onConfirm(false, false, false, false);
				} else {
					// Inappropriate content: send actual checkbox values
					await onConfirm(
						inappropriateOutfit,
						inappropriateProfile,
						inappropriateFriends,
						inappropriateGroups
					);
				}
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

	// Handle unlock
	function handleUnlock() {
		optionsLocked = false;
		logger.userAction('queue_popup_unlocked', {
			userId: sanitizedUserId()
		});
	}

	// Helper to reset all state
	function resetAllState() {
		inappropriateOutfit = false;
		inappropriateProfile = false;
		inappropriateFriends = false;
		inappropriateGroups = false;
		submitting = false;
		optionsLocked = false;
		showValidationError = false;
		submissionType = null;
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
	cancelText={t('queue_popup_cancel_button')}
	confirmDisabled={!canSubmit()}
	confirmText={submitting ? t('queue_popup_submitting_button') : t('queue_popup_submit_button')}
	confirmVariant="queue"
	icon="warning"
	onCancel={handleCancel}
	onConfirm={handleConfirm}
	title={isReanalysis ? t('queue_popup_title_reprocess') : t('queue_popup_title_queue')}
	bind:isOpen
>
	<div>
		<p style:color="var(--color-text)" class="mb-6!">
			{#if isReanalysis}
				{t('queue_popup_description_reanalysis', [sanitizedUserId()])}
			{:else}
				{t('queue_popup_description_analysis', [sanitizedUserId()])}
			{/if}
		</p>

		<!-- Option Selection Section -->
		{#if !isReanalysis}
			<div class="queue-selection-section">
				{#if submissionType === null}
					<!-- Binary choice for new analysis -->
					<div class="mb-6">
						<h3 style:color="var(--color-text)" class="mb-4 text-lg font-semibold text-center">
							{t('queue_popup_submission_type_heading')}
						</h3>

						<div class="flex flex-col gap-2">
							<button
								class="queue-option-card-profile"
								class:selected={submissionType === 'inappropriate'}
								onclick={() => (submissionType = 'inappropriate')}
								type="button"
							>
								<div class="queue-option-header">
									<AlertTriangle size={24} />
									<div class="queue-option-title">
										{t('queue_popup_option_inappropriate_title')}
									</div>
								</div>
								<div class="queue-option-description">
									{t('queue_popup_option_inappropriate_description')}
								</div>
							</button>

							<button
								class="queue-option-card-friends"
								class:selected={submissionType === 'general-check'}
								onclick={() => (submissionType = 'general-check')}
								type="button"
							>
								<div class="queue-option-header">
									<AlertCircle size={24} />
									<div class="queue-option-title">{t('queue_popup_option_general_title')}</div>
								</div>
								<div class="queue-option-description">
									{t('queue_popup_option_general_description')}
								</div>
							</button>
						</div>
					</div>
				{:else if submissionType === 'general-check'}
					<!-- General check selected: No specific flags needed -->
					<div>
						<p style:color="var(--color-text-subtle)" class="text-sm text-center">
							{t('queue_popup_general_check_message')}
						</p>
					</div>
				{:else if submissionType === 'inappropriate' && !optionsLocked}
					<!-- Inappropriate content selected: Show checkboxes -->
					<div class="mb-6 space-y-4">
						<h3
							style:color="var(--color-text)"
							class="
            mb-3 text-lg font-semibold
          "
						>
							{t('queue_popup_flagging_reasons_heading')}
						</h3>

						<!-- Inappropriate Outfit Card -->
						<div
							class="queue-option-card-outfit"
							class:locked={optionsLocked}
							class:selected={inappropriateOutfit}
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
								<Shirt class="outfit-icon" size={24} />
								<div class="queue-option-title">{t('queue_popup_outfit_title')}</div>
							</div>
							<div class="queue-option-description">
								{t('queue_popup_outfit_description')}
							</div>
						</div>

						<!-- Inappropriate Profile Card -->
						<div
							class="queue-option-card-profile"
							class:locked={optionsLocked}
							class:selected={inappropriateProfile}
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
								<Clipboard class="profile-icon" size={24} />
								<div class="queue-option-title">{t('queue_popup_profile_title')}</div>
							</div>
							<div class="queue-option-description">
								{t('queue_popup_profile_description')}
							</div>
						</div>

						<!-- Inappropriate Friends Card -->
						<div
							class="queue-option-card-friends"
							class:locked={optionsLocked}
							class:selected={inappropriateFriends}
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
								<User class="friends-icon" size={24} />
								<div class="queue-option-title">{t('queue_popup_friends_title')}</div>
							</div>
							<div class="queue-option-description">{t('queue_popup_friends_description')}</div>
						</div>

						<!-- Inappropriate Groups Card -->
						<div
							class="queue-option-card-groups"
							class:locked={optionsLocked}
							class:selected={inappropriateGroups}
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
								<Users class="groups-icon" size={24} />
								<div class="queue-option-title">{t('queue_popup_groups_title')}</div>
							</div>
							<div class="queue-option-description">{t('queue_popup_groups_description')}</div>
						</div>
					</div>

					<!-- Lock Options Section -->
					{#if showValidationError}
						<div class="mb-4 queue-validation-error">
							<div class="flex items-center gap-2">
								<AlertCircle class="mature-content-warning-icon" size={32} />
								<strong>{t('queue_popup_validation_error_prefix')}</strong>
								{t('queue_popup_validation_error_message')}
							</div>
						</div>
					{/if}

					<div class="text-center">
						<button
							class="queue-lock-button mb-4"
							disabled={!canLockOptions}
							onclick={handleLockOptions}
							type="button"
						>
							{t('queue_popup_lock_button')}
						</button>
						<p style:color="var(--color-text-subtle)" class="text-sm">
							{t('queue_popup_lock_instruction')}
						</p>
					</div>
				{:else}
					<!-- Summary View -->
					<div class="queue-summary-container">
						<h3
							style:color="var(--color-text)"
							class="
            mb-4 text-lg font-semibold
          "
						>
							{t('queue_popup_summary_heading')}
						</h3>

						<!-- Outfit Option Summary -->
						<div
							class={inappropriateOutfit
								? 'queue-summary-item-selected'
								: `
            queue-summary-item-unselected
          `}
						>
							<div
								class={inappropriateOutfit
									? 'queue-summary-icon-selected'
									: `
              queue-summary-icon-unselected
            `}
							>
								{#if inappropriateOutfit}
									<Check size={16} />
								{:else}
									<X size={16} />
								{/if}
							</div>
							<Shirt class="outfit-icon" size={24} />
							<div class="queue-summary-content">
								<div class="queue-summary-title">{t('queue_popup_outfit_title')}</div>
								<div class="queue-summary-description">
									{inappropriateOutfit
										? t('queue_popup_summary_outfit_selected')
										: t('queue_popup_summary_outfit_unselected')}
								</div>
							</div>
						</div>

						<!-- Profile Option Summary -->
						<div
							class={inappropriateProfile
								? 'queue-summary-item-selected'
								: `
            queue-summary-item-unselected
          `}
						>
							<div
								class={inappropriateProfile
									? 'queue-summary-icon-selected'
									: `
              queue-summary-icon-unselected
            `}
							>
								{#if inappropriateProfile}
									<Check size={16} />
								{:else}
									<X size={16} />
								{/if}
							</div>
							<Clipboard class="profile-icon" size={24} />
							<div class="queue-summary-content">
								<div class="queue-summary-title">{t('queue_popup_profile_title')}</div>
								<div class="queue-summary-description">
									{inappropriateProfile
										? t('queue_popup_summary_profile_selected')
										: t('queue_popup_summary_profile_unselected')}
								</div>
							</div>
						</div>

						<!-- Friends Option Summary -->
						<div
							class={inappropriateFriends
								? 'queue-summary-item-selected'
								: `
            queue-summary-item-unselected
          `}
						>
							<div
								class={inappropriateFriends
									? 'queue-summary-icon-selected'
									: `
              queue-summary-icon-unselected
            `}
							>
								{#if inappropriateFriends}
									<Check size={16} />
								{:else}
									<X size={16} />
								{/if}
							</div>
							<User class="friends-icon" size={24} />
							<div class="queue-summary-content">
								<div class="queue-summary-title">{t('queue_popup_friends_title')}</div>
								<div class="queue-summary-description">
									{inappropriateFriends
										? t('queue_popup_summary_friends_selected')
										: t('queue_popup_summary_friends_unselected')}
								</div>
							</div>
						</div>

						<!-- Groups Option Summary -->
						<div
							class={inappropriateGroups
								? 'queue-summary-item-selected'
								: `
            queue-summary-item-unselected
          `}
						>
							<div
								class={inappropriateGroups
									? 'queue-summary-icon-selected'
									: `
              queue-summary-icon-unselected
            `}
							>
								{#if inappropriateGroups}
									<Check size={16} />
								{:else}
									<X size={16} />
								{/if}
							</div>
							<Users class="groups-icon" size={24} />
							<div class="queue-summary-content">
								<div class="queue-summary-title">{t('queue_popup_groups_title')}</div>
								<div class="queue-summary-description">
									{inappropriateGroups
										? t('queue_popup_summary_groups_selected')
										: t('queue_popup_summary_groups_unselected')}
								</div>
							</div>
						</div>
					</div>

					<div class="flex flex-col items-center">
						<button class="mature-content-confirm mb-4" onclick={handleUnlock} type="button">
							{t('queue_popup_unlock_button')}
						</button>
						<p style:color="var(--color-text-subtle)" class="text-sm">
							{t('queue_popup_unlock_instruction')}
						</p>
					</div>
				{/if}
			</div>
		{/if}

		<div class="modal-content-section-info">
			<h3 class="modal-content-heading">
				<Check class="mr-2 text-blue-500" size={18} />
				{t('queue_popup_review_process_heading')}
			</h3>
			<ul class="modal-content-list">
				<li class="modal-content-list-item-info">
					{t('queue_popup_review_process_step1')}
				</li>
				<li class="modal-content-list-item-info">
					{t('queue_popup_review_process_step2')}
				</li>
				<li class="modal-content-list-item-info">
					{t('queue_popup_review_process_step3')}
				</li>
			</ul>
		</div>

		<div class="modal-content-section-warning">
			<h3 class="modal-content-heading flex items-center">
				<AlertTriangle class="mr-2 warning-triangle-icon" size={24} />
				{t('queue_popup_warning_heading')}
			</h3>
			<p style:color="var(--color-text)" class="text-sm">
				<strong>{t('queue_popup_warning_message_prefix')}</strong>
				{t('queue_popup_warning_message_suffix')}
			</p>
		</div>
	</div>
</Modal>
