<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { logger } from '@/lib/utils/logger';
	import { sanitizeEntityId } from '@/lib/utils/sanitizer';
	import { getLoggedInUserId } from '@/lib/utils/client-id';
	import { restrictedAccessStore } from '@/lib/stores/restricted-access';
	import { STATUS, CAPTCHA_MESSAGES } from '@/lib/types/constants';
	import { Clipboard, User, Users, Check } from 'lucide-svelte';
	import Modal from '../ui/Modal.svelte';
	import QueueLimitsDisplay from '../ui/QueueLimitsDisplay.svelte';
	import OutfitPicker from './OutfitPicker.svelte';
	import type { UserStatus, QueueLimitsData } from '@/lib/types/api';

	interface QueueLimitsRef {
		getState: () => {
			queueLimits: QueueLimitsData | null;
			isLoading: boolean;
			error: string | null;
		};
		refresh: () => Promise<void>;
		reset: () => void;
	}

	interface Props {
		isOpen: boolean;
		userId: string | number;
		isReprocess?: boolean;
		userStatus?: UserStatus | null;
		onConfirm?: (
			outfitNames?: string[],
			inappropriateProfile?: boolean,
			inappropriateFriends?: boolean,
			inappropriateGroups?: boolean,
			captchaToken?: string
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
	let selectedOutfitNames = $state<string[]>([]);

	// Acknowledgment states
	let ackScope = $state(false);
	let ackNotInnocent = $state(false);
	let ackDynamicLimits = $state(false);
	let ackReviewProcess = $state(false);
	let ackAccuracy = $state(false);
	let ackMisuse = $state(false);
	const allAcknowledged = $derived(
		ackScope && ackNotInnocent && ackDynamicLimits && ackReviewProcess && ackAccuracy && ackMisuse
	);

	// UI state
	let ackSectionEl = $state<HTMLDivElement>();
	let submitting = $state(false);

	// Queue limits component
	let queueLimitsRef: QueueLimitsRef | undefined = $state();

	// Captcha state
	let awaitingCaptcha = $state(false);
	let captchaSessionId = $state<string | null>(null);

	// Sanitize user ID for display and API calls
	const sanitizedUserId = $derived.by(() => {
		const id = sanitizeEntityId(userId);
		return id ? id.toString() : '';
	});

	// Check if this is a reanalysis of an existing flagged user
	const isReanalysis = $derived(
		isReprocess ||
			(userStatus &&
				(userStatus.flagType === STATUS.FLAGS.UNSAFE ||
					userStatus.flagType === STATUS.FLAGS.PENDING ||
					userStatus.flagType === STATUS.FLAGS.MIXED))
	);

	// Check if access is restricted
	const isRestricted = $derived($restrictedAccessStore.isRestricted);

	// Check if this is a self-lookup
	const isSelfLookup = $derived.by(() => {
		const clientId = getLoggedInUserId();
		return clientId !== null && sanitizedUserId !== '' && clientId === sanitizedUserId;
	});

	// Hide queue limits for restricted self-lookups
	const hideQueueLimits = $derived(isRestricted && isSelfLookup);

	// Get outfit limit from queue limits
	const outfitLimit = $derived.by(() => {
		if (!queueLimitsRef) return 0;
		const state = queueLimitsRef.getState();
		return state.queueLimits?.outfit.remaining ?? 0;
	});

	// Determine if submission is allowed
	const canSubmit = $derived.by(() => {
		if (submitting || awaitingCaptcha) return false;
		if (hideQueueLimits) return true;
		if (!queueLimitsRef) return false;

		const state = queueLimitsRef.getState();
		return !state.isLoading && state.queueLimits !== null && state.queueLimits.remaining > 0;
	});

	function toggleAll() {
		const newValue = !allAcknowledged;
		ackScope = newValue;
		ackNotInnocent = newValue;
		ackDynamicLimits = newValue;
		ackReviewProcess = newValue;
		ackAccuracy = newValue;
		ackMisuse = newValue;
	}

	// Handle form submission which starts captcha flow
	async function handleConfirm() {
		if (submitting || awaitingCaptcha) return;

		// Scroll to acknowledgment section if not all acknowledged
		if (!allAcknowledged) {
			ackSectionEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			return;
		}

		awaitingCaptcha = true;
		const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
		captchaSessionId = sessionId;

		try {
			logger.userAction('queue_popup_confirm', {
				userId: sanitizedUserId,
				isReanalysis,
				profileCheck,
				friendsCheck,
				groupsCheck,
				selectedOutfitNames: $state.snapshot(selectedOutfitNames)
			});

			// Start captcha flow via background script
			await browser.runtime.sendMessage({
				type: CAPTCHA_MESSAGES.CAPTCHA_START,
				sessionId,
				queueData: {
					userId: sanitizedUserId,
					outfitNames: $state.snapshot(selectedOutfitNames),
					inappropriateProfile: profileCheck === 'thorough',
					inappropriateFriends: friendsCheck === 'thorough',
					inappropriateGroups: groupsCheck === 'thorough'
				}
			});

			// NOTE: Modal stays open waiting for captcha completion
		} catch (error) {
			logger.error('Failed to start captcha flow:', error);
			awaitingCaptcha = false;
			captchaSessionId = null;
		}
	}

	// Handle cancellation
	function handleCancel() {
		logger.userAction('queue_popup_cancel', { userId: sanitizedUserId });

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
		selectedOutfitNames = [];
		ackScope = false;
		ackNotInnocent = false;
		ackDynamicLimits = false;
		ackReviewProcess = false;
		ackAccuracy = false;
		ackMisuse = false;
		submitting = false;
		awaitingCaptcha = false;
		captchaSessionId = null;
		queueLimitsRef?.reset();
	}

	// Fetch queue limits when modal opens, reset state when it closes
	$effect(() => {
		if (isOpen && queueLimitsRef && !hideQueueLimits) {
			queueLimitsRef.refresh().catch((err: unknown) => {
				logger.error('Failed to load queue limits:', err);
			});
		} else if (!isOpen && !awaitingCaptcha) {
			resetAllState();
		}
	});

	// Listen for captcha token from background script
	$effect(() => {
		const handleMessage = (message: {
			type: string;
			token?: string;
			sessionId?: string;
			queueData?: {
				userId: string;
				outfitNames: string[];
				inappropriateProfile: boolean;
				inappropriateFriends: boolean;
				inappropriateGroups: boolean;
			};
			error?: string;
		}) => {
			if (message.type === CAPTCHA_MESSAGES.CAPTCHA_TOKEN_READY) {
				if (message.sessionId === captchaSessionId && message.token && message.queueData) {
					submitting = true;
					awaitingCaptcha = false;

					if (onConfirm) {
						Promise.resolve(
							onConfirm(
								message.queueData.outfitNames.length > 0
									? message.queueData.outfitNames
									: undefined,
								message.queueData.inappropriateProfile,
								message.queueData.inappropriateFriends,
								message.queueData.inappropriateGroups,
								message.token
							)
						)
							.then(() => {
								isOpen = false;
								resetAllState();
							})
							.catch((error) => {
								logger.error('Queue submission failed:', error);
								submitting = false;
							});
					} else {
						isOpen = false;
						resetAllState();
					}
				}
			} else if (message.type === CAPTCHA_MESSAGES.CAPTCHA_CANCELLED) {
				if (message.sessionId === captchaSessionId) {
					awaitingCaptcha = false;
					captchaSessionId = null;
					logger.warn('Captcha was cancelled:', message.error);
				}
			}
		};

		browser.runtime.onMessage.addListener(handleMessage);
		return () => {
			browser.runtime.onMessage.removeListener(handleMessage);
		};
	});
</script>

<Modal
	icon="warning"
	onCancel={handleCancel}
	showCancel={false}
	showConfirm={false}
	title={isReanalysis ? $_('queue_popup_title_reprocess') : $_('queue_popup_title_queue')}
	bind:isOpen
>
	<div>
		<p class="text-text mb-4!">
			{#if isReanalysis}
				{$_('queue_popup_description_reanalysis', { values: { 0: sanitizedUserId } })}
			{:else}
				{$_('queue_popup_description_analysis', { values: { 0: sanitizedUserId } })}
			{/if}
		</p>

		<!-- Queue Limits Section -->
		{#if !hideQueueLimits}
			<div class="mb-6">
				<QueueLimitsDisplay bind:this={queueLimitsRef} autoLoad={false} variant="modal" />
			</div>
		{/if}

		<!-- Check Options Section -->
		<div class="queue-selection-section">
			<h3 class="text-text mb-4 text-lg font-semibold">
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

				<!-- Outfit Picker -->
				<OutfitPicker
					disabled={outfitLimit === 0}
					maxSelections={outfitLimit}
					onSelectionChange={(names: string[]) => (selectedOutfitNames = names)}
					userId={sanitizedUserId}
					bind:selectedOutfits={selectedOutfitNames}
				/>
			</div>
		</div>

		<!-- Acknowledgment Checkboxes -->
		<div bind:this={ackSectionEl} class="queue-ack-section">
			<h3 class="queue-ack-heading">
				{$_('queue_popup_acknowledgment_heading')}
			</h3>

			<div class="queue-ack-list">
				<label class="queue-ack-item queue-ack-item-all">
					<input
						class="queue-ack-checkbox"
						checked={allAcknowledged}
						onchange={toggleAll}
						type="checkbox"
					/>
					<span class="queue-ack-checkmark" class:checked={allAcknowledged}>
						{#if allAcknowledged}
							<Check aria-hidden="true" size={14} strokeWidth={3} />
						{/if}
					</span>
					<span class="queue-ack-text queue-ack-text-all">
						{$_('queue_popup_ack_all')}
					</span>
				</label>

				<label class="queue-ack-item">
					<input class="queue-ack-checkbox" type="checkbox" bind:checked={ackScope} />
					<span class="queue-ack-checkmark" class:checked={ackScope}>
						{#if ackScope}
							<Check aria-hidden="true" size={14} strokeWidth={3} />
						{/if}
					</span>
					<span class="queue-ack-text">{$_('queue_popup_ack_scope')}</span>
				</label>

				<label class="queue-ack-item">
					<input class="queue-ack-checkbox" type="checkbox" bind:checked={ackNotInnocent} />
					<span class="queue-ack-checkmark" class:checked={ackNotInnocent}>
						{#if ackNotInnocent}
							<Check aria-hidden="true" size={14} strokeWidth={3} />
						{/if}
					</span>
					<span class="queue-ack-text">{$_('queue_popup_ack_not_innocent')}</span>
				</label>

				<label class="queue-ack-item">
					<input class="queue-ack-checkbox" type="checkbox" bind:checked={ackDynamicLimits} />
					<span class="queue-ack-checkmark" class:checked={ackDynamicLimits}>
						{#if ackDynamicLimits}
							<Check aria-hidden="true" size={14} strokeWidth={3} />
						{/if}
					</span>
					<span class="queue-ack-text">{$_('queue_popup_ack_dynamic_limits')}</span>
				</label>

				<label class="queue-ack-item">
					<input class="queue-ack-checkbox" type="checkbox" bind:checked={ackReviewProcess} />
					<span class="queue-ack-checkmark" class:checked={ackReviewProcess}>
						{#if ackReviewProcess}
							<Check aria-hidden="true" size={14} strokeWidth={3} />
						{/if}
					</span>
					<span class="queue-ack-text">{$_('queue_popup_ack_review_process')}</span>
				</label>

				<label class="queue-ack-item">
					<input class="queue-ack-checkbox" type="checkbox" bind:checked={ackAccuracy} />
					<span class="queue-ack-checkmark" class:checked={ackAccuracy}>
						{#if ackAccuracy}
							<Check aria-hidden="true" size={14} strokeWidth={3} />
						{/if}
					</span>
					<span class="queue-ack-text">{$_('queue_popup_ack_accuracy')}</span>
				</label>

				<label class="queue-ack-item">
					<input class="queue-ack-checkbox" type="checkbox" bind:checked={ackMisuse} />
					<span class="queue-ack-checkmark" class:checked={ackMisuse}>
						{#if ackMisuse}
							<Check aria-hidden="true" size={14} strokeWidth={3} />
						{/if}
					</span>
					<span class="queue-ack-text">{$_('queue_popup_ack_misuse')}</span>
				</label>
			</div>
		</div>
	</div>

	{#snippet actions()}
		<button class="modal-cancel" onclick={handleCancel} type="button">
			{$_('queue_popup_cancel_button')}
		</button>
		<button
			class="modal-confirm modal-confirm-queue"
			disabled={!canSubmit}
			onclick={handleConfirm}
			type="button"
		>
			{submitting ? $_('queue_popup_submitting_button') : $_('queue_popup_submit_button')}
		</button>
	{/snippet}
</Modal>
