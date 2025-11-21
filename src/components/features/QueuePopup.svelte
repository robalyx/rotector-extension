<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { logger } from '@/lib/utils/logger';
	import { sanitizeEntityId } from '@/lib/utils/sanitizer';
	import { STATUS } from '@/lib/types/constants';
	import { Shirt, Clipboard, User, Users, AlertTriangle, Check } from 'lucide-svelte';
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

	// Threshold states
	type CheckThreshold = 'quick' | 'thorough';
	let profileCheck = $state<CheckThreshold>('quick');
	let friendsCheck = $state<CheckThreshold>('quick');
	let groupsCheck = $state<CheckThreshold>('quick');
	let outfitCheck = $state(false);

	// UI state
	let submitting = $state(false);

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

	const canSubmit = $derived(() => {
		return !submitting;
	});

	// Handle form submission
	async function handleConfirm() {
		if (submitting) return;

		submitting = true;

		try {
			logger.userAction('queue_popup_confirm', {
				userId: sanitizedUserId(),
				isReanalysis,
				profileCheck,
				friendsCheck,
				groupsCheck,
				outfitCheck
			});

			if (onConfirm) {
				// Map thresholds to boolean flags
				// quick = false, thorough = true
				const inappropriateProfile = profileCheck === 'thorough';
				const inappropriateFriends = friendsCheck === 'thorough';
				const inappropriateGroups = groupsCheck === 'thorough';
				const inappropriateOutfit = outfitCheck;

				await onConfirm(
					inappropriateOutfit,
					inappropriateProfile,
					inappropriateFriends,
					inappropriateGroups
				);
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

	// Helper to reset all state
	function resetAllState() {
		profileCheck = 'quick';
		friendsCheck = 'quick';
		groupsCheck = 'quick';
		outfitCheck = false;
		submitting = false;
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
	cancelText={$_('queue_popup_cancel_button')}
	confirmDisabled={!canSubmit()}
	confirmText={submitting ? $_('queue_popup_submitting_button') : $_('queue_popup_submit_button')}
	confirmVariant="queue"
	icon="warning"
	onCancel={handleCancel}
	onConfirm={handleConfirm}
	title={isReanalysis ? $_('queue_popup_title_reprocess') : $_('queue_popup_title_queue')}
	bind:isOpen
>
	<div>
		<p style:color="var(--color-text)" class="mb-6!">
			{#if isReanalysis}
				{$_('queue_popup_description_reanalysis', { values: { 0: sanitizedUserId() } })}
			{:else}
				{$_('queue_popup_description_analysis', { values: { 0: sanitizedUserId() } })}
			{/if}
		</p>

		<!-- Check Options Section -->
		<div class="queue-selection-section">
			<h3
				style:color="var(--color-text)"
				class="
        mb-4 text-lg font-semibold
      "
			>
				{$_('queue_popup_check_options_heading')}
			</h3>

			<div class="mb-6 space-y-4">
				<!-- Profile Check Card -->
				<div class="queue-threshold-card queue-threshold-card-profile">
					<div class="queue-threshold-header">
						<Clipboard class="profile-icon" size={24} />
						<div class="queue-threshold-title">{$_('queue_popup_profile_check_title')}</div>
					</div>
					<div class="queue-threshold-description">
						{$_('queue_popup_profile_check_description')}
					</div>
					<div class="queue-threshold-options">
						<label class="queue-threshold-option">
							<input
								name="profile-threshold"
								checked={profileCheck === 'quick'}
								onchange={() => (profileCheck = 'quick')}
								type="radio"
								value="quick"
							/>
							<span>{$_('queue_popup_threshold_quick')}</span>
						</label>
						<label class="queue-threshold-option">
							<input
								name="profile-threshold"
								checked={profileCheck === 'thorough'}
								onchange={() => (profileCheck = 'thorough')}
								type="radio"
								value="thorough"
							/>
							<span>{$_('queue_popup_threshold_thorough')}</span>
						</label>
					</div>
				</div>

				<!-- Friends Check Card -->
				<div class="queue-threshold-card queue-threshold-card-friends">
					<div class="queue-threshold-header">
						<User class="friends-icon" size={24} />
						<div class="queue-threshold-title">{$_('queue_popup_friends_check_title')}</div>
					</div>
					<div class="queue-threshold-description">
						{$_('queue_popup_friends_check_description')}
					</div>
					<div class="queue-threshold-options">
						<label class="queue-threshold-option">
							<input
								name="friends-threshold"
								checked={friendsCheck === 'quick'}
								onchange={() => (friendsCheck = 'quick')}
								type="radio"
								value="quick"
							/>
							<span>{$_('queue_popup_threshold_quick')}</span>
						</label>
						<label class="queue-threshold-option">
							<input
								name="friends-threshold"
								checked={friendsCheck === 'thorough'}
								onchange={() => (friendsCheck = 'thorough')}
								type="radio"
								value="thorough"
							/>
							<span>{$_('queue_popup_threshold_thorough')}</span>
						</label>
					</div>
				</div>

				<!-- Groups Check Card -->
				<div class="queue-threshold-card queue-threshold-card-groups">
					<div class="queue-threshold-header">
						<Users class="groups-icon" size={24} />
						<div class="queue-threshold-title">{$_('queue_popup_groups_check_title')}</div>
					</div>
					<div class="queue-threshold-description">
						{$_('queue_popup_groups_check_description')}
					</div>
					<div class="queue-threshold-options">
						<label class="queue-threshold-option">
							<input
								name="groups-threshold"
								checked={groupsCheck === 'quick'}
								onchange={() => (groupsCheck = 'quick')}
								type="radio"
								value="quick"
							/>
							<span>{$_('queue_popup_threshold_quick')}</span>
						</label>
						<label class="queue-threshold-option">
							<input
								name="groups-threshold"
								checked={groupsCheck === 'thorough'}
								onchange={() => (groupsCheck = 'thorough')}
								type="radio"
								value="thorough"
							/>
							<span>{$_('queue_popup_threshold_thorough')}</span>
						</label>
					</div>
				</div>

				<!-- Outfit Check Card -->
				<div class="queue-toggle-card queue-toggle-card-outfit">
					<div class="queue-toggle-header">
						<Shirt class="outfit-icon" size={24} />
						<div class="queue-toggle-title">{$_('queue_popup_outfit_check_title')}</div>
					</div>
					<div class="queue-toggle-description">
						{$_('queue_popup_outfit_check_description')}
					</div>
					<div class="queue-toggle-container">
						<label class="queue-toggle-switch">
							<input
								checked={outfitCheck}
								onchange={() => (outfitCheck = !outfitCheck)}
								type="checkbox"
							/>
							<span class="queue-toggle-slider"></span>
						</label>
						<span class="queue-toggle-label">
							{outfitCheck ? $_('queue_popup_outfit_enabled') : $_('queue_popup_outfit_disabled')}
						</span>
					</div>
				</div>
			</div>
		</div>

		<div class="modal-content-section-info">
			<h3 class="modal-content-heading">
				<Check class="mr-2 text-blue-500" size={18} />
				{$_('queue_popup_review_process_heading')}
			</h3>
			<ul class="modal-content-list">
				<li class="modal-content-list-item-info">
					{$_('queue_popup_review_process_step1')}
				</li>
				<li class="modal-content-list-item-info">
					{$_('queue_popup_review_process_step2')}
				</li>
				<li class="modal-content-list-item-info">
					{$_('queue_popup_review_process_step3')}
				</li>
			</ul>
		</div>

		<div class="modal-content-section-warning">
			<h3 class="modal-content-heading flex items-center">
				<AlertTriangle class="mr-2 warning-triangle-icon" size={24} />
				{$_('queue_popup_warning_heading')}
			</h3>
			<p style:color="var(--color-text)" class="text-sm">
				<strong>{$_('queue_popup_warning_message_prefix')}</strong>
				{$_('queue_popup_warning_message_suffix')}
			</p>
		</div>
	</div>
</Modal>
