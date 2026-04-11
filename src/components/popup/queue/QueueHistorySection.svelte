<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { flip } from 'svelte/animate';
	import { crossfade } from 'svelte/transition';
	import {
		queueHistory,
		loadQueueHistory,
		removeQueueEntry,
		clearQueueHistory
	} from '@/lib/stores/queue-history';
	import type { QueueHistoryEntry } from '@/lib/types/queue-history';
	import { ListX } from '@lucide/svelte';
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';
	import QueueRow from './QueueRow.svelte';

	let isLoading = $state(true);
	let mounted = $state(false);

	const [send, receive] = crossfade({
		duration: 220,
		fallback() {
			return {
				duration: 160,
				css: (t: number) => `opacity: ${t}; transform: translateY(${(1 - t) * 4}px);`
			};
		}
	});

	const processingEntries = $derived($queueHistory.filter((e) => !e.processed));
	const flaggedEntries = $derived($queueHistory.filter((e) => e.processed && e.flagged));
	const safeEntries = $derived($queueHistory.filter((e) => e.processed && !e.flagged));

	const processedCount = $derived($queueHistory.filter((e) => e.processed).length);
	const pendingCount = $derived(processingEntries.length);

	$effect(() => {
		void loadQueueHistory().finally(() => {
			isLoading = false;
			mounted = true;
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

	function entryTimeText(entry: QueueHistoryEntry): string {
		if (entry.processed && entry.processedAt) {
			return formatTime(entry.processedAt);
		}
		if (entry.processing) {
			return $_('queue_history_processing');
		}
		return formatTime(entry.queuedAt);
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

<section class="queue-section-root">
	<header class="queue-section-header">
		<h2 class="queue-section-title">{$_('queue_history_title')}</h2>
		{#if $queueHistory.length > 0}
			<div class="queue-section-summary">
				<span>
					{$_('queue_history_summary_counts', {
						values: { pending: pendingCount, processed: processedCount }
					})}
				</span>
				<button
					class="queue-section-clear"
					onclick={handleClearAll}
					title={$_('queue_history_clear_all')}
					type="button"
				>
					{$_('queue_history_clear_all')}
				</button>
			</div>
		{/if}
	</header>

	{#if isLoading}
		<div class="queue-loading">
			<LoadingSpinner size="medium" />
			<span>{$_('queue_history_loading')}</span>
		</div>
	{:else if $queueHistory.length === 0}
		<div class="queue-empty">
			<div class="queue-empty-icon">
				<ListX size={28} strokeWidth={1.5} />
			</div>
			<p class="queue-empty-title">{$_('queue_history_empty')}</p>
			<p class="queue-empty-hint">{$_('queue_history_empty_hint')}</p>
		</div>
	{:else}
		<div class="queue-groups">
			{#if processingEntries.length > 0}
				<div class="queue-group">
					<div class="queue-group-label">
						<span>{$_('queue_section_processing')}</span>
						<span class="queue-group-count">{processingEntries.length}</span>
					</div>
					<ul class="queue-list">
						{#each processingEntries as entry (entry.userId)}
							<li
								in:receive={{ key: entry.userId, duration: mounted ? 220 : 0 }}
								out:send={{ key: entry.userId, duration: mounted ? 220 : 0 }}
								animate:flip={{ duration: 220 }}
							>
								<QueueRow
									{entry}
									onRemove={handleRemove}
									onView={openProfile}
									timeText={entryTimeText(entry)}
									variant="processing"
								/>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if flaggedEntries.length > 0}
				<div class="queue-group">
					<div class="queue-group-label">
						<span>{$_('queue_section_flagged')}</span>
						<span class="queue-group-count">{flaggedEntries.length}</span>
					</div>
					<ul class="queue-list">
						{#each flaggedEntries as entry (entry.userId)}
							<li
								in:receive={{ key: entry.userId, duration: mounted ? 220 : 0 }}
								out:send={{ key: entry.userId, duration: mounted ? 220 : 0 }}
								animate:flip={{ duration: 220 }}
							>
								<QueueRow
									{entry}
									onRemove={handleRemove}
									onView={openProfile}
									timeText={entryTimeText(entry)}
									variant="flagged"
								/>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if safeEntries.length > 0}
				<div class="queue-group">
					<div class="queue-group-label">
						<span>{$_('queue_section_safe')}</span>
						<span class="queue-group-count">{safeEntries.length}</span>
					</div>
					<ul class="queue-list">
						{#each safeEntries as entry (entry.userId)}
							<li
								in:receive={{ key: entry.userId, duration: mounted ? 220 : 0 }}
								out:send={{ key: entry.userId, duration: mounted ? 220 : 0 }}
								animate:flip={{ duration: 220 }}
							>
								<QueueRow
									{entry}
									onRemove={handleRemove}
									onView={openProfile}
									timeText={entryTimeText(entry)}
									variant="safe"
								/>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
</section>
