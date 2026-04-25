<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { apiClient } from '@/lib/services/api-client';
	import { logger } from '@/lib/utils/logger';
	import { calculatePercentage } from '@/lib/utils/format';
	import type { QueueLimitsData } from '@/lib/types/api';

	interface Props {
		autoLoad?: boolean;
	}

	let { autoLoad = true }: Props = $props();

	// Queue limits state
	let queueLimits = $state<QueueLimitsData | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	// Calculate usage percentage
	const queuePercentage = $derived(
		queueLimits ? calculatePercentage(queueLimits.current_usage, queueLimits.limit) : 0
	);

	// Calculate outfit usage percentage
	const outfitPercentage = $derived(
		queueLimits
			? calculatePercentage(queueLimits.outfit.current_usage, queueLimits.outfit.limit)
			: 0
	);

	// Calculate time until reset
	const resetText = $derived.by(() => {
		if (!queueLimits) return '';

		const now = Math.floor(Date.now() / 1000);
		const secondsLeft = queueLimits.reset_time - now;

		if (secondsLeft < 0) return $_('stats_queue_resetting');

		const hoursLeft = Math.floor(secondsLeft / 3600);
		const minutesLeft = Math.floor((secondsLeft % 3600) / 60);

		if (hoursLeft > 0) {
			return $_('stats_queue_time_hours', {
				values: { 0: hoursLeft.toString(), 1: minutesLeft.toString() }
			});
		}
		return $_('stats_queue_time_minutes', { values: { 0: minutesLeft.toString() } });
	});

	// Load queue limits
	async function loadQueueLimits() {
		isLoading = true;
		error = null;

		try {
			queueLimits = await apiClient.getQueueLimits();
		} catch (err) {
			error = $_('stats_queue_error');
			logger.error('Failed to load queue limits:', err);
		} finally {
			isLoading = false;
		}
	}

	// Expose state for parent components
	export function getState() {
		return { queueLimits, isLoading, error };
	}

	// Expose refresh function for parent components
	export function refresh() {
		return loadQueueLimits();
	}

	// Reset state (for modal close)
	export function reset() {
		queueLimits = null;
		isLoading = true;
		error = null;
	}

	// Load queue limits on mount if autoLoad is enabled
	$effect(() => {
		if (autoLoad) {
			loadQueueLimits().catch((err: unknown) => {
				logger.error('Failed to load queue limits:', err);
			});
		}
	});
</script>

<section class="rate-limits-section">
	<header class="rate-limits-head">
		<h3 class="popup-section-title">{$_('stats_queue_title')}</h3>
		{#if queueLimits}
			<span class="rate-limits-reset">{resetText}</span>
		{/if}
	</header>

	{#if isLoading}
		<div class="rate-limits-loading">{$_('stats_queue_loading')}</div>
	{:else if error}
		<div class="rate-limits-error">
			{error}
			<button class="rate-limits-retry" onclick={() => loadQueueLimits()} type="button">
				{$_('stats_queue_retry')}
			</button>
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
