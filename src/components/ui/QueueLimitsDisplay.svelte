<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { apiClient } from '@/lib/services/api-client';
	import { logger } from '@/lib/utils/logger';
	import type { QueueLimitsData } from '@/lib/types/api';
	import { Key } from 'lucide-svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';

	interface Props {
		variant?: 'popup' | 'modal';
		autoLoad?: boolean;
	}

	let { variant = 'popup', autoLoad = true }: Props = $props();

	// Queue limits state
	let queueLimits = $state<QueueLimitsData | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	// Calculate time until reset
	const timeUntilReset = $derived(() => {
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

	// Calculate usage percentage
	const usagePercentage = $derived(() => {
		if (!queueLimits || queueLimits.limit === 0) return 0;
		const pct = Math.round((queueLimits.current_usage / queueLimits.limit) * 100);
		return Math.max(0, Math.min(100, pct));
	});

	// Load queue limits
	async function loadQueueLimits() {
		isLoading = true;
		error = null;

		try {
			const limits = await apiClient.getQueueLimits();
			queueLimits = limits;
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
			loadQueueLimits().catch((err) => {
				logger.error('Failed to load queue limits:', err);
			});
		}
	});

	// CSS class mappings based on variant
	const classes = $derived({
		container: variant === 'modal' ? 'modal-queue-limits' : 'queue-limits-section',
		title: variant === 'modal' ? 'modal-queue-limits-title' : 'queue-limits-section-title',
		compact: variant === 'modal' ? 'modal-queue-limits-compact' : 'queue-limits-compact',
		usageDisplay: variant === 'modal' ? 'modal-queue-usage-display' : 'queue-usage-display',
		usageLabels: variant === 'modal' ? 'modal-queue-usage-labels' : 'queue-usage-labels',
		usageLabelLeft: variant === 'modal' ? 'modal-queue-usage-label-left' : 'queue-usage-label-left',
		usageLabelRight:
			variant === 'modal' ? 'modal-queue-usage-label-right' : 'queue-usage-label-right',
		usageLabel: variant === 'modal' ? 'modal-queue-usage-label' : 'queue-usage-label',
		usageAmount: variant === 'modal' ? 'modal-queue-usage-amount' : 'queue-usage-amount',
		remainingAmount:
			variant === 'modal' ? 'modal-queue-remaining-amount' : 'queue-remaining-amount',
		progressBar: variant === 'modal' ? 'modal-queue-progress-bar' : 'queue-progress-bar',
		progressFill: variant === 'modal' ? 'modal-queue-progress-fill' : 'queue-progress-fill',
		lowUsage: variant === 'modal' ? 'modal-queue-low-usage' : 'queue-low-usage',
		mediumUsage: variant === 'modal' ? 'modal-queue-medium-usage' : 'queue-medium-usage',
		highUsage: variant === 'modal' ? 'modal-queue-high-usage' : 'queue-high-usage',
		statusInfo: variant === 'modal' ? 'modal-queue-status-info' : 'queue-status-info',
		apiBadge: variant === 'modal' ? 'modal-queue-api-badge' : 'queue-api-key-badge',
		defaultLimits: variant === 'modal' ? 'modal-queue-default-limits' : 'queue-default-limits',
		resetTimer: variant === 'modal' ? 'modal-queue-reset-timer' : 'queue-reset-timer',
		resetLabel: variant === 'modal' ? 'modal-queue-reset-label' : 'queue-reset-label',
		resetTime: variant === 'modal' ? 'modal-queue-reset-time' : 'queue-reset-time'
	});

	// Icon and spinner sizes based on variant
	const iconSize = $derived(variant === 'modal' ? 'size-4' : 'size-3');
	const spinnerSize = $derived(variant === 'modal' ? 'small' : 'medium');
</script>

<div class={classes.container}>
	<h3 class={classes.title}>{$_('stats_queue_title')}</h3>

	{#if isLoading}
		<div
			class="
				text-text-subtle flex items-center justify-center gap-2 text-sm
				dark:text-text-subtle-dark
				{variant === 'modal' ? 'py-3' : 'flex-col gap-3 py-4'}
			"
		>
			<LoadingSpinner size={spinnerSize} />
			<span>{$_('stats_queue_loading')}</span>
		</div>
	{:else if error}
		<div class="{variant === 'modal' ? 'py-3' : 'py-4'} text-center">
			<div class="text-error mb-{variant === 'modal' ? '2' : '3'} text-sm font-medium">
				{$_('stats_queue_error')}
			</div>
			<button
				class="bg-primary
					rounded-md px-{variant === 'modal' ? '3' : '4'} py-{variant === 'modal'
					? '1.5'
					: '2'} text-sm font-medium text-white
					btn-focus
					transition-colors duration-200
					hover:bg-(--color-primary-hover)
				"
				onclick={() => loadQueueLimits()}
				type="button"
			>
				{$_('stats_queue_retry')}
			</button>
		</div>
	{:else if queueLimits}
		<div class={classes.compact}>
			<!-- Usage Display -->
			<div class={classes.usageDisplay}>
				<div class={classes.usageLabels}>
					<div class={classes.usageLabelLeft}>
						<span class={classes.usageLabel}>{$_('stats_queue_usage')}</span>
						<span class={classes.usageAmount}>
							{queueLimits.current_usage} / {queueLimits.limit}
						</span>
					</div>
					<div class={classes.usageLabelRight}>
						<span class={classes.usageLabel}>{$_('stats_queue_remaining')}</span>
						<span class={classes.remainingAmount} class:text-error={queueLimits.remaining === 0}>
							{queueLimits.remaining}
						</span>
					</div>
				</div>

				<!-- Progress Bar -->
				<div
					class={classes.progressBar}
					aria-label={$_('stats_queue_aria_progress', {
						values: {
							0: queueLimits.current_usage.toString(),
							1: queueLimits.limit.toString(),
							2: queueLimits.remaining.toString()
						}
					})}
					aria-valuemax="100"
					aria-valuemin="0"
					aria-valuenow={usagePercentage()}
					role="progressbar"
				>
					<div
						style:width="{usagePercentage()}%"
						class="{classes.progressFill}
							{usagePercentage() < 50 ? classes.lowUsage : ''}
							{usagePercentage() >= 50 && usagePercentage() < 80 ? classes.mediumUsage : ''}
							{usagePercentage() >= 80 ? classes.highUsage : ''}"
					></div>
				</div>
			</div>

			<!-- Status Info -->
			<div class={classes.statusInfo}>
				<!-- API Key Status -->
				{#if queueLimits.has_api_key}
					<div class={classes.apiBadge}>
						<Key class={iconSize} />
						<span>{$_('stats_queue_enhanced')}</span>
					</div>
				{:else}
					<div class="{classes.apiBadge} {classes.defaultLimits}">
						<span>{$_('stats_queue_default')}</span>
					</div>
				{/if}

				<!-- Reset Timer -->
				<div class={classes.resetTimer}>
					<span class={classes.resetLabel}>{$_('stats_queue_resets_in')}</span>
					<span class={classes.resetTime}>{timeUntilReset()}</span>
				</div>
			</div>
		</div>
	{/if}
</div>
