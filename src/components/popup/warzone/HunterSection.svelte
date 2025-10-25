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
		const confirmed = confirm(
			'Are you sure you want to logout?\n\n' +
				'You can login again anytime using your Discord account.'
		);

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
	<h3 class="hunter-title">War Zone Hunter</h3>

	{#if $authStore.isLoading}
		<div class="hunter-loading">
			<LoadingSpinner />
			<p class="loading-text">Connecting...</p>
		</div>
	{:else if !$authStore.isAuthenticated}
		<div class="hunter-signup">
			<p class="hunter-description">
				Join the community to report high-risk confirmed users. Work together with hunters worldwide
				to increase takedown success and make Roblox safer for everyone.
			</p>

			<ul class="hunter-features">
				<li>Report high-risk confirmed users</li>
				<li>Help clean up the platform and remove bad actors</li>
				<li>Work with the community for higher takedown success</li>
				<li>Earn points and climb the leaderboard</li>
			</ul>

			<!-- Beta Notice -->
			<div class="beta-notice">
				<strong>Closed Beta:</strong> Only available to selected users. Join our
				<a href="https://discord.gg/2Cn7kXqqhY" rel="noopener noreferrer" target="_blank"
					>Discord server</a
				> for updates.
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
						Connecting...
					{:else}
						Login with Discord
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
					<span class="stat-label">Points</span>
				</div>
				<div class="stat-item">
					<span class="stat-value">{$authStore.profile.isAnonymous ? 'Anonymous' : 'Public'}</span>
					<span class="stat-label">Status</span>
				</div>
			</div>

			<div class="hunter-discord-info">
				{#if $authStore.profile.discordAvatar && $authStore.profile.discordUserId}
					<img
						class="discord-avatar"
						alt="Discord Avatar"
						src={`https://cdn.discordapp.com/avatars/${$authStore.profile.discordUserId}/${$authStore.profile.discordAvatar}.png?size=32`}
					/>
				{/if}
				<span class="discord-username">{$authStore.profile.discordUsername}</span>
			</div>

			<p class="hunter-welcome">
				Welcome, Hunter! You can now participate in War Zone activities and help protect the Roblox
				community. Visit the Roblox homepage to start your hunting missions.
			</p>

			<button class="hunter-logout-button" onclick={handleLogout} type="button"> Logout </button>
		</div>
	{/if}
</div>
