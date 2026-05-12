<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { ChevronRight, Settings as SettingsIcon } from '@lucide/svelte';
	import type { Leaderboard, LeaderboardEntry, LeaderboardWindow } from '@/lib/types/api';
	import { apiClient } from '@/lib/services/rotector/api-client';
	import { asApiError } from '@/lib/utils/api/api-error';
	import { isAbortError } from '@/lib/utils/abort';
	import { createAbortableBatch } from '@/lib/utils/api/abortable-batch';
	import { logger } from '@/lib/utils/logging/logger';
	import { robloxAuthStore } from '@/lib/stores/roblox-auth';
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';
	import UserThumbnail from '../../ui/UserThumbnail.svelte';

	interface Props {
		onOpenAccountPage: () => void;
	}

	let { onOpenAccountPage }: Props = $props();

	const WINDOWS: LeaderboardWindow[] = ['daily', 'weekly', 'monthly', 'yearly', 'all_time'];
	const WINDOW_LABEL_KEY: Record<LeaderboardWindow, string> = {
		daily: 'leaderboard_window_daily',
		weekly: 'leaderboard_window_weekly',
		monthly: 'leaderboard_window_monthly',
		yearly: 'leaderboard_window_yearly',
		all_time: 'leaderboard_window_all_time'
	};
	const PAGE_SIZE = 25;

	let activeWindow = $state<LeaderboardWindow>('daily');
	let entries = $state<LeaderboardEntry[]>([]);
	let viewer = $state<Leaderboard['viewer_rank']>(null);
	let nextCursor = $state<number | null>(null);
	let windowEnd = $state<number | null>(null);

	let loading = $state(false);
	let loadingMore = $state(false);
	let error = $state<string | null>(null);
	let resetsClock = $state('');
	let tickTimer: ReturnType<typeof setInterval> | null = null;

	const batch = createAbortableBatch();

	const authState = $derived($robloxAuthStore);
	const signedIn = $derived(authState.kind === 'signed-in');
	const meDisplayName = $derived.by(() => {
		if (authState.kind !== 'signed-in') return '';
		const alias = authState.profile?.alias ?? authState.cachedProfile?.alias ?? null;
		if (alias && alias.length > 0) return alias;
		const username = authState.profile?.username ?? authState.cachedProfile?.username;
		return username ? `@${username}` : '';
	});
	const meThumbnail = $derived.by(() => {
		if (authState.kind !== 'signed-in') return null;
		return authState.profile?.thumbnail_url ?? authState.cachedProfile?.thumbnail_url ?? null;
	});

	function applyResponse(data: Leaderboard, append: boolean) {
		entries = append ? [...entries, ...data.entries] : data.entries;
		viewer = data.viewer_rank;
		nextCursor = data.next_cursor;
		windowEnd = data.window_end_utc;
		updateClock();
	}

	async function loadInitial(window: LeaderboardWindow) {
		loading = true;
		error = null;
		const signal = batch.nextSignal();
		try {
			const data = await apiClient.getLeaderboard(window, { limit: PAGE_SIZE, cursor: 0, signal });
			if (signal.aborted) return;
			applyResponse(data, false);
		} catch (e) {
			if (isAbortError(e)) return;
			logger.error('Leaderboard fetch failed:', e);
			error = asApiError(e).message || $_('leaderboard_load_failed');
		} finally {
			if (!signal.aborted) loading = false;
		}
	}

	async function loadMore() {
		if (loadingMore || nextCursor === null) return;
		loadingMore = true;
		const fetchWindow = activeWindow;
		try {
			const data = await apiClient.getLeaderboard(fetchWindow, {
				limit: PAGE_SIZE,
				cursor: nextCursor
			});
			if (fetchWindow !== activeWindow) return;
			applyResponse(data, true);
		} catch (e) {
			logger.error('Leaderboard load-more failed:', e);
			error = asApiError(e).message || $_('leaderboard_load_failed');
		} finally {
			loadingMore = false;
		}
	}

	function setWindow(next: LeaderboardWindow) {
		if (next === activeWindow) return;
		activeWindow = next;
		entries = [];
		viewer = null;
		nextCursor = null;
		void loadInitial(next);
	}

	function updateClock() {
		const next = computeResetsClock();
		if (next !== resetsClock) resetsClock = next;
	}

	function computeResetsClock(): string {
		if (windowEnd === null) return '';
		const diff = windowEnd - Math.floor(Date.now() / 1000);
		if (diff <= 0) return $_('leaderboard_resets_now');
		const days = Math.floor(diff / 86400);
		const hours = Math.floor((diff % 86400) / 3600);
		const mins = Math.floor((diff % 3600) / 60);
		if (days > 0) {
			return $_('leaderboard_resets_in_days', { values: { d: days, h: hours } });
		}
		if (hours > 0) {
			return $_('leaderboard_resets_in_hours', { values: { h: hours, m: mins } });
		}
		return $_('leaderboard_resets_in_minutes', { values: { m: mins } });
	}

	$effect(() => {
		void loadInitial(activeWindow);
		tickTimer = setInterval(updateClock, 30_000);
		return () => {
			if (tickTimer) clearInterval(tickTimer);
			batch.abort();
		};
	});

	const meRank = $derived(viewer?.rank ?? null);
	const meFlags = $derived(viewer?.flag_count ?? 0);
	const viewerOnPage = $derived.by(() => {
		if (meRank === null) return false;
		return entries.some((e) => e.rank === meRank);
	});
</script>

<div class="leaderboard-page">
	{#if signedIn}
		<div class="leaderboard-you-bar">
			<div class="leaderboard-you-avatar">
				<UserThumbnail src={meThumbnail} />
			</div>
			<div class="leaderboard-you-info">
				<span class="leaderboard-you-name">{meDisplayName}</span>
				<span class="leaderboard-you-meta">
					{#if meRank !== null}
						{$_('leaderboard_you_rank', { values: { rank: meRank, flags: meFlags } })}
					{:else}
						{$_('leaderboard_you_unranked')}
					{/if}
				</span>
			</div>
			<button
				class="leaderboard-you-gear"
				aria-label={$_('leaderboard_open_account')}
				onclick={onOpenAccountPage}
				title={$_('leaderboard_open_account')}
				type="button"
			>
				<SettingsIcon size={14} />
			</button>
		</div>
	{:else}
		<button class="leaderboard-cta-bar" onclick={onOpenAccountPage} type="button">
			<span class="leaderboard-cta-text">{$_('leaderboard_sign_in_cta')}</span>
			<ChevronRight class="leaderboard-cta-arrow" size={16} />
		</button>
	{/if}

	<div class="popup-divider"></div>

	<section class="popup-section">
		<p class="leaderboard-tagline">{$_('leaderboard_tagline')}</p>

		<div class="leaderboard-window-row" aria-label={$_('leaderboard_window_label')} role="tablist">
			<div class="leaderboard-window-pills">
				{#each WINDOWS as window (window)}
					<button
						class="leaderboard-window-pill"
						class:active={window === activeWindow}
						aria-selected={window === activeWindow}
						onclick={() => setWindow(window)}
						role="tab"
						type="button"
					>
						{$_(WINDOW_LABEL_KEY[window])}
					</button>
				{/each}
			</div>
			{#if resetsClock}
				<span class="leaderboard-resets-clock">{resetsClock}</span>
			{/if}
		</div>

		{#if loading && entries.length === 0}
			<div class="leaderboard-loading">
				<LoadingSpinner size="small" />
				<span>{$_('leaderboard_loading')}</span>
			</div>
		{:else if error && entries.length === 0}
			<div class="leaderboard-empty">{error}</div>
		{:else if entries.length === 0}
			<div class="leaderboard-empty">{$_('leaderboard_empty')}</div>
		{:else}
			<ol class="leaderboard-list">
				{#each entries as entry (entry.rank)}
					<li class="leaderboard-row" class:you={meRank !== null && entry.rank === meRank}>
						<span class="leaderboard-rank">{entry.rank}</span>
						<div class="leaderboard-avatar">
							<UserThumbnail lazy src={entry.thumbnail_url} />
						</div>
						<span class="leaderboard-name">
							{entry.display_name}
							{#if meRank !== null && entry.rank === meRank}
								<span class="leaderboard-you-tag">{$_('leaderboard_you_inline')}</span>
							{/if}
						</span>
						<span class="leaderboard-count">{entry.flag_count}</span>
					</li>
				{/each}
			</ol>

			{#if nextCursor !== null}
				<button
					class="leaderboard-load-more"
					disabled={loadingMore}
					onclick={loadMore}
					type="button"
				>
					{#if loadingMore}<LoadingSpinner size="small" />{:else}{$_('leaderboard_load_more')}{/if}
				</button>
			{/if}

			{#if signedIn && meRank !== null && !viewerOnPage}
				<div class="leaderboard-you-section">
					<span class="popup-section-title">{$_('leaderboard_you_section_title')}</span>
					<div class="leaderboard-row you">
						<span class="leaderboard-rank">{meRank}</span>
						<div class="leaderboard-avatar">
							<UserThumbnail src={meThumbnail} />
						</div>
						<span class="leaderboard-name">
							{meDisplayName}
							<span class="leaderboard-you-tag">{$_('leaderboard_you_inline')}</span>
						</span>
						<span class="leaderboard-count">{meFlags}</span>
					</div>
				</div>
			{/if}
		{/if}
	</section>
</div>
