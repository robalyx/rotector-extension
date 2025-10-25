<script lang="ts">
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
			(userStatus && userStatus.flagType > 0 && userStatus.flagType !== STATUS.FLAGS.PAST_OFFENDER)
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
	cancelText="Cancel"
	confirmDisabled={!canSubmit()}
	confirmText={submitting ? 'Submitting...' : 'Submit for Review'}
	confirmVariant="queue"
	icon="warning"
	onCancel={handleCancel}
	onConfirm={handleConfirm}
	title={isReanalysis ? 'Reprocess User for Review' : 'Queue User for Review'}
	bind:isOpen
>
	<div>
		<p style:color="var(--color-text)" class="mb-6!">
			{#if isReanalysis}
				You are about to submit user (ID: {sanitizedUserId()}) for reanalysis by our system.
			{:else}
				You are about to submit user (ID: {sanitizedUserId()}) for analysis by our system.
			{/if}
		</p>

		<!-- Option Selection Section -->
		{#if !isReanalysis}
			<div class="queue-selection-section">
				{#if submissionType === null}
					<!-- Binary choice for new analysis -->
					<div class="mb-6">
						<h3 style:color="var(--color-text)" class="mb-4 text-lg font-semibold text-center">
							What type of submission is this?
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
									<div class="queue-option-title">User Has Inappropriate Content</div>
								</div>
								<div class="queue-option-description">
									This user has clear inappropriate content in their profile, avatar, friends, or
									groups.
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
									<div class="queue-option-title">General Safety Check</div>
								</div>
								<div class="queue-option-description">
									I'm unsure but want this user analyzed for general safety assessment.
								</div>
							</button>
						</div>
					</div>
				{:else if submissionType === 'general-check'}
					<!-- General check selected: No specific flags needed -->
					<div>
						<p style:color="var(--color-text-subtle)" class="text-sm text-center">
							This user will be analyzed for general safety concerns. No specific flagging reasons
							required.
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
							Select flagging reason(s):
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
								<div class="queue-option-title">Inappropriate Outfits</div>
							</div>
							<div class="queue-option-description">
								This user has inappropriate outfits or avatars.
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
								<div class="queue-option-title">Inappropriate Profile</div>
							</div>
							<div class="queue-option-description">
								This user has inappropriate content in their username, display name, or description.
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
								<div class="queue-option-title">Inappropriate Friends</div>
							</div>
							<div class="queue-option-description">This user has inappropriate friends.</div>
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
								<div class="queue-option-title">Inappropriate Groups</div>
							</div>
							<div class="queue-option-description">This user is in inappropriate groups.</div>
						</div>
					</div>

					<!-- Lock Options Section -->
					{#if showValidationError}
						<div class="mb-4 queue-validation-error">
							<div class="flex items-center gap-2">
								<AlertCircle class="mature-content-warning-icon" size={32} />
								<strong>Selection Required:</strong> Please select at least one flagging reason before
								proceeding.
							</div>
						</div>
					{/if}

					<div class="text-center">
						<button
							style:margin-bottom="16px"
							class="queue-lock-button"
							disabled={!canLockOptions}
							onclick={handleLockOptions}
							type="button"
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
						<h3
							style:color="var(--color-text)"
							class="
            mb-4 text-lg font-semibold
          "
						>
							Selected Options:
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
								<div class="queue-summary-title">Inappropriate Outfits</div>
								<div class="queue-summary-description">
									{inappropriateOutfit
										? 'Will be prioritized for inappropriate outfits'
										: 'Not selected'}
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
								<div class="queue-summary-title">Inappropriate Profile</div>
								<div class="queue-summary-description">
									{inappropriateProfile
										? 'Will be prioritized for inappropriate profile content'
										: 'Not selected'}
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
								<div class="queue-summary-title">Inappropriate Friends</div>
								<div class="queue-summary-description">
									{inappropriateFriends
										? 'Will be prioritized for inappropriate friends'
										: 'Not selected'}
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
								<div class="queue-summary-title">Inappropriate Groups</div>
								<div class="queue-summary-description">
									{inappropriateGroups
										? 'Will be prioritized for inappropriate groups'
										: 'Not selected'}
								</div>
							</div>
						</div>
					</div>

					<div class="flex flex-col items-center">
						<button
							style:margin-bottom="16px"
							class="mature-content-confirm"
							onclick={handleUnlock}
							type="button"
						>
							Unlock Selection
						</button>
						<p style:color="var(--color-text-subtle)" class="text-sm">
							Click to unlock and modify your selection.
						</p>
					</div>
				{/if}
			</div>
		{/if}

		<div class="modal-content-section-info">
			<h3 class="modal-content-heading">
				<Check class="mr-2 text-blue-500" size={18} />
				Review Process
			</h3>
			<ul class="modal-content-list">
				<li class="modal-content-list-item-info">
					Analyzed by AI algorithms to detect potential safety concerns
				</li>
				<li class="modal-content-list-item-info">
					If flagged by AI, reviewed by human moderators for final confirmation
				</li>
				<li class="modal-content-list-item-info">
					Results added to database with appropriate safety rating
				</li>
			</ul>
		</div>

		<div class="modal-content-section-warning">
			<h3 class="modal-content-heading flex items-center">
				<AlertTriangle class="mr-2 warning-triangle-icon" size={24} />
				Important Warning
			</h3>
			<p style:color="var(--color-text)" class="text-sm">
				<strong>Misuse of this feature</strong> (like spamming submissions) may result in restrictions
				on your account. Automated abuse detection is active.
			</p>
		</div>
	</div>
</Modal>
