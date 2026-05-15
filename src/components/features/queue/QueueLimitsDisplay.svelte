<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { apiClient } from '@/lib/services/rotector/api-client';
	import { logger } from '@/lib/utils/logging/logger';
	import { calculatePercentage } from '@/lib/utils/format';
	import type { QueueLimitsData } from '@/lib/types/api';

	type HeadingTag = 'h2' | 'h3';

	interface Props {
		titleKey?: string;
		headingTag?: HeadingTag;
		autoLoad?: boolean;
		showRetry?: boolean;
		queueLimits?: QueueLimitsData | null;
		isLoading?: boolean;
		error?: string | null;
	}

	let {
		titleKey = 'stats_rate_limits_title',
		headingTag = 'h2',
		autoLoad = true,
		showRetry = false,
		queueLimits = $bindable(null),
		isLoading = $bindable(true),
		error = $bindable(null)
	}: Props = $props();

	const queuePercentage = $derived(
		queueLimits ? calculatePercentage(queueLimits.current_usage, queueLimits.limit) : 0
	);
	const outfitPercentage = $derived(
		queueLimits
			? calculatePercentage(queueLimits.outfit.current_usage, queueLimits.outfit.limit)
			: 0
	);

	const resetText = $derived.by(() => {
		if (!queueLimits) return '';
		const now = Math.floor(Date.now() / 1000);
		const secondsLeft = queueLimits.reset_time - now;
		if (secondsLeft < 0) return $_('stats_queue_resetting');
		const hours = Math.floor(secondsLeft / 3600);
		const minutes = Math.floor((secondsLeft % 3600) / 60);
		if (hours > 0) {
			return $_('stats_queue_time_hours', {
				values: { 0: hours.toString(), 1: minutes.toString() }
			});
		}
		return $_('stats_queue_time_minutes', { values: { 0: minutes.toString() } });
	});

	async function loadLimits() {
		isLoading = true;
		error = null;
		try {
			queueLimits = await apiClient.getQueueLimits();
		} catch (error_) {
			error = $_('stats_queue_error');
			logger.error('Failed to load queue limits:', error_);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		if (autoLoad) void loadLimits();
	});

	export function refresh() {
		return loadLimits();
	}

	export function reset() {
		queueLimits = null;
		isLoading = true;
		error = null;
	}
</script>

<section class="rate-limits-section">
	<header class="rate-limits-head">
		{#if headingTag === 'h3'}
			<h3 class="popup-section-title">{$_(titleKey)}</h3>
		{:else}
			<h2 class="popup-section-title">{$_(titleKey)}</h2>
		{/if}
		{#if queueLimits}
			<span class="rate-limits-reset">{resetText}</span>
		{/if}
	</header>

	{#if isLoading}
		<div class="rate-limits-loading">{$_('stats_queue_loading')}</div>
	{:else if error}
		<div class="rate-limits-error">
			{error}
			{#if showRetry}
				<button class="rate-limits-retry" onclick={() => loadLimits()} type="button">
					{$_('stats_queue_retry')}
				</button>
			{/if}
		</div>
	{:else if queueLimits}
		<div class="rate-limits-row">
			<div class="rate-limits-label">
				<span>{$_('stats_rate_limits_queue')}</span>
				<span class="rate-limits-count">
					{queueLimits.current_usage} / {queueLimits.limit}
				</span>
			</div>
			<div
				class="rate-limits-bar"
				aria-label={$_('stats_queue_aria_progress', {
					values: {
						0: queueLimits.current_usage.toString(),
						1: queueLimits.limit.toString(),
						2: queueLimits.remaining.toString()
					}
				})}
				aria-valuemax="100"
				aria-valuemin="0"
				aria-valuenow={queuePercentage}
				role="progressbar"
			>
				<div style:width="{queuePercentage}%" class="rate-limits-bar-fill"></div>
			</div>
		</div>

		<div class="rate-limits-row">
			<div class="rate-limits-label">
				<span>{$_('stats_rate_limits_outfits')}</span>
				<span class="rate-limits-count">
					{queueLimits.outfit.current_usage} / {queueLimits.outfit.limit}
				</span>
			</div>
			<div
				class="rate-limits-bar"
				aria-label={$_('stats_outfit_aria_progress', {
					values: {
						0: queueLimits.outfit.current_usage.toString(),
						1: queueLimits.outfit.limit.toString(),
						2: queueLimits.outfit.remaining.toString()
					}
				})}
				aria-valuemax="100"
				aria-valuemin="0"
				aria-valuenow={outfitPercentage}
				role="progressbar"
			>
				<div style:width="{outfitPercentage}%" class="rate-limits-bar-fill"></div>
			</div>
		</div>
	{/if}
</section>
