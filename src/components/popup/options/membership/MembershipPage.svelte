<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import {
		Check,
		CircleAlert,
		CircleX,
		Copy,
		ExternalLink,
		Eye,
		EyeOff,
		Lock,
		RotateCcw,
		TriangleAlert
	} from '@lucide/svelte';
	import type {
		CurrentAvatarInfo,
		MembershipBadgeUpdatePayload,
		MembershipStatus,
		MembershipTier,
		MembershipVerificationChallenge
	} from '@/lib/types/api';
	import { settings, updateSetting } from '@/lib/stores/settings';
	import { KOFI_URL } from '@/lib/types/constants';
	import { SETTINGS_KEYS } from '@/lib/types/settings';
	import ExtLink from '@/components/ui/ExtLink.svelte';
	import {
		clearBadge,
		confirmVerification,
		loadMembershipStatus,
		membershipLoading,
		membershipStore,
		updateBadge
	} from '@/lib/stores/membership';
	import { apiClient } from '@/lib/services/rotector/api-client';
	import { asApiError } from '@/lib/utils/api/api-error';
	import { getCurrentAvatarInfo } from '@/lib/services/roblox/api';
	import { showError, showSuccess } from '@/lib/stores/toast';
	import { logger } from '@/lib/utils/logging/logger';
	import LoadingSpinner from '../../../ui/LoadingSpinner.svelte';
	import Modal from '../../../ui/Modal.svelte';
	import MembershipIcon from '@/components/ui/membership/MembershipIcon.svelte';
	import MembershipPill from '@/components/ui/membership/MembershipPill.svelte';
	import {
		BADGE_DESIGN_KEYS,
		ICON_DESIGN_KEYS,
		indexUnlockTierName,
		resolveDesignIndex,
		TEXT_DESIGN_KEYS,
		TIER_ALLOWLIST,
		type DesignAxis,
		type IconDesignKey
	} from '@/lib/utils/membership-designs';

	const DISCORD_URL = 'https://discord.gg/rotector';
	const ctaRows = [
		{ href: KOFI_URL, labelKey: 'membership_cta_kofi', variant: 'kofi' },
		{ href: DISCORD_URL, labelKey: 'membership_cta_discord', variant: 'discord' }
	] as const;
	const AXIS_PAYLOAD_KEY: Readonly<Record<DesignAxis, keyof MembershipBadgeUpdatePayload>> = {
		badge: 'badgeDesign',
		icon: 'iconDesign',
		text: 'textDesign'
	};

	let apiKeyDraft = $state<string>(get(settings)[SETTINGS_KEYS.API_KEY]);
	let apiKeyVisible = $state(false);
	let savingKey = $state(false);
	let avatarInfo = $state<CurrentAvatarInfo | null>(null);
	let avatarLoading = $state(false);
	let showVerifyModal = $state(false);
	let verifyStep = $state<'enter-id' | 'show-phrase' | 'fatal'>('enter-id');
	let verifyUserIdInput = $state('');
	let verifyChallenge = $state<MembershipVerificationChallenge | null>(null);
	let verifyLoading = $state(false);
	let verifyConfirming = $state(false);
	let verifyError = $state<{ kind: 'warning' | 'muted'; message: string } | null>(null);
	let verifyFatalMessage = $state<string | null>(null);
	let verifyCopied = $state(false);
	let verifyCopyTimer: ReturnType<typeof setTimeout> | null = null;
	let showRemoveModal = $state(false);
	let clearing = $state(false);
	let pendingAxis = $state<DesignAxis | null>(null);

	const storedApiKey = $derived($settings[SETTINGS_KEYS.API_KEY]);
	const keyDirty = $derived(apiKeyDraft.trim() !== storedApiKey.trim());
	const step1Parts = $derived(
		$_('membership_step_1', { values: { 0: '|||LINK|||' } }).split('|||LINK|||')
	);
	const step2Parts = $derived(
		$_('membership_step_2', { values: { 0: '|||LINK|||' } }).split('|||LINK|||')
	);
	const membershipState = $derived($membershipStore);
	const memberStatus = $derived<MembershipStatus | null>(
		membershipState.kind === 'member' ? membershipState.status : null
	);
	const associatedUserId = $derived(memberStatus?.associatedRobloxUserId ?? 0);
	const hasAssignment = $derived(associatedUserId > 0);
	const tier = $derived<MembershipTier>(memberStatus?.tier ?? 1);
	const axisCurrent = $derived<Record<DesignAxis, number>>(
		memberStatus
			? {
					badge: resolveDesignIndex(memberStatus.badgeDesign, tier, 'badge'),
					icon: resolveDesignIndex(memberStatus.iconDesign, tier, 'icon'),
					text: resolveDesignIndex(memberStatus.textDesign, tier, 'text')
				}
			: { badge: 0, icon: 0, text: 0 }
	);

	$effect(() => {
		void loadMembershipStatus();
	});

	$effect(() => () => {
		if (verifyCopyTimer) clearTimeout(verifyCopyTimer);
	});

	$effect(() => {
		if (!memberStatus || !hasAssignment) {
			avatarInfo = null;
			return;
		}
		const userId = associatedUserId;
		avatarLoading = true;
		avatarInfo = null;
		void getCurrentAvatarInfo(userId)
			.then((info) => {
				const current = get(membershipStore);
				if (current.kind === 'member' && current.status.associatedRobloxUserId === userId) {
					avatarInfo = info;
				}
			})
			.catch((error: unknown) => {
				logger.error('Failed to load Roblox user info for member badge:', error);
			})
			.finally(() => {
				avatarLoading = false;
			});
	});

	async function handleSaveKey() {
		const trimmed = apiKeyDraft.trim();
		if (trimmed === storedApiKey.trim()) return;

		savingKey = true;
		try {
			await updateSetting(SETTINGS_KEYS.API_KEY, trimmed);
			showSuccess($_('membership_toast_key_saved'));
		} catch (error) {
			logger.error('Failed to save membership API key:', error);
			showError($_('membership_toast_key_save_failed'));
		} finally {
			savingKey = false;
		}
	}

	function resetVerifyState() {
		verifyStep = 'enter-id';
		verifyUserIdInput = '';
		verifyChallenge = null;
		verifyLoading = false;
		verifyConfirming = false;
		verifyError = null;
		verifyFatalMessage = null;
		verifyCopied = false;
		if (verifyCopyTimer) {
			clearTimeout(verifyCopyTimer);
			verifyCopyTimer = null;
		}
	}

	function openVerifyModal() {
		resetVerifyState();
		if (hasAssignment) {
			verifyUserIdInput = String(associatedUserId);
		}
		showVerifyModal = true;
	}

	// Validates the user id with a strict regex because parseInt would silently accept "123abc" or "0"
	async function handleStep1Submit() {
		const trimmed = verifyUserIdInput.trim();
		if (!/^[1-9]\d*$/.test(trimmed)) {
			showError($_('membership_toast_invalid_user_id'));
			return;
		}
		const parsed = Number(trimmed);
		verifyLoading = true;
		verifyError = null;
		verifyFatalMessage = null;
		try {
			verifyChallenge = await apiClient.getMembershipVerification(parsed);
			verifyStep = 'show-phrase';
		} catch (error) {
			logger.error('Failed to issue verification challenge:', error);
			showError(asApiError(error).message || $_('membership_verify_challenge_failed'));
		} finally {
			verifyLoading = false;
		}
	}

	async function handleCopyPhrase() {
		const challenge = verifyChallenge;
		if (!challenge) return;
		try {
			await navigator.clipboard.writeText(challenge.phrase);
			verifyCopied = true;
			if (verifyCopyTimer) clearTimeout(verifyCopyTimer);
			verifyCopyTimer = setTimeout(() => {
				verifyCopied = false;
			}, 1500);
		} catch (error) {
			logger.error('Failed to copy verification phrase:', error);
		}
	}

	async function handleVerify() {
		const challenge = verifyChallenge;
		if (!challenge) return;
		verifyConfirming = true;
		try {
			await confirmVerification(challenge.robloxUserId);
			showVerifyModal = false;
			showSuccess($_('membership_toast_verified'));
		} catch (error) {
			logger.error('Verification failed:', error);
			applyVerifyError(error);
		} finally {
			verifyConfirming = false;
		}
	}

	// Branches on backend error codes to either retry inline, fall through to the fatal step, or close the modal entirely
	function applyVerifyError(error: unknown) {
		const err = asApiError(error);
		const details = err.details;
		const detailCode = typeof details?.['code'] === 'string' ? details['code'] : undefined;

		if (err.code === 'VALIDATION_ERROR' && detailCode === 'VERIFICATION_PHRASE_NOT_FOUND') {
			const echoedPhrase = details?.['phrase'];
			if (verifyChallenge && typeof echoedPhrase === 'string' && echoedPhrase.length > 0) {
				verifyChallenge = { ...verifyChallenge, phrase: echoedPhrase };
			}
			verifyError = { kind: 'warning', message: $_('membership_verify_phrase_not_found') };
			return;
		}
		if (err.code === 'VALIDATION_ERROR' && detailCode === 'ROBLOX_USER_BANNED') {
			verifyFatalMessage = $_('membership_verify_user_banned');
			verifyStep = 'fatal';
			return;
		}
		if (err.code === 'NOT_FOUND') {
			verifyFatalMessage = $_('membership_verify_user_not_found');
			verifyStep = 'fatal';
			return;
		}
		if (err.code === 'ROBLOX_API_UNAVAILABLE') {
			verifyError = { kind: 'muted', message: $_('membership_verify_roblox_unavailable') };
			return;
		}
		if (err.status === 401 || err.status === 403) {
			showVerifyModal = false;
			showError(err.message || $_('membership_verify_challenge_failed'));
			return;
		}
		verifyFatalMessage = err.message || $_('membership_verify_challenge_failed');
		verifyStep = 'fatal';
	}

	function handleVerifyBack() {
		verifyStep = 'enter-id';
		verifyChallenge = null;
		verifyError = null;
		verifyFatalMessage = null;
	}

	// Design fields are preserved and only the assignment is cleared
	async function handleRemove() {
		clearing = true;
		try {
			await clearBadge();
			showRemoveModal = false;
			showSuccess($_('membership_toast_removed'));
		} catch (error) {
			logger.error('Failed to clear member badge:', error);
			showError(asApiError(error).message || $_('membership_toast_remove_failed'));
		} finally {
			clearing = false;
		}
	}

	function toggleKeyVisibility() {
		apiKeyVisible = !apiKeyVisible;
	}

	async function applyDesign(axis: DesignAxis, index: number) {
		if (pendingAxis) return;
		if (!memberStatus) return;
		if (!TIER_ALLOWLIST[axis][tier].includes(index)) return;
		if (index === axisCurrent[axis]) return;

		pendingAxis = axis;
		try {
			await updateBadge({ [AXIS_PAYLOAD_KEY[axis]]: index });
			showSuccess($_('membership_designs_updated'));
		} catch (error) {
			logger.error('Failed to update membership design:', error);
			showError($_('membership_designs_update_failed'));
		} finally {
			pendingAxis = null;
		}
	}
</script>

<div class="membership-page">
	<header class="custom-api-page-header">
		<h2 class="custom-api-title">{$_('membership_page_title')}</h2>
		<p class="custom-api-subtitle">{$_('membership_page_subtitle')}</p>
	</header>

	<section class="membership-section">
		<h3 class="membership-section-title">{$_('membership_api_key_title')}</h3>
		<p class="membership-section-description">{$_('membership_api_key_description')}</p>
		<div class="membership-key-row">
			<input
				class="membership-key-input"
				aria-label={$_('membership_api_key_title')}
				autocomplete="off"
				placeholder={$_('membership_api_key_placeholder')}
				spellcheck="false"
				type={apiKeyVisible ? 'text' : 'password'}
				bind:value={apiKeyDraft}
			/>
			<button
				class="membership-key-icon-button"
				aria-label={apiKeyVisible ? $_('membership_api_key_hide') : $_('membership_api_key_show')}
				onclick={toggleKeyVisibility}
				title={apiKeyVisible ? $_('membership_api_key_hide') : $_('membership_api_key_show')}
				type="button"
			>
				{#if apiKeyVisible}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
			</button>
			<button
				class="membership-primary-button"
				disabled={!keyDirty || savingKey}
				onclick={handleSaveKey}
				type="button"
			>
				{#if savingKey}<LoadingSpinner size="small" />{:else}{$_('membership_api_key_save')}{/if}
			</button>
		</div>

		{#if !memberStatus}
			<div class="membership-status-line">
				{#if $membershipLoading}
					<LoadingSpinner size="small" />
					<span>{$_('membership_status_checking')}</span>
				{:else if membershipState.kind === 'not-member'}
					<CircleAlert class="membership-status-icon-warn" size={14} />
					<span>{$_('membership_status_not_member')}</span>
				{:else if membershipState.kind === 'invalid-key'}
					<CircleAlert class="membership-status-icon-error" size={14} />
					<span>{$_('membership_status_invalid_key')}</span>
				{/if}
			</div>
		{/if}
	</section>

	{#if memberStatus}
		<section class="membership-hero tier-{tier}">
			<div class="membership-hero-eyebrow">
				{$_('membership_section_eyebrow', { values: { tier } })}
			</div>
			<div class="membership-hero-name">
				<span class="membership-hero-glyph">◆</span>
				{memberStatus.tierName}
			</div>
			<dl class="membership-perks-list">
				<div class="membership-perk-row">
					<dt>{$_('membership_perks_rate')}</dt>
					<dd>{memberStatus.rateLimit}</dd>
				</div>
				<div class="membership-perk-row">
					<dt>{$_('membership_perks_queue')}</dt>
					<dd>{memberStatus.queueLimit}</dd>
				</div>
				<div class="membership-perk-row">
					<dt>{$_('membership_perks_outfit')}</dt>
					<dd>{memberStatus.outfitLimit}</dd>
				</div>
			</dl>
		</section>
	{/if}

	{#if memberStatus}
		<section class="membership-section">
			<h3 class="membership-section-title">{$_('membership_assignment_title')}</h3>
			<p class="membership-section-description">{$_('membership_assignment_description')}</p>

			{#if hasAssignment}
				<div class="membership-assignment-card">
					<div class="membership-assignment-avatar">
						{#if avatarInfo?.thumbnailUrl}
							<img alt="" src={avatarInfo.thumbnailUrl} />
						{:else}
							<div class="membership-assignment-avatar-placeholder"></div>
						{/if}
					</div>
					<div class="membership-assignment-info">
						<div class="membership-assignment-name">
							{#if avatarLoading}
								{$_('membership_assignment_loading_name')}
							{:else if avatarInfo}
								@{avatarInfo.username}
							{:else}
								{$_('membership_assignment_unknown_name')}
							{/if}
						</div>
						<div class="membership-assignment-id">ID: {associatedUserId}</div>
					</div>
					<div class="membership-assignment-actions">
						<button class="membership-action-button" onclick={openVerifyModal} type="button">
							{$_('membership_change')}
						</button>
						<button
							class="membership-action-button danger"
							onclick={() => (showRemoveModal = true)}
							type="button"
						>
							{$_('membership_remove')}
						</button>
					</div>
				</div>
			{:else}
				<div class="membership-assignment-empty">
					<p>{$_('membership_assignment_empty')}</p>
					<button class="membership-primary-button" onclick={openVerifyModal} type="button">
						{$_('membership_assign')}
					</button>
				</div>
			{/if}
		</section>
	{/if}

	{#if memberStatus}
		<section class="membership-section">
			<h3 class="membership-section-title">{$_('membership_designs_title')}</h3>
			<p class="membership-section-description">{$_('membership_designs_description')}</p>

			<div class="membership-design-preview">
				<MembershipPill
					badgeDesign={axisCurrent.badge}
					iconDesign={axisCurrent.icon}
					textDesign={axisCurrent.text}
					{tier}
					tierName={memberStatus.tierName}
				/>
			</div>
			{@render axisRow(
				'badge',
				$_('membership_designs_body_axis'),
				BADGE_DESIGN_KEYS,
				(key) => `swatch-body body-${key}`
			)}
			{@render axisRow(
				'icon',
				$_('membership_designs_icon_axis'),
				ICON_DESIGN_KEYS,
				() => 'swatch-icon',
				iconContent
			)}
			{@render axisRow(
				'text',
				$_('membership_designs_text_axis'),
				TEXT_DESIGN_KEYS,
				() => 'swatch-text',
				textContent
			)}
		</section>
	{/if}

	{#snippet axisRow(
		axis: DesignAxis,
		axisLabel: string,
		keys: readonly string[],
		extraClass: (key: string) => string,
		content?: import('svelte').Snippet<[string]>
	)}
		<div class="membership-design-row">
			<span class="membership-design-axis-label">{axisLabel}</span>
			<div class="membership-design-options">
				{#each keys as key, index (index)}
					{@const locked = !TIER_ALLOWLIST[axis][tier].includes(index)}
					{@const active = index === axisCurrent[axis]}
					{@const unlockTier = indexUnlockTierName(index, axis)}
					<button
						class="membership-swatch {extraClass(key)} tier-{tier}"
						class:active
						class:locked
						aria-pressed={active}
						disabled={locked || pendingAxis !== null}
						onclick={() => applyDesign(axis, index)}
						title={locked && unlockTier
							? $_('membership_designs_locked_hint', { values: { tier: unlockTier } })
							: key}
						type="button"
					>
						{@render content?.(key)}
						{#if locked}
							<span class="membership-design-lock"><Lock size={10} /></span>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/snippet}

	{#snippet iconContent(key: string)}
		<MembershipIcon iconKey={key as IconDesignKey} size={14} />
	{/snippet}

	{#snippet textContent(key: string)}
		{#if memberStatus}
			<span class="membership-pill-label text-{key}">{memberStatus.tierName.toUpperCase()}</span>
		{/if}
	{/snippet}

	<section class="membership-section">
		<h3 class="membership-section-title">{$_('membership_how_title')}</h3>
		<p class="membership-section-description">{$_('membership_how_description')}</p>
		<ol class="membership-steps-list">
			<li>
				{step1Parts[0]}<ExtLink class="membership-inline-link" href={KOFI_URL}
					>{$_('membership_step_1_link')}</ExtLink
				>{step1Parts[1]}
			</li>
			<li>
				{step2Parts[0]}<ExtLink class="membership-inline-link" href={DISCORD_URL}
					>{$_('membership_step_2_link')}</ExtLink
				>{step2Parts[1]}
			</li>
			<li>{$_('membership_step_3')}</li>
			<li>{$_('membership_step_4')}</li>
			<li>{$_('membership_step_5')}</li>
		</ol>
		<div class="membership-cta-row">
			{#each ctaRows as cta (cta.variant)}
				<ExtLink class="membership-cta-button {cta.variant}" href={cta.href}>
					<span>{$_(cta.labelKey)}</span>
					<ExternalLink size={14} />
				</ExtLink>
			{/each}
		</div>
	</section>
</div>

<Modal
	{...verifyStep === 'fatal' ? { status: 'error' as const } : {}}
	onClose={resetVerifyState}
	size="small"
	title={$_('membership_verify_modal_title')}
	bind:isOpen={showVerifyModal}
>
	{#if verifyStep === 'enter-id'}
		<div class="membership-verify-stack">
			<span class="membership-verify-step-eyebrow">
				{$_('membership_verify_step1_eyebrow')}
			</span>
			<p class="modal-paragraph">{$_('membership_verify_step1_body')}</p>
			<div class="membership-modal-field">
				<label class="membership-modal-label" for="membership-verify-user-id">
					{$_('membership_modal_user_id_label')}
				</label>
				<input
					id="membership-verify-user-id"
					class="membership-modal-input"
					autocomplete="off"
					inputmode="numeric"
					placeholder={$_('membership_modal_user_id_placeholder')}
					spellcheck="false"
					type="text"
					bind:value={verifyUserIdInput}
				/>
			</div>
		</div>
	{:else if verifyStep === 'show-phrase' && verifyChallenge}
		<div class="membership-verify-stack">
			<span class="membership-verify-step-eyebrow">
				{$_('membership_verify_step2_eyebrow')}
			</span>
			<p class="modal-paragraph">{$_('membership_verify_step2_intro')}</p>

			<span class="membership-verify-step-eyebrow">
				{$_('membership_verify_phrase_label')}
			</span>
			<div class="membership-verify-phrase">
				<span class="membership-verify-phrase-words">{verifyChallenge.phrase}</span>
				<button
					class="membership-verify-copy-button"
					class:copied={verifyCopied}
					onclick={handleCopyPhrase}
					type="button"
				>
					{#if verifyCopied}<Check size={13} />{$_('membership_verify_copied')}{:else}<Copy
							size={13}
						/>{$_('membership_verify_copy_button')}{/if}
				</button>
			</div>

			{#if verifyError}
				<div
					class="membership-inline-banner"
					class:muted={verifyError.kind === 'muted'}
					class:warning={verifyError.kind === 'warning'}
				>
					{#if verifyError.kind === 'warning'}
						<TriangleAlert class="membership-inline-banner-icon" size={14} />
					{:else}
						<RotateCcw class="membership-inline-banner-icon" size={14} />
					{/if}
					<p class="membership-inline-banner-text">{verifyError.message}</p>
				</div>
			{/if}

			<span class="membership-verify-step-eyebrow">
				{$_('membership_verify_steps_heading')}
			</span>
			<ol class="membership-steps-list">
				<li>{$_('membership_verify_steps_open_profile')}</li>
				<li>{$_('membership_verify_steps_edit')}</li>
				<li>{$_('membership_verify_steps_paste')}</li>
				<li>{$_('membership_verify_steps_return')}</li>
			</ol>
		</div>
	{:else}
		<div class="membership-verify-stack">
			<div class="membership-inline-banner error">
				<CircleX class="membership-inline-banner-icon" size={14} />
				<p class="membership-inline-banner-text">{verifyFatalMessage ?? ''}</p>
			</div>

			{#if verifyChallenge}
				<dl class="membership-verify-recap">
					<dt>{$_('membership_verify_recap_label')}</dt>
					<dd>{verifyChallenge.robloxUserId}</dd>
				</dl>
			{/if}

			<p class="modal-paragraph">{$_('membership_verify_fatal_guidance')}</p>
		</div>
	{/if}

	{#snippet actions()}
		{#if verifyStep === 'enter-id'}
			<button class="modal-button-cancel" onclick={() => (showVerifyModal = false)} type="button">
				{$_('membership_verify_cancel')}
			</button>
			<button
				class="modal-button-primary"
				disabled={verifyLoading || !verifyUserIdInput.trim()}
				onclick={handleStep1Submit}
				type="button"
			>
				{#if verifyLoading}<LoadingSpinner size="small" />{:else}{$_(
						'membership_verify_continue'
					)}{/if}
			</button>
		{:else if verifyStep === 'show-phrase'}
			<button class="modal-button-ghost" onclick={handleVerifyBack} type="button">
				{$_('membership_verify_back')}
			</button>
			<button
				class="modal-button-primary"
				disabled={verifyConfirming}
				onclick={handleVerify}
				type="button"
			>
				{#if verifyConfirming}<LoadingSpinner size="small" />{:else}{$_(
						'membership_verify_submit'
					)}{/if}
			</button>
		{:else}
			<button class="modal-button-cancel" onclick={() => (showVerifyModal = false)} type="button">
				{$_('membership_verify_close')}
			</button>
			<button class="modal-button-primary" onclick={resetVerifyState} type="button">
				{$_('membership_verify_start_over')}
			</button>
		{/if}
	{/snippet}
</Modal>

<Modal
	confirmDanger
	confirmDisabled={clearing}
	confirmText={$_('membership_remove')}
	onCancel={() => (showRemoveModal = false)}
	onClose={() => (showRemoveModal = false)}
	onConfirm={handleRemove}
	size="small"
	status="warning"
	title={$_('membership_modal_remove_title')}
	bind:isOpen={showRemoveModal}
>
	<p class="modal-paragraph">{$_('membership_modal_remove_body')}</p>
</Modal>
