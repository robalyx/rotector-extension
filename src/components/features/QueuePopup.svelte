<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { logger } from '@/lib/utils/logger';
	import { sanitizeEntityId } from '@/lib/utils/sanitizer';
	import { getLoggedInUserId } from '@/lib/utils/client-id';
	import { restrictedAccessStore } from '@/lib/stores/restricted-access';
	import { STATUS, CAPTCHA_MESSAGES } from '@/lib/types/constants';
	import { Clipboard, User, Users, Check } from '@lucide/svelte';
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

	// Acknowledgment items
	const ackItems = [
		{ key: 'scope', labelKey: 'queue_popup_ack_scope' },
		{ key: 'notInnocent', labelKey: 'queue_popup_ack_not_innocent' },
		{ key: 'dynamicLimits', labelKey: 'queue_popup_ack_dynamic_limits' },
		{ key: 'reviewProcess', labelKey: 'queue_popup_ack_review_process' },
		{ key: 'accuracy', labelKey: 'queue_popup_ack_accuracy' },
		{ key: 'notIdentity', labelKey: 'queue_popup_ack_not_identity' },
		{ key: 'noRetaliation', labelKey: 'queue_popup_ack_no_retaliation' },
		{ key: 'noExploit', labelKey: 'queue_popup_ack_no_exploit' },
		{ key: 'confidentiality', labelKey: 'queue_popup_ack_confidentiality' },
		{ key: 'inaccuracyRestriction', labelKey: 'queue_popup_ack_inaccuracy_restriction' },
		{ key: 'misuse', labelKey: 'queue_popup_ack_misuse' }
	] as const;
	type AckKey = (typeof ackItems)[number]['key'];
	let ackState = $state<Record<AckKey, boolean>>(
		Object.fromEntries(ackItems.map((i) => [i.key, false])) as Record<AckKey, boolean>
	);
	const allAcknowledged = $derived(ackItems.every((i) => ackState[i.key]));

	// UI state
	let ackSectionEl = $state<HTMLDivElement>();
	let submitting = $state(false);

	// Queue limits component
	let queueLimitsRef: QueueLimitsRef | undefined = $state();

	// Captcha state
	let awaitingCaptcha = $state(false);
	let captchaSessionId = $state<string | null>(null);

	// Sanitize user ID for display and API calls
	const sanitizedUserId = $derived(sanitizeEntityId(userId) ?? '');

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
	const outfitLimit = $derived(queueLimitsRef?.getState().queueLimits?.outfit.remaining ?? 0);

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
		for (const item of ackItems) {
			ackState[item.key] = newValue;
		}
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

			// Modal stays open waiting for captcha completion
		} catch (error) {
			logger.error('Failed to start captcha flow:', error);
			awaitingCaptcha = false;
			captchaSessionId = null;
		}
	}

	// Handle cancellation
	function handleCancel() {
		logger.userAction('queue_popup_cancel', { userId: sanitizedUserId });
		onCancel?.();
		isOpen = false;
		resetAllState();
	}

	// Helper to reset all state
	function resetAllState() {
		profileCheck = 'quick';
		friendsCheck = 'quick';
		groupsCheck = 'quick';
		selectedOutfitNames = [];
		for (const item of ackItems) {
			ackState[item.key] = false;
		}
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
	onCancel={handleCancel}
	showCancel={false}
	showConfirm={false}
	status="warning"
	title={isReanalysis ? $_('queue_popup_title_reprocess') : $_('queue_popup_title_queue')}
	bind:isOpen
>
	<p class="modal-paragraph">
		{#if isReanalysis}
			{$_('queue_popup_description_reanalysis', { values: { 0: sanitizedUserId } })}
		{:else}
			{$_('queue_popup_description_analysis', { values: { 0: sanitizedUserId } })}
		{/if}
	</p>

	{#if !hideQueueLimits}
		<div class="modal-section">
			<QueueLimitsDisplay bind:this={queueLimitsRef} autoLoad={false} />
		</div>
	{/if}

	<div class="modal-section">
		<header class="modal-section-head">
			<h3 class="modal-section-title">{$_('queue_popup_check_options_heading')}</h3>
		</header>
		<div class="modal-section-body">
			<div class="queue-threshold-card">
				<header class="queue-threshold-header">
					<Clipboard class="queue-threshold-icon" size={16} />
					<h4 class="queue-threshold-title">{$_('queue_popup_profile_check_title')}</h4>
				</header>
				<p class="queue-threshold-description">
					{$_('queue_popup_profile_check_description')}
				</p>
				<div class="queue-threshold-options">
					<label class="queue-threshold-option">
						<input
							name="profile-threshold"
							checked={profileCheck === 'quick'}
							onchange={() => (profileCheck = 'quick')}
							type="radio"
							value="quick"
						/>
						{$_('queue_popup_threshold_quick')}
					</label>
					<label class="queue-threshold-option">
						<input
							name="profile-threshold"
							checked={profileCheck === 'thorough'}
							onchange={() => (profileCheck = 'thorough')}
							type="radio"
							value="thorough"
						/>
						{$_('queue_popup_threshold_thorough')}
					</label>
				</div>
			</div>

			<div class="queue-threshold-card">
				<header class="queue-threshold-header">
					<User class="queue-threshold-icon" size={16} />
					<h4 class="queue-threshold-title">{$_('queue_popup_friends_check_title')}</h4>
				</header>
				<p class="queue-threshold-description">
					{$_('queue_popup_friends_check_description')}
				</p>
				<div class="queue-threshold-options">
					<label class="queue-threshold-option">
						<input
							name="friends-threshold"
							checked={friendsCheck === 'quick'}
							onchange={() => (friendsCheck = 'quick')}
							type="radio"
							value="quick"
						/>
						{$_('queue_popup_threshold_quick')}
					</label>
					<label class="queue-threshold-option">
						<input
							name="friends-threshold"
							checked={friendsCheck === 'thorough'}
							onchange={() => (friendsCheck = 'thorough')}
							type="radio"
							value="thorough"
						/>
						{$_('queue_popup_threshold_thorough')}
					</label>
				</div>
			</div>

			<div class="queue-threshold-card">
				<header class="queue-threshold-header">
					<Users class="queue-threshold-icon" size={16} />
					<h4 class="queue-threshold-title">{$_('queue_popup_groups_check_title')}</h4>
				</header>
				<p class="queue-threshold-description">
					{$_('queue_popup_groups_check_description')}
				</p>
				<div class="queue-threshold-options">
					<label class="queue-threshold-option">
						<input
							name="groups-threshold"
							checked={groupsCheck === 'quick'}
							onchange={() => (groupsCheck = 'quick')}
							type="radio"
							value="quick"
						/>
						{$_('queue_popup_threshold_quick')}
					</label>
					<label class="queue-threshold-option">
						<input
							name="groups-threshold"
							checked={groupsCheck === 'thorough'}
							onchange={() => (groupsCheck = 'thorough')}
							type="radio"
							value="thorough"
						/>
						{$_('queue_popup_threshold_thorough')}
					</label>
				</div>
			</div>

			<OutfitPicker
				disabled={outfitLimit === 0}
				maxSelections={outfitLimit}
				onSelectionChange={(names: string[]) => (selectedOutfitNames = names)}
				userId={sanitizedUserId}
				bind:selectedOutfits={selectedOutfitNames}
			/>
		</div>
	</div>

	<div bind:this={ackSectionEl} class="modal-section">
		<header class="modal-section-head">
			<h3 class="modal-section-title">{$_('queue_popup_acknowledgment_heading')}</h3>
		</header>
		<div class="queue-ack-list">
			<label class="queue-ack-item-all">
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
				<span class="queue-ack-text">{$_('queue_popup_ack_all')}</span>
			</label>

			{#each ackItems as item (item.key)}
				<label class="queue-ack-item">
					<input class="queue-ack-checkbox" type="checkbox" bind:checked={ackState[item.key]} />
					<span class="queue-ack-checkmark" class:checked={ackState[item.key]}>
						{#if ackState[item.key]}
							<Check aria-hidden="true" size={14} strokeWidth={3} />
						{/if}
					</span>
					<span class="queue-ack-text">{$_(item.labelKey)}</span>
				</label>
			{/each}
		</div>
	</div>

	{#snippet actions()}
		<button class="modal-button-cancel" onclick={handleCancel} type="button">
			{$_('queue_popup_cancel_button')}
		</button>
		<button
			class="modal-button-primary"
			disabled={!canSubmit}
			onclick={handleConfirm}
			type="button"
		>
			{submitting ? $_('queue_popup_submitting_button') : $_('queue_popup_submit_button')}
		</button>
	{/snippet}
</Modal>
