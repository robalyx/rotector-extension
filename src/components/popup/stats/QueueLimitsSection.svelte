<script lang="ts">
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';
	import { apiClient } from '@/lib/services/api-client';
	import type { QueueLimitsData } from '@/lib/types/api';
	import { logger } from '@/lib/utils/logger';
	import { Key } from 'lucide-svelte';

	// Queue limits state
	let queueLimits = $state<QueueLimitsData | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	// Calculate time until reset
	const timeUntilReset = $derived(() => {
		if (!queueLimits) return '';

		const now = Math.floor(Date.now() / 1000);
		const secondsLeft = queueLimits.reset_time - now;

		if (secondsLeft < 0) return 'Resetting...';

		const hoursLeft = Math.floor(secondsLeft / 3600);
		const minutesLeft = Math.floor((secondsLeft % 3600) / 60);

		if (hoursLeft > 0) {
			return `${hoursLeft}h ${minutesLeft}m`;
		}
		return `${minutesLeft}m`;
	});

	// Calculate usage percentage
	const usagePercentage = $derived(() => {
		if (!queueLimits || queueLimits.limit === 0) return 0;
		return Math.round((queueLimits.current_usage / queueLimits.limit) * 100);
	});

	// Load queue limits
	async function loadQueueLimits() {
		isLoading = true;
		error = null;

		try {
			const limits = await apiClient.getQueueLimits();
			queueLimits = limits;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load queue limits';
			logger.error('Failed to load queue limits:', err);
		} finally {
			isLoading = false;
		}
	}

	// Handle retry button click
	async function handleRetry() {
		await loadQueueLimits();
	}

	// Load queue limits on mount
	$effect(() => {
		loadQueueLimits().catch((err) => {
			logger.error('Failed to load queue limits:', err);
		});
	});
</script>

<div class="queue-limits-section">
	<h3 class="queue-limits-section-title">Queue Limits</h3>

	{#if isLoading}
		<div
			class="
            text-text-subtle flex flex-col items-center gap-3 py-4 text-sm
            dark:text-text-subtle-dark
        "
		>
			<LoadingSpinner size="medium" />
			<span>Loading queue limits...</span>
		</div>
	{:else if error}
		<div class="py-4 text-center">
			<div class="text-error mb-3 text-sm font-medium">Failed to load queue limits</div>
			<button
				style:background-color="var(--color-primary)"
				class="
                    rounded-md px-4 py-2 text-sm font-medium text-white
                    btn-focus
                    transition-colors duration-200
                    hover:bg-(--color-primary-hover)
                "
				onclick={handleRetry}
				type="button"
			>
				Retry
			</button>
		</div>
	{:else if queueLimits}
		<div class="queue-limits-compact">
			<!-- Usage Display -->
			<div class="queue-usage-display">
				<div class="queue-usage-labels">
					<div class="queue-usage-label-left">
						<span class="queue-usage-label">Usage</span>
						<span class="queue-usage-amount">
							{queueLimits.current_usage} / {queueLimits.limit}
						</span>
					</div>
					<div class="queue-usage-label-right">
						<span class="queue-usage-label">Remaining</span>
						<span class="queue-remaining-amount">{queueLimits.remaining}</span>
					</div>
				</div>

				<!-- Progress Bar -->
				<div
					class="queue-progress-bar"
					aria-label="{queueLimits.current_usage} of {queueLimits.limit} used, {queueLimits.remaining} remaining"
					aria-valuemax="100"
					aria-valuemin="0"
					aria-valuenow={usagePercentage()}
					role="progressbar"
				>
					<div
						style:width="{usagePercentage()}%"
						class="queue-progress-fill"
						class:queue-high-usage={usagePercentage() >= 80}
						class:queue-low-usage={usagePercentage() < 50}
						class:queue-medium-usage={usagePercentage() >= 50 && usagePercentage() < 80}
					></div>
				</div>
			</div>

			<!-- Status Info -->
			<div class="queue-status-info">
				<!-- API Key Status -->
				{#if queueLimits.has_api_key}
					<div class="queue-api-key-badge">
						<Key class="size-3" />
						<span>Enhanced Limits Active</span>
					</div>
				{:else}
					<div class="queue-api-key-badge queue-default-limits">
						<span>Default Limits</span>
					</div>
				{/if}

				<!-- Reset Timer -->
				<div class="queue-reset-timer">
					<span class="queue-reset-label">Resets in</span>
					<span class="queue-reset-time">{timeUntilReset()}</span>
				</div>
			</div>
		</div>
	{/if}
</div>
