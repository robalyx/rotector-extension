<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { CircleAlert, Info, LogOut, RotateCw, ShieldOff, Trash2, User } from '@lucide/svelte';
	import type { MeSession } from '@/lib/types/api';
	import { asApiError } from '@/lib/utils/api/api-error';
	import { logger } from '@/lib/utils/logging/logger';
	import { showError, showSuccess, showWarning } from '@/lib/stores/toast';
	import {
		bootstrapRobloxAuth,
		listSessions,
		refreshIdentity,
		refreshProfile,
		revokeSession,
		robloxAuthStore,
		signOut,
		signOutAll,
		updateSettings
	} from '@/lib/stores/roblox-auth';
	import LoadingSpinner from '../../../ui/LoadingSpinner.svelte';
	import Toggle from '../../../ui/Toggle.svelte';
	import UserThumbnail from '../../../ui/UserThumbnail.svelte';
	import VerifyModal from './VerifyModal.svelte';

	const authState = $derived($robloxAuthStore);
	const profile = $derived(authState.kind === 'signed-in' ? authState.profile : null);
	const cachedProfile = $derived(authState.kind === 'signed-in' ? authState.cachedProfile : null);

	let showSignInModal = $state(false);
	let aliasDraft = $state('');
	let showUsernameDraft = $state(true);
	let showThumbnailDraft = $state(true);
	let savingSettings = $state(false);
	let refreshingIdentity = $state(false);
	let signingOut = $state(false);
	let signingOutAll = $state(false);

	let sessions = $state<MeSession[] | null>(null);
	let sessionsLoading = $state(false);
	let revokingId = $state<string | null>(null);

	// Re-seed the draft inputs whenever the backend hands us a freshly-fetched
	// profile. We always replace the profile object atomically, so reading any
	// field re-runs the effect on the next fetch.
	$effect(() => {
		if (!profile) return;
		aliasDraft = profile.alias ?? '';
		showUsernameDraft = profile.show_username;
		showThumbnailDraft = profile.show_thumbnail;
	});

	$effect(() => {
		void (async () => {
			await bootstrapRobloxAuth();
			if ($robloxAuthStore.kind === 'signed-in') {
				await loadSessions();
			}
		})();
	});

	async function loadSessions() {
		sessionsLoading = true;
		try {
			sessions = await listSessions();
		} catch (error) {
			logger.error('Failed to list sessions:', error);
			sessions = null;
		} finally {
			sessionsLoading = false;
		}
	}

	function aliasChanged(): boolean {
		const current = profile?.alias ?? '';
		return aliasDraft.trim() !== current.trim();
	}

	function settingsDirty(): boolean {
		if (!profile) return false;
		return (
			aliasChanged() ||
			showUsernameDraft !== profile.show_username ||
			showThumbnailDraft !== profile.show_thumbnail
		);
	}

	const dirty = $derived(settingsDirty());

	async function handleSaveSettings() {
		if (!profile || savingSettings || !dirty) return;
		savingSettings = true;
		try {
			const trimmedAlias = aliasDraft.trim();
			const aliasValue: string | null = trimmedAlias.length === 0 ? null : trimmedAlias;
			await updateSettings({
				...(aliasChanged() && { alias: aliasValue }),
				...(showUsernameDraft !== profile.show_username && { show_username: showUsernameDraft }),
				...(showThumbnailDraft !== profile.show_thumbnail && { show_thumbnail: showThumbnailDraft })
			});
			showSuccess($_('roblox_account_settings_saved'));
		} catch (error) {
			const err = asApiError(error);
			showError(err.message || $_('roblox_account_settings_save_failed'));
		} finally {
			savingSettings = false;
		}
	}

	async function handleRefreshIdentity() {
		if (refreshingIdentity) return;
		refreshingIdentity = true;
		try {
			const result = await refreshIdentity();
			if (result && !result.thumbnail_url) {
				showWarning($_('roblox_account_avatar_pending_toast'));
			} else {
				showSuccess($_('roblox_account_refreshed'));
			}
		} catch (error) {
			const err = asApiError(error);
			showError(err.message || $_('roblox_account_refresh_failed'));
		} finally {
			refreshingIdentity = false;
		}
	}

	async function handleSignOut() {
		if (signingOut) return;
		signingOut = true;
		try {
			await signOut();
			showSuccess($_('roblox_account_signed_out'));
			sessions = null;
		} finally {
			signingOut = false;
		}
	}

	async function handleSignOutAll() {
		if (signingOutAll) return;
		signingOutAll = true;
		try {
			const count = await signOutAll();
			showSuccess($_('roblox_account_signed_out_all', { values: { count } }));
			sessions = null;
		} catch (error) {
			const err = asApiError(error);
			showError(err.message || $_('roblox_account_sign_out_all_failed'));
		} finally {
			signingOutAll = false;
		}
	}

	async function handleRevokeSession(id: string) {
		if (revokingId !== null) return;
		revokingId = id;
		try {
			await revokeSession(id);
			sessions = (sessions ?? []).filter((s) => s.id !== id);
			showSuccess($_('roblox_account_session_revoked'));
		} catch (error) {
			showError(asApiError(error).message || $_('roblox_account_session_revoke_failed'));
		} finally {
			revokingId = null;
		}
	}

	function formatRelative(ts: number): string {
		const diff = Date.now() / 1000 - ts;
		if (diff < 60) return $_('roblox_account_time_just_now');
		if (diff < 3600)
			return $_('roblox_account_time_minutes', { values: { n: Math.floor(diff / 60) } });
		if (diff < 86400)
			return $_('roblox_account_time_hours', { values: { n: Math.floor(diff / 3600) } });
		return $_('roblox_account_time_days', { values: { n: Math.floor(diff / 86400) } });
	}

	const stats = $derived(profile?.stats ?? null);
	const previewDisplayName = $derived.by(() => {
		if (!profile) return '';
		const trimmedAlias = aliasDraft.trim();
		if (trimmedAlias.length > 0) return trimmedAlias;
		if (showUsernameDraft) return profile.username;
		return $_('roblox_account_preview_anonymous');
	});
</script>

<div class="membership-page">
	<header class="custom-api-page-header">
		<h2 class="custom-api-title">{$_('roblox_account_page_title')}</h2>
		<p class="custom-api-subtitle">{$_('roblox_account_page_subtitle')}</p>
	</header>

	{#if authState.kind === 'loading'}
		<div class="membership-status-line">
			<LoadingSpinner size="small" />
			<span>{$_('roblox_account_loading')}</span>
		</div>
	{:else if authState.kind === 'signed-out'}
		<section class="membership-section">
			<h3 class="membership-section-title">{$_('roblox_account_sign_in_title')}</h3>
			<p class="membership-section-description">{$_('roblox_account_sign_in_description')}</p>
			<div class="roblox-account-cta-row">
				<button
					class="membership-primary-button"
					onclick={() => (showSignInModal = true)}
					type="button"
				>
					<User size={14} />
					<span>{$_('roblox_account_sign_in_button')}</span>
				</button>
			</div>
		</section>
	{:else}
		<section class="membership-section">
			<h3 class="membership-section-title">{$_('roblox_account_identity_title')}</h3>
			{#if profile && !profile.thumbnail_url}
				<div class="membership-inline-banner muted">
					<Info class="membership-inline-banner-icon" size={14} />
					<p class="membership-inline-banner-text">
						{$_('roblox_account_avatar_pending_hint')}
					</p>
				</div>
			{/if}
			<div class="membership-assignment-card">
				<div class="membership-assignment-avatar">
					<UserThumbnail src={cachedProfile?.thumbnail_url} />
				</div>
				<div class="membership-assignment-info">
					<div class="membership-assignment-name">
						{cachedProfile?.display_name ?? profile?.display_name ?? ''}
					</div>
					<div class="membership-assignment-id">
						@{cachedProfile?.username ?? profile?.username ?? ''}
						{#if profile}
							·
							{$_('roblox_account_user_id', { values: { id: profile.roblox_user_id } })}
						{/if}
					</div>
				</div>
				<div class="membership-assignment-actions">
					<button
						class="membership-action-button"
						disabled={refreshingIdentity}
						onclick={handleRefreshIdentity}
						type="button"
					>
						{#if refreshingIdentity}<LoadingSpinner size="small" />{:else}<RotateCw
								size={12}
							/>{/if}
						<span>{$_('roblox_account_refresh_button')}</span>
					</button>
					<button
						class="membership-action-button danger"
						disabled={signingOut}
						onclick={handleSignOut}
						type="button"
					>
						{#if signingOut}<LoadingSpinner size="small" />{:else}<LogOut size={12} />{/if}
						<span>{$_('roblox_account_sign_out_button')}</span>
					</button>
				</div>
			</div>
		</section>

		<section class="membership-section">
			<h3 class="membership-section-title">{$_('roblox_account_identity_section_title')}</h3>
			<p class="membership-section-description">
				{$_('roblox_account_identity_section_description')}
			</p>

			{#if !profile}
				<div class="membership-status-line">
					<LoadingSpinner size="small" />
					<span>{$_('roblox_account_loading')}</span>
				</div>
			{:else}
				<div class="roblox-account-field-row">
					<label class="roblox-account-field-label" for="roblox-account-alias">
						{$_('roblox_account_alias_label')}
					</label>
					<input
						id="roblox-account-alias"
						class="membership-modal-input"
						autocomplete="off"
						maxlength={24}
						placeholder={$_('roblox_account_alias_placeholder')}
						spellcheck="false"
						type="text"
						bind:value={aliasDraft}
					/>
					<p class="roblox-account-field-hint">{$_('roblox_account_alias_hint')}</p>
				</div>

				<div class="settings-row">
					<div class="settings-row-label">{$_('roblox_account_show_username_label')}</div>
					<Toggle
						checked={showUsernameDraft}
						onchange={(value: boolean) => (showUsernameDraft = value)}
					/>
				</div>
				<div class="settings-row">
					<div class="settings-row-label">{$_('roblox_account_show_thumbnail_label')}</div>
					<Toggle
						checked={showThumbnailDraft}
						onchange={(value: boolean) => (showThumbnailDraft = value)}
					/>
				</div>

				<div class="roblox-account-preview-row">
					<span class="membership-verify-step-eyebrow">{$_('roblox_account_preview_label')}</span>
					<div class="roblox-account-preview-cell">
						<div class="roblox-account-preview-avatar">
							<UserThumbnail src={showThumbnailDraft ? cachedProfile?.thumbnail_url : null} />
						</div>
						<span class="roblox-account-preview-name">{previewDisplayName}</span>
					</div>
				</div>

				<div class="roblox-account-cta-row">
					<button
						class="membership-primary-button"
						disabled={!dirty || savingSettings}
						onclick={handleSaveSettings}
						type="button"
					>
						{#if savingSettings}<LoadingSpinner size="small" />{:else}{$_(
								'roblox_account_save_button'
							)}{/if}
					</button>
				</div>
			{/if}
		</section>

		{#if stats}
			<section class="membership-section">
				<h3 class="membership-section-title">{$_('roblox_account_credit_title')}</h3>
				<p class="membership-section-description">{$_('roblox_account_credit_description')}</p>
				<div class="roblox-account-totals">
					<div class="totals-band-item">
						<span class="totals-band-value">{stats.total_flags}</span>
						<span class="totals-band-label">{$_('roblox_account_credit_total')}</span>
					</div>
					<div class="totals-band-item">
						<span class="totals-band-value">{stats.today}</span>
						<span class="totals-band-label">{$_('roblox_account_credit_today')}</span>
					</div>
					<div class="totals-band-item">
						<span class="totals-band-value">{stats.week}</span>
						<span class="totals-band-label">{$_('roblox_account_credit_week')}</span>
					</div>
					<div class="totals-band-item">
						<span class="totals-band-value">{stats.month}</span>
						<span class="totals-band-label">{$_('roblox_account_credit_month')}</span>
					</div>
					<div class="totals-band-item">
						<span class="totals-band-value">{stats.year}</span>
						<span class="totals-band-label">{$_('roblox_account_credit_year')}</span>
					</div>
				</div>
				{#if stats.last_flagged_at}
					<p class="roblox-account-field-hint">
						{$_('roblox_account_credit_last_at', {
							values: { when: formatRelative(stats.last_flagged_at) }
						})}
					</p>
				{/if}
			</section>
		{/if}

		<section class="membership-section">
			<h3 class="membership-section-title">{$_('roblox_account_sessions_title')}</h3>
			<p class="membership-section-description">{$_('roblox_account_sessions_description')}</p>

			{#if sessionsLoading}
				<div class="membership-status-line">
					<LoadingSpinner size="small" />
					<span>{$_('roblox_account_sessions_loading')}</span>
				</div>
			{:else if sessions === null}
				<div class="membership-inline-banner warning">
					<CircleAlert class="membership-inline-banner-icon" size={14} />
					<p class="membership-inline-banner-text">
						{$_('roblox_account_sessions_load_failed')}
					</p>
				</div>
			{:else if sessions.length === 0}
				<p class="roblox-account-field-hint">{$_('roblox_account_sessions_empty')}</p>
			{:else}
				<ul class="roblox-account-sessions">
					{#each sessions as session (session.id)}
						<li class="roblox-account-session-row">
							<div class="roblox-account-session-info">
								<span class="roblox-account-session-ua">
									{session.user_agent ?? $_('roblox_account_session_unknown_ua')}
								</span>
								<span class="roblox-account-session-meta">
									{#if session.current}
										<span class="roblox-account-session-current">
											{$_('roblox_account_session_current')}
										</span>
										·
									{/if}
									{$_('roblox_account_session_last_used', {
										values: { when: formatRelative(session.last_used_at) }
									})}
								</span>
							</div>
							{#if !session.current}
								<button
									class="membership-action-button danger"
									disabled={revokingId === session.id}
									onclick={() => handleRevokeSession(session.id)}
									type="button"
								>
									{#if revokingId === session.id}
										<LoadingSpinner size="small" />
									{:else}
										<Trash2 size={12} />
									{/if}
									<span>{$_('roblox_account_session_revoke_button')}</span>
								</button>
							{/if}
						</li>
					{/each}
				</ul>

				{#if sessions.some((s) => !s.current)}
					<div class="roblox-account-cta-row">
						<button
							class="membership-action-button danger"
							disabled={signingOutAll}
							onclick={handleSignOutAll}
							type="button"
						>
							{#if signingOutAll}<LoadingSpinner size="small" />{:else}<ShieldOff size={12} />{/if}
							<span>{$_('roblox_account_sign_out_all_button')}</span>
						</button>
					</div>
				{/if}
			{/if}
		</section>
	{/if}
</div>

<VerifyModal
	onClose={() => {
		showSignInModal = false;
		void (async () => {
			if ($robloxAuthStore.kind === 'signed-in') {
				await refreshProfile().catch(() => undefined);
				await loadSessions();
			}
		})();
	}}
	bind:isOpen={showSignInModal}
/>
