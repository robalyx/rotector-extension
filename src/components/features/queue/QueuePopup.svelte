<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { logger } from '@/lib/utils/logging/logger';
	import { sanitizeEntityId } from '@/lib/utils/dom/sanitizer';
	import { getLoggedInUserId } from '@/lib/utils/client-id';
	import { restrictedAccessStore } from '@/lib/stores/restricted-access';
	import { STATUS, CAPTCHA_MESSAGES, KOFI_URL } from '@/lib/types/constants';
	import { Ban, Check, Clipboard, Clock, Database, Search, User, Users } from '@lucide/svelte';
	import AckCheckbox from '@/components/ui/AckCheckbox.svelte';
	import ExtLink from '@/components/ui/ExtLink.svelte';
	import Modal from '../../ui/Modal.svelte';
	import QueueLimitsDisplay from './QueueLimitsDisplay.svelte';
	import OutfitPicker from '../outfit/OutfitPicker.svelte';
	import type { UserStatus, QueueLimitsData, SelectedOutfit } from '@/lib/types/api';

	interface QueueLimitsRef {
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
			outfitIds?: number[],
			inappropriateProfile?: boolean,
			inappropriateFriends?: boolean,
			inappropriateGroups?: boolean,
			captchaToken?: string
		) => void | Promise<void>;
		onCancel?: () => void;
	}

	function splitSelections(selections: SelectedOutfit[]): {
		outfitNames: string[];
		outfitIds: number[];
	} {
		const outfitNames: string[] = [];
		const outfitIds: number[] = [];
		for (const selection of selections) {
			if (selection.kind === 'saved') outfitIds.push(selection.id);
			else outfitNames.push(selection.name);
		}
		return { outfitNames, outfitIds };
	}

	let {
		isOpen = $bindable(),
		userId,
		isReprocess = false,
		userStatus = null,
		onConfirm,
		onCancel
	}: Props = $props();

	type CheckThreshold = 'quick' | 'thorough';
	let profileCheck = $state<CheckThreshold>('quick');
	let friendsCheck = $state<CheckThreshold>('quick');
	let groupsCheck = $state<CheckThreshold>('quick');
	let selectedOutfits = $state<SelectedOutfit[]>([]);

	const thresholds = [
		{
			icon: Clipboard,
			name: 'profile-threshold',
			titleKey: 'queue_popup_profile_check_title',
			descKey: 'queue_popup_profile_check_description',
			get: () => profileCheck,
			set: (v: CheckThreshold) => (profileCheck = v)
		},
		{
			icon: User,
			name: 'friends-threshold',
			titleKey: 'queue_popup_friends_check_title',
			descKey: 'queue_popup_friends_check_description',
			get: () => friendsCheck,
			set: (v: CheckThreshold) => (friendsCheck = v)
		},
		{
			icon: Users,
			name: 'groups-threshold',
			titleKey: 'queue_popup_groups_check_title',
			descKey: 'queue_popup_groups_check_description',
			get: () => groupsCheck,
			set: (v: CheckThreshold) => (groupsCheck = v)
		}
	] as const;

	const ackItems = [
		{ key: 'dynamicLimits', labelKey: 'queue_popup_ack_dynamic_limits' },
		{ key: 'reviewProcess', labelKey: 'queue_popup_ack_review_process' },
		{ key: 'accuracy', labelKey: 'queue_popup_ack_accuracy' },
		{ key: 'noExploit', labelKey: 'queue_popup_ack_no_exploit' },
		{ key: 'confidentiality', labelKey: 'queue_popup_ack_confidentiality' }
	] as const;

	const howItWorksRows = [
		{ icon: Database, labelKey: 'queue_popup_how_database' },
		{ icon: Search, labelKey: 'queue_popup_how_hunter' },
		{ icon: Clock, labelKey: 'queue_popup_how_capacity' }
	] as const;

	const doRowsKey = [
		'queue_popup_do_investigating',
		'queue_popup_do_concerning_content',
		'queue_popup_do_not_already_flagged'
	] as const;

	const dontRowsKey = [
		'queue_popup_dont_random_friends',
		'queue_popup_dont_just_to_check',
		'queue_popup_dont_drama',
		'queue_popup_dont_identity',
		'queue_popup_dont_social_callouts',
		'queue_popup_dont_out_of_scope'
	] as const;
	type AckKey = (typeof ackItems)[number]['key'];
	let ackState = $state<Record<AckKey, boolean>>(
		Object.fromEntries(ackItems.map((i) => [i.key, false])) as Record<AckKey, boolean>
	);
	const allAcknowledged = $derived(ackItems.every((i) => ackState[i.key]));

	const thoroughCount = $derived(
		(profileCheck === 'thorough' ? 1 : 0) +
			(friendsCheck === 'thorough' ? 1 : 0) +
			(groupsCheck === 'thorough' ? 1 : 0)
	);
	const projectedCost = $derived(thoroughCount === 0 ? 1 : thoroughCount * 3);

	let ackSectionEl = $state<HTMLDivElement>();
	let submitting = $state(false);
	let queueLimitsRef: QueueLimitsRef | undefined = $state();
	let queueLimits = $state<QueueLimitsData | null>(null);
	let queueLimitsLoading = $state<boolean>(true);
	let queueLimitsError = $state<string | null>(null);
	let awaitingCaptcha = $state(false);
	let captchaSessionId = $state<string | null>(null);

	const sanitizedUserId = $derived(sanitizeEntityId(userId) ?? '');

	const isReanalysis = $derived(
		isReprocess ||
			(userStatus &&
				(userStatus.flagType === STATUS.FLAGS.UNSAFE ||
					userStatus.flagType === STATUS.FLAGS.PENDING ||
					userStatus.flagType === STATUS.FLAGS.MIXED))
	);

	const isRestricted = $derived($restrictedAccessStore.isRestricted);

	const isSelfLookup = $derived.by(() => {
		const clientId = getLoggedInUserId();
		return clientId !== null && sanitizedUserId !== '' && clientId === sanitizedUserId;
	});

	const hideQueueLimits = $derived(isRestricted && isSelfLookup);

	const outfitLimit = $derived(queueLimits?.outfit.remaining ?? 0);

	const canSubmit = $derived.by(() => {
		if (submitting || awaitingCaptcha) return false;
		if (hideQueueLimits) return true;
		return !queueLimitsLoading && queueLimits !== null && queueLimits.remaining >= projectedCost;
	});

	function toggleAll() {
		const newValue = !allAcknowledged;
		for (const item of ackItems) {
			ackState[item.key] = newValue;
		}
	}

	// Starts a captcha session keyed by sessionId so the eventual token reply can be matched back to this submission
	async function handleConfirm() {
		if (submitting || awaitingCaptcha) return;

		if (!allAcknowledged) {
			ackSectionEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			return;
		}

		awaitingCaptcha = true;
		const sessionId = `${String(Date.now())}-${Math.random().toString(36).slice(2, 15)}`;
		captchaSessionId = sessionId;

		const { outfitNames, outfitIds } = splitSelections($state.snapshot(selectedOutfits));

		try {
			logger.userAction('queue_popup_confirm', {
				userId: sanitizedUserId,
				isReanalysis,
				profileCheck,
				friendsCheck,
				groupsCheck,
				outfitNames,
				outfitIds
			});

			await browser.runtime.sendMessage({
				type: CAPTCHA_MESSAGES.CAPTCHA_START,
				sessionId,
				queueData: {
					userId: sanitizedUserId,
					outfitNames,
					outfitIds,
					inappropriateProfile: profileCheck === 'thorough',
					inappropriateFriends: friendsCheck === 'thorough',
					inappropriateGroups: groupsCheck === 'thorough'
				}
			});
		} catch (error) {
			logger.error('Failed to start captcha flow:', error);
			awaitingCaptcha = false;
			captchaSessionId = null;
		}
	}

	function handleCancel() {
		logger.userAction('queue_popup_cancel', { userId: sanitizedUserId });
		onCancel?.();
		isOpen = false;
		resetAllState();
	}

	function resetAllState() {
		profileCheck = 'quick';
		friendsCheck = 'quick';
		groupsCheck = 'quick';
		selectedOutfits = [];
		for (const item of ackItems) {
			ackState[item.key] = false;
		}
		submitting = false;
		awaitingCaptcha = false;
		captchaSessionId = null;
		queueLimitsRef?.reset();
	}

	$effect(() => {
		if (isOpen && queueLimitsRef && !hideQueueLimits) {
			queueLimitsRef.refresh().catch((error: unknown) => {
				logger.error('Failed to load queue limits:', error);
			});
		} else if (!isOpen && !awaitingCaptcha) {
			resetAllState();
		}
	});

	$effect(() => {
		const handleMessage = (message: {
			type: string;
			token?: string;
			sessionId?: string;
			queueData?: {
				userId: string;
				outfitNames: string[];
				outfitIds: number[];
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

					Promise.resolve(
						onConfirm?.(
							message.queueData.outfitNames.length > 0 ? message.queueData.outfitNames : undefined,
							message.queueData.outfitIds.length > 0 ? message.queueData.outfitIds : undefined,
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
						.catch((error: unknown) => {
							logger.error('Queue submission failed:', error);
							submitting = false;
						});
				}
			} else if (
				message.type === CAPTCHA_MESSAGES.CAPTCHA_CANCELLED &&
				message.sessionId === captchaSessionId
			) {
				awaitingCaptcha = false;
				captchaSessionId = null;
				logger.warn('Captcha was cancelled:', message.error);
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

	<div class="first-detection-hero mt-3">
		<p class="first-detection-hero-text">{$_('queue_popup_hero')}</p>
	</div>

	<div class="modal-section">
		<header class="modal-section-head">
			<h3 class="modal-section-title">{$_('queue_popup_how_it_works_heading')}</h3>
		</header>
		<ul class="first-detection-row-list">
			{#each howItWorksRows as row (row.labelKey)}
				<li class="first-detection-row">
					<span class="first-detection-row-icon-info" aria-hidden="true">
						<row.icon size={16} strokeWidth={2.5} />
					</span>
					<span>{$_(row.labelKey)}</span>
				</li>
			{/each}
		</ul>
	</div>

	<div class="modal-section">
		<header class="modal-section-head">
			<h3 class="modal-section-title">{$_('queue_popup_when_heading')}</h3>
		</header>
		<div class="first-detection-do-dont">
			<div class="first-detection-do-dont-col">
				<span class="first-detection-do-dont-label-do">{$_('queue_popup_do_label')}</span>
				<ul class="first-detection-row-list">
					{#each doRowsKey as key (key)}
						<li class="first-detection-row">
							<span class="first-detection-row-icon-yes" aria-hidden="true">
								<Check size={16} strokeWidth={2.5} />
							</span>
							<span>{$_(key)}</span>
						</li>
					{/each}
				</ul>
			</div>
			<div class="first-detection-do-dont-col">
				<span class="first-detection-do-dont-label-dont">{$_('queue_popup_dont_label')}</span>
				<ul class="first-detection-row-list">
					{#each dontRowsKey as key (key)}
						<li class="first-detection-row">
							<span class="first-detection-row-icon-deny" aria-hidden="true">
								<Ban size={16} strokeWidth={2.5} />
							</span>
							<span>{$_(key)}</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>

	{#if !hideQueueLimits}
		<div class="modal-section">
			<QueueLimitsDisplay
				bind:this={queueLimitsRef}
				autoLoad={false}
				headingTag="h3"
				showRetry={true}
				titleKey="stats_queue_title"
				bind:queueLimits
				bind:isLoading={queueLimitsLoading}
				bind:error={queueLimitsError}
			/>
		</div>
	{/if}

	<div class="modal-section">
		<header class="modal-section-head">
			<h3 class="modal-section-title">{$_('queue_popup_check_options_heading')}</h3>
		</header>
		<div class="modal-section-body">
			{#each thresholds as t (t.name)}
				<div class="queue-threshold-card">
					<header class="queue-threshold-header">
						<t.icon class="queue-threshold-icon" size={16} />
						<h4 class="queue-threshold-title">{$_(t.titleKey)}</h4>
					</header>
					<p class="queue-threshold-description">{$_(t.descKey)}</p>
					<div class="queue-threshold-options">
						<label class="queue-threshold-option">
							<input
								name={t.name}
								checked={t.get() === 'quick'}
								onchange={() => t.set('quick')}
								type="radio"
								value="quick"
							/>
							{$_('queue_popup_threshold_quick')}
						</label>
						<label class="queue-threshold-option">
							<input
								name={t.name}
								checked={t.get() === 'thorough'}
								onchange={() => t.set('thorough')}
								type="radio"
								value="thorough"
							/>
							{$_('queue_popup_threshold_thorough')}
							<span class="queue-cost-badge">
								{$_('queue_popup_thorough_cost_badge')}
							</span>
						</label>
					</div>
				</div>
			{/each}

			<OutfitPicker
				disabled={outfitLimit === 0}
				maxSelections={outfitLimit}
				onSelectionChange={(selections: SelectedOutfit[]) => (selectedOutfits = selections)}
				userId={sanitizedUserId}
				bind:selectedOutfits
			/>
		</div>
	</div>

	<div bind:this={ackSectionEl} class="modal-section">
		<header class="modal-section-head">
			<h3 class="modal-section-title">{$_('queue_popup_acknowledgment_heading')}</h3>
		</header>
		<div class="queue-misuse-warning">
			<p class="queue-misuse-warning-title">{$_('queue_popup_misuse_warning_title')}</p>
			<p class="queue-misuse-warning-body">
				{$_('queue_popup_misuse_warning_body')}
				<ExtLink class="queue-misuse-warning-link" href={KOFI_URL}>
					{$_('queue_popup_misuse_warning_link')}
				</ExtLink>
			</p>
		</div>
		<div class="queue-ack-list">
			<AckCheckbox checked={allAcknowledged} onchange={toggleAll} variant="all">
				{#snippet label()}
					{$_('queue_popup_ack_all')}
				{/snippet}
			</AckCheckbox>

			{#each ackItems as item (item.key)}
				<AckCheckbox bind:checked={ackState[item.key]}>
					{#snippet label()}
						{$_(item.labelKey)}
					{/snippet}
				</AckCheckbox>
			{/each}
		</div>
	</div>

	{#snippet actions()}
		{#if !hideQueueLimits && queueLimits !== null}
			<span class="queue-cost-summary">
				<span>{$_('queue_popup_submission_cost_label')}</span>
				<span
					class="queue-cost-value"
					class:queue-cost-value-over={queueLimits.remaining < projectedCost}
				>
					{projectedCost}
				</span>
			</span>
		{/if}
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
