<script lang="ts">
	import { onMount } from 'svelte';
	import type { LeaderboardResponse } from '../../../lib/types/api';
	import { apiClient } from '../../../lib/services/api-client';
	import { authStore } from '../../../lib/stores/auth';
	import { t } from '../../../lib/stores/i18n';
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';
	import { Award, Medal } from 'lucide-svelte';

	let leaderboard = $state<LeaderboardResponse | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let includeAnonymous = $state(true);

	onMount(async () => {
		await loadLeaderboard();
	});

	async function loadLeaderboard() {
		isLoading = true;
		error = null;

		try {
			leaderboard = await apiClient.getLeaderboard(50, includeAnonymous);
		} catch (err) {
			error = err instanceof Error ? err.message : t('warzone_leaderboard_error_load');
		} finally {
			isLoading = false;
		}
	}

	async function toggleAnonymousFilter() {
		includeAnonymous = !includeAnonymous;
		await loadLeaderboard();
	}

	function formatPoints(points: number): string {
		if (points >= 1000) {
			return `${(points / 1000).toFixed(1)}k`;
		}
		return points.toString();
	}

	function isCurrentUser(uuid: string): boolean {
		return $authStore.uuid === uuid;
	}
</script>

{#if isLoading}
	<div class="war-zone-loading">
		<LoadingSpinner />
		<p class="war-zone-loading-text">{t('warzone_leaderboard_loading')}</p>
	</div>
{:else if error}
	<div class="war-zone-error-container">
		<p class="error-message">{error}</p>
		<button class="retry-button" onclick={loadLeaderboard} type="button">
			{t('warzone_common_button_retry')}
		</button>
	</div>
{:else if leaderboard}
	<div class="leaderboard-view">
		<!-- Filter Controls -->
		<div class="leaderboard-controls">
			<label class="anonymous-filter-toggle">
				<input checked={includeAnonymous} onchange={toggleAnonymousFilter} type="checkbox" />
				{t('warzone_leaderboard_filter_anonymous')}
			</label>
		</div>

		<!-- Total Users Count -->
		<div class="leaderboard-stats">
			<span class="total-users">
				{t('warzone_leaderboard_total_hunters', [leaderboard.totalUsers.toLocaleString()])}
			</span>
			{#if leaderboard.userRank !== null}
				<span class="user-rank">
					{t('warzone_leaderboard_your_rank', [leaderboard.userRank.toString()])}
				</span>
			{/if}
		</div>

		<!-- Top 3 Podium -->
		{#if leaderboard.leaderboard.length >= 3}
			<div class="podium-section">
				<h4 class="section-title">{t('warzone_leaderboard_section_top')}</h4>
				<div class="podium">
					<!-- 2nd Place -->
					<div class="podium-position podium-second">
						<div class="podium-rank">2</div>
						<div class="podium-medal"><Medal size={32} /></div>
						<div class="podium-name">{leaderboard.leaderboard[1].displayName}</div>
						<div class="podium-points">{formatPoints(leaderboard.leaderboard[1].totalPoints)}</div>
					</div>
					<!-- 1st Place -->
					<div class="podium-position podium-first">
						<div class="podium-rank">1</div>
						<div class="podium-medal"><Award size={32} /></div>
						<div class="podium-name">{leaderboard.leaderboard[0].displayName}</div>
						<div class="podium-points">{formatPoints(leaderboard.leaderboard[0].totalPoints)}</div>
					</div>
					<!-- 3rd Place -->
					<div class="podium-position podium-third">
						<div class="podium-rank">3</div>
						<div class="podium-medal"><Medal size={32} /></div>
						<div class="podium-name">{leaderboard.leaderboard[2].displayName}</div>
						<div class="podium-points">{formatPoints(leaderboard.leaderboard[2].totalPoints)}</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Full Leaderboard List -->
		<div class="leaderboard-list-section">
			<h4 class="section-title">{t('warzone_leaderboard_section_rankings')}</h4>
			<div class="leaderboard-list">
				{#each leaderboard.leaderboard as entry (entry.uuid)}
					<div
						class="leaderboard-entry"
						class:current-user={isCurrentUser(entry.uuid)}
						class:top-three={entry.rank <= 3}
					>
						<div class="entry-rank">
							{#if entry.rank === 1}
								<span class="rank-medal"><Award size={20} /></span>
							{:else if entry.rank === 2}
								<span class="rank-medal"><Medal size={20} /></span>
							{:else if entry.rank === 3}
								<span class="rank-medal"><Medal size={20} /></span>
							{:else}
								<span class="rank-number">#{entry.rank}</span>
							{/if}
						</div>
						<div class="entry-info">
							<div class="entry-name">
								{entry.displayName}
								{#if isCurrentUser(entry.uuid)}
									<span class="you-badge">{t('warzone_leaderboard_badge_you')}</span>
								{/if}
							</div>
							<div class="entry-stats">
								<span class="entry-stat">
									{t('warzone_leaderboard_stat_reports', [entry.totalReports.toString()])}
								</span>
								<span class="entry-stat">
									{t('warzone_leaderboard_stat_success', [entry.successRate.toFixed(1)])}
								</span>
							</div>
						</div>
						<div class="entry-points">
							{formatPoints(entry.totalPoints)}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
