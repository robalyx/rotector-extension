<script lang="ts">
	import { onMount } from 'svelte';
	import {
		authStore,
		handleDiscordAuthComplete,
		initializeAuth,
		initiateDiscordLogin,
		logout
	} from '../../../lib/stores/auth';
	import type { ExtensionUserProfile } from '../../../lib/types/api';
	import { t } from '../../../lib/stores/i18n';
	import { logger } from '../../../lib/utils/logger';
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';

	let isLoggingIn = $state(false);

	onMount(() => {
		// Initialize auth
		initializeAuth().catch((error) => {
			logger.error('Failed to initialize auth:', error);
		});

		// Listen for Discord auth completion
		const handleMessage = (message: {
			type: string;
			uuid?: string;
			user?: ExtensionUserProfile;
			isNewUser?: boolean;
		}) => {
			if (message.type === 'DISCORD_AUTH_COMPLETE' && message.uuid && message.user) {
				handleDiscordAuthComplete(message.uuid, message.user).catch((error) => {
					logger.error('Failed to handle Discord auth completion:', error);
				});
			}
		};

		browser.runtime.onMessage.addListener(handleMessage);

		return () => {
			browser.runtime.onMessage.removeListener(handleMessage);
		};
	});

	async function handleDiscordLogin() {
		isLoggingIn = true;
		try {
			await initiateDiscordLogin();
		} catch (error) {
			logger.error('Discord login failed:', error);
		} finally {
			isLoggingIn = false;
		}
	}

	async function handleLogout() {
		const confirmed = confirm(t('warzone_hunter_confirm_logout'));

		if (!confirmed) return;

		try {
			await logout();
		} catch (error) {
			logger.error('Logout failed:', error);
		}
	}

	function formatPoints(points: number): string {
		if (points >= 1000) {
			return `${(points / 1000).toFixed(1)}k`;
		}
		return points.toString();
	}
</script>

<div class="hunter-section">
	<h3 class="hunter-title">{t('warzone_hunter_title')}</h3>

	{#if $authStore.isLoading}
		<div class="hunter-loading">
			<LoadingSpinner />
			<p class="loading-text">{t('warzone_hunter_loading_connecting')}</p>
		</div>
	{:else if !$authStore.isAuthenticated}
		<div class="hunter-signup">
			<p class="hunter-description">
				{t('warzone_hunter_signup_description')}
			</p>

			<ul class="hunter-features">
				<li>{t('warzone_hunter_feature_report')}</li>
				<li>{t('warzone_hunter_feature_cleanup')}</li>
				<li>{t('warzone_hunter_feature_community')}</li>
				<li>{t('warzone_hunter_feature_leaderboard')}</li>
			</ul>

			<!-- Beta Notice -->
			<div class="beta-notice">
				<strong>{t('warzone_hunter_beta_label')}</strong>
				{t('warzone_hunter_beta_text_before_link')}
				<a href="https://discord.gg/2Cn7kXqqhY" rel="noopener noreferrer" target="_blank"
					>{t('warzone_hunter_beta_discord_link')}</a
				>
				{t('warzone_hunter_beta_text_after_link')}
			</div>

			<div class="hunter-actions">
				<button
					class="hunter-signup-button"
					disabled={isLoggingIn}
					onclick={handleDiscordLogin}
					type="button"
				>
					{#if isLoggingIn}
						<LoadingSpinner size="small" />
						{t('warzone_hunter_loading_connecting')}
					{:else}
						{t('warzone_hunter_button_login')}
					{/if}
				</button>
			</div>

			{#if $authStore.error}
				<div class="hunter-error">
					{$authStore.error}
				</div>
			{/if}
		</div>
	{:else if $authStore.profile}
		<div class="hunter-profile">
			<div class="hunter-stats">
				<div class="stat-item">
					<span class="stat-value">{formatPoints($authStore.profile.totalPoints)}</span>
					<span class="stat-label">{t('warzone_hunter_stat_points')}</span>
				</div>
				<div class="stat-item">
					<span class="stat-value"
						>{$authStore.profile.isAnonymous
							? t('warzone_hunter_status_anonymous')
							: t('warzone_hunter_status_public')}</span
					>
					<span class="stat-label">{t('warzone_hunter_stat_status')}</span>
				</div>
			</div>

			<div class="hunter-discord-info">
				{#if $authStore.profile.discordAvatar && $authStore.profile.discordUserId}
					<img
						class="discord-avatar"
						alt={t('warzone_hunter_discord_avatar_alt')}
						src={`https://cdn.discordapp.com/avatars/${$authStore.profile.discordUserId}/${$authStore.profile.discordAvatar}.png?size=32`}
					/>
				{/if}
				<span class="discord-username">{$authStore.profile.discordUsername}</span>
			</div>

			<p class="hunter-welcome">
				{t('warzone_hunter_welcome_message')}
			</p>

			<button class="hunter-logout-button" onclick={handleLogout} type="button">
				{t('warzone_hunter_button_logout')}
			</button>
		</div>
	{/if}
</div>
