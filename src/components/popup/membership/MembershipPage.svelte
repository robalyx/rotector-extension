<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { CircleAlert, ExternalLink, Eye, EyeOff, Lock } from '@lucide/svelte';
	import type {
		CurrentAvatarInfo,
		MembershipBadgeUpdatePayload,
		MembershipStatus,
		MembershipTier
	} from '@/lib/types/api';
	import { settings, updateSetting } from '@/lib/stores/settings';
	import { SETTINGS_KEYS } from '@/lib/types/settings';
	import {
		clearBadge,
		loadMembershipStatus,
		membershipLoading,
		membershipStore,
		updateBadge
	} from '@/lib/stores/membership';
	import { robloxApiService } from '@/lib/services/roblox-api-service';
	import { showError, showSuccess } from '@/lib/stores/toast';
	import { logger } from '@/lib/utils/logger';
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';
	import Modal from '../../ui/Modal.svelte';
	import MembershipIcon from '../../features/MembershipIcon.svelte';
	import MembershipPill from '../../features/MembershipPill.svelte';
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

	const KOFI_URL = 'https://ko-fi.com/jaxron';
	const DISCORD_URL = 'https://discord.gg/rotector';
	const AXIS_PAYLOAD_KEY: Readonly<Record<DesignAxis, keyof MembershipBadgeUpdatePayload>> = {
		badge: 'badgeDesign',
		icon: 'iconDesign',
		text: 'textDesign'
	};

	// Seeded once; further settings updates don't clobber in-progress edits
	let apiKeyDraft = $state<string>(get(settings)[SETTINGS_KEYS.API_KEY]);
	let apiKeyVisible = $state(false);
	let savingKey = $state(false);
	let avatarInfo = $state<CurrentAvatarInfo | null>(null);
	let avatarLoading = $state(false);
	let showAssignModal = $state(false);
	let showRemoveModal = $state(false);
	let assignUserIdInput = $state('');
	let assigning = $state(false);
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
	const isMember = $derived(membershipState.kind === 'member');
	const memberStatus = $derived<MembershipStatus | null>(
		membershipState.kind === 'member' ? membershipState.status : null
	);
	const associatedUserId = $derived(memberStatus?.associatedRobloxUserId ?? 0);
	const hasAssignment = $derived(associatedUserId > 0);
	const tier = $derived<MembershipTier>(memberStatus?.tier ?? 1);
	const axisCurrent = $derived<Record<DesignAxis, number>>({
		badge: memberStatus ? resolveDesignIndex(memberStatus.badgeDesign, tier, 'badge') : 0,
		icon: memberStatus ? resolveDesignIndex(memberStatus.iconDesign, tier, 'icon') : 0,
		text: memberStatus ? resolveDesignIndex(memberStatus.textDesign, tier, 'text') : 0
	});

	$effect(() => {
		void loadMembershipStatus();
	});

	$effect(() => {
		if (!isMember || !hasAssignment) {
			avatarInfo = null;
			return;
		}
		const userId = associatedUserId;
		avatarLoading = true;
		avatarInfo = null;
		void robloxApiService
			.getCurrentAvatarInfo(userId)
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

	// Persist the API key draft, no-op if unchanged
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

	// Open the assign/change modal, prefilling with the current Roblox user ID if one exists
	function openAssignModal() {
		assignUserIdInput = hasAssignment ? String(associatedUserId) : '';
		showAssignModal = true;
	}

	// Validate and submit the Roblox user ID input
	async function handleAssign() {
		// Reject non-digits and leading zeros; parseInt would silently truncate "123abc" and accept "0".
		const trimmed = assignUserIdInput.trim();
		if (!/^[1-9]\d*$/.test(trimmed)) {
			showError($_('membership_toast_invalid_user_id'));
			return;
		}
		const parsed = Number(trimmed);
		if (parsed === associatedUserId) {
			showAssignModal = false;
			return;
		}
		assigning = true;
		try {
			await updateBadge({ robloxUserId: parsed });
			showAssignModal = false;
			showSuccess($_('membership_toast_assigned'));
		} catch (error) {
			logger.error('Failed to assign member badge:', error);
			const message = error instanceof Error ? error.message : $_('membership_toast_assign_failed');
			showError(message);
		} finally {
			assigning = false;
		}
	}

	// Clear the Roblox user assignment, leaving design fields intact
	async function handleRemove() {
		clearing = true;
		try {
			await clearBadge();
			showRemoveModal = false;
			showSuccess($_('membership_toast_removed'));
		} catch (error) {
			logger.error('Failed to clear member badge:', error);
			const message = error instanceof Error ? error.message : $_('membership_toast_remove_failed');
			showError(message);
		} finally {
			clearing = false;
		}
	}

	function toggleKeyVisibility() {
		apiKeyVisible = !apiKeyVisible;
	}

	// Apply a single-axis design change; the returned status replaces store state optimistically
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
	<!-- Page header -->
	<header class="custom-api-page-header">
		<h2 class="custom-api-title">{$_('membership_page_title')}</h2>
		<p class="custom-api-subtitle">{$_('membership_page_subtitle')}</p>
	</header>

	<!-- API key -->
	<section class="membership-section">
		<h3 class="membership-section-title">{$_('membership_api_key_title')}</h3>
		<p class="membership-section-description">{$_('membership_api_key_description')}</p>
		<div class="membership-key-row">
			<input
				class="membership-key-input"
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
				{#if apiKeyVisible}
					<EyeOff size={14} />
				{:else}
					<Eye size={14} />
				{/if}
			</button>
			<button
				class="membership-primary-button"
				disabled={!keyDirty || savingKey}
				onclick={handleSaveKey}
				type="button"
			>
				{#if savingKey}
					<LoadingSpinner size="small" />
				{:else}
					{$_('membership_api_key_save')}
				{/if}
			</button>
		</div>

		<!-- Verified state -->
		{#if !isMember}
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

	<!-- Tier + perks -->
	{#if isMember && memberStatus}
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

	<!-- Badge assignment -->
	{#if isMember && memberStatus}
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
						<button class="membership-action-button" onclick={openAssignModal} type="button">
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
					<button class="membership-primary-button" onclick={openAssignModal} type="button">
						{$_('membership_assign')}
					</button>
				</div>
			{/if}
		</section>
	{/if}

	<!-- Design picker -->
	{#if isMember && memberStatus}
		<section class="membership-section">
			<h3 class="membership-section-title">{$_('membership_designs_title')}</h3>
			<p class="membership-section-description">{$_('membership_designs_description')}</p>

			<!-- Live combined preview -->
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

	<!-- How to become a member -->
	<section class="membership-section">
		<h3 class="membership-section-title">{$_('membership_how_title')}</h3>
		<p class="membership-section-description">{$_('membership_how_description')}</p>
		<ol class="membership-steps-list">
			<li>
				{step1Parts[0]}<a
					class="membership-inline-link"
					href={KOFI_URL}
					rel="noopener noreferrer"
					target="_blank">{$_('membership_step_1_link')}</a
				>{step1Parts[1]}
			</li>
			<li>
				{step2Parts[0]}<a
					class="membership-inline-link"
					href={DISCORD_URL}
					rel="noopener noreferrer"
					target="_blank">{$_('membership_step_2_link')}</a
				>{step2Parts[1]}
			</li>
			<li>{$_('membership_step_3')}</li>
			<li>{$_('membership_step_4')}</li>
			<li>{$_('membership_step_5')}</li>
		</ol>
		<div class="membership-cta-row">
			<a
				class="membership-cta-button kofi"
				href={KOFI_URL}
				rel="noopener noreferrer"
				target="_blank"
			>
				<span>{$_('membership_cta_kofi')}</span>
				<ExternalLink size={14} />
			</a>
			<a
				class="membership-cta-button discord"
				href={DISCORD_URL}
				rel="noopener noreferrer"
				target="_blank"
			>
				<span>{$_('membership_cta_discord')}</span>
				<ExternalLink size={14} />
			</a>
		</div>
	</section>
</div>

<!-- Assign / Change modal -->
<Modal
	confirmDisabled={assigning || !assignUserIdInput.trim()}
	confirmText={hasAssignment ? $_('membership_change') : $_('membership_assign')}
	onCancel={() => (showAssignModal = false)}
	onClose={() => (showAssignModal = false)}
	onConfirm={handleAssign}
	size="small"
	title={hasAssignment ? $_('membership_modal_change_title') : $_('membership_modal_assign_title')}
	bind:isOpen={showAssignModal}
>
	<p class="modal-paragraph">
		{hasAssignment ? $_('membership_modal_change_body') : $_('membership_modal_assign_body')}
	</p>
	<div class="membership-modal-field">
		<label class="membership-modal-label" for="membership-assign-user-id">
			{$_('membership_modal_user_id_label')}
		</label>
		<input
			id="membership-assign-user-id"
			class="membership-modal-input"
			autocomplete="off"
			inputmode="numeric"
			placeholder={$_('membership_modal_user_id_placeholder')}
			spellcheck="false"
			type="text"
			bind:value={assignUserIdInput}
		/>
	</div>
</Modal>

<!-- Remove confirmation modal -->
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
