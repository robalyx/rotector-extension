<script lang="ts">
	import { _ } from 'svelte-i18n';
	import {
		queueHistory,
		loadQueueHistory,
		removeQueueEntry,
		clearQueueHistory
	} from '@/lib/stores/queue-history';
	import {
		ExternalLink,
		Trash2,
		Clock,
		CheckCircle,
		AlertTriangle,
		Loader,
		ListX
	} from 'lucide-svelte';
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';

	let isLoading = $state(true);

	$effect(() => {
		void loadQueueHistory().finally(() => {
			isLoading = false;
		});
	});

	function formatTime(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;

		if (diff < 60000) return $_('queue_history_time_just_now');
		if (diff < 3600000) {
			const mins = Math.floor(diff / 60000);
			return $_('queue_history_time_minutes_ago', { values: { 0: mins } });
		}
		if (diff < 86400000) {
			const hours = Math.floor(diff / 3600000);
			return $_('queue_history_time_hours_ago', { values: { 0: hours } });
		}

		const date = new Date(timestamp);
		return date.toLocaleDateString();
	}

	function openProfile(userId: number): void {
		void browser.tabs.create({ url: `https://www.roblox.com/users/${userId}/profile` });
	}

	function handleRemove(userId: number): void {
		void removeQueueEntry(userId);
	}

	function handleClearAll(): void {
		void clearQueueHistory();
	}
</script>

<div class="queue-history-container">
	<div
		class="
		border-border mb-3 flex items-center justify-between border-b pb-1.5
		dark:border-border-dark
	"
	>
		<h2
			class="
			text-text-heading m-0 flex items-center gap-1.5 text-base font-semibold
			tracking-tight
			dark:text-text-heading-dark
		"
		>
			{$_('queue_history_title')}
		</h2>
		{#if $queueHistory.length > 0}
			<button
				class="queue-history-clear-button"
				onclick={handleClearAll}
				title={$_('queue_history_clear_all')}
				type="button"
			>
				<Trash2 size={12} />
				<span>{$_('queue_history_clear_all')}</span>
			</button>
		{/if}
	</div>

	{#if isLoading}
		<div
			class="
			text-text-subtle flex flex-col items-center gap-3 py-8 text-sm
			dark:text-text-subtle-dark
		"
		>
			<LoadingSpinner size="medium" />
			<span>{$_('queue_history_loading')}</span>
		</div>
	{:else if $queueHistory.length === 0}
		<div class="queue-history-empty">
			<div class="queue-history-empty-icon">
				<ListX size={32} strokeWidth={1.5} />
			</div>
			<p class="queue-history-empty-title">{$_('queue_history_empty')}</p>
			<p class="queue-history-empty-hint">{$_('queue_history_empty_hint')}</p>
		</div>
	{:else}
		<div class="queue-history-list">
			{#each $queueHistory as entry (entry.userId)}
				<div
					class="queue-history-item"
					class:flagged={entry.processed && entry.flagged}
					class:processing={entry.processing}
				>
					<div class="queue-history-item-status">
						{#if entry.processing}
							<Loader class="queue-history-icon-processing" size={16} />
						{:else if entry.processed && entry.flagged}
							<AlertTriangle class="queue-history-icon-flagged" size={16} />
						{:else if entry.processed}
							<CheckCircle class="queue-history-icon-complete" size={16} />
						{:else}
							<Clock class="queue-history-icon-pending" size={16} />
						{/if}
					</div>

					<div class="queue-history-item-info">
						<div class="queue-history-item-user-id">{entry.userId}</div>
						<div class="queue-history-item-time">
							{#if entry.processed && entry.processedAt}
								{$_('queue_history_processed_at', { values: { 0: formatTime(entry.processedAt) } })}
							{:else if entry.processing}
								{$_('queue_history_processing')}
							{:else}
								{$_('queue_history_queued_at', { values: { 0: formatTime(entry.queuedAt) } })}
							{/if}
						</div>
					</div>

					<div class="queue-history-item-result">
						{#if entry.processed}
							<span class="queue-history-result-badge" class:flagged={entry.flagged}>
								{entry.flagged
									? $_('queue_history_result_flagged')
									: $_('queue_history_result_safe')}
							</span>
						{/if}
					</div>

					<div class="queue-history-item-actions">
						<button
							class="queue-history-action-button"
							onclick={() => openProfile(entry.userId)}
							title={$_('queue_history_view_profile')}
							type="button"
						>
							<ExternalLink size={14} />
						</button>
						<button
							class="queue-history-action-button queue-history-action-remove"
							onclick={() => handleRemove(entry.userId)}
							title={$_('queue_history_remove')}
							type="button"
						>
							<Trash2 size={14} />
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
