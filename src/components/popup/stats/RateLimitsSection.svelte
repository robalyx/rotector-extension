<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { apiClient } from '@/lib/services/api-client';
	import type { QueueLimitsData } from '@/lib/types/api';
	import { calculatePercentage } from '@/lib/utils/format';
	import { logger } from '@/lib/utils/logger';

	let queueLimits = $state<QueueLimitsData | null>(null);
	let isLoading = $state(true);
	let hasError = $state(false);

	async function loadLimits() {
		isLoading = true;
		hasError = false;
		try {
			queueLimits = await apiClient.getQueueLimits();
		} catch (err) {
			hasError = true;
			logger.error('Failed to load queue limits:', err);
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		void loadLimits();
	});

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
</script>

<section class="rate-limits-section">
	<header class="rate-limits-head">
		<h2 class="popup-section-title">{$_('stats_rate_limits_title')}</h2>
		{#if queueLimits}
			<span class="rate-limits-reset">{resetText}</span>
		{/if}
	</header>

	{#if isLoading}
		<div class="rate-limits-loading">{$_('stats_rate_limits_loading')}</div>
	{:else if hasError}
		<div class="rate-limits-error">{$_('stats_queue_error')}</div>
	{:else if queueLimits}
		<div class="rate-limits-row">
			<div class="rate-limits-label">
				<span>{$_('stats_rate_limits_queue')}</span>
				<span class="rate-limits-count">
					{queueLimits.current_usage} / {queueLimits.limit}
				</span>
			</div>
			<div class="rate-limits-bar">
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
			<div class="rate-limits-bar">
				<div style:width="{outfitPercentage}%" class="rate-limits-bar-fill"></div>
			</div>
		</div>
	{/if}
</section>
