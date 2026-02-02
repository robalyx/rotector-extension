<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowLeft, Copy, Trash2, AlertCircle, AlertTriangle, Check } from 'lucide-svelte';
	import {
		developerLogs,
		errorLogs,
		warningLogs,
		loadDeveloperLogs,
		clearDeveloperLogs,
		exportLogs,
		formatLogsForCopy
	} from '@/lib/stores/developer-logs';
	import { LOG_LEVELS } from '@/lib/types/developer-logs';
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';
	import { _ } from 'svelte-i18n';

	interface Props {
		onBack: () => void;
	}

	let { onBack }: Props = $props();

	type FilterType = 'all' | 'error' | 'warn';
	let activeFilter = $state<FilterType>('all');
	let isLoading = $state(true);
	let showCopyToast = $state(false);
	let expandedLogId = $state<string | null>(null);

	// Filtered logs based on active filter
	const filteredLogs = $derived.by(() => {
		if (activeFilter === 'error') return $errorLogs;
		if (activeFilter === 'warn') return $warningLogs;
		return $developerLogs;
	});

	// Format timestamp for display
	function formatTime(timestamp: number): string {
		return new Date(timestamp).toISOString().slice(11, 23);
	}

	// Get level badge class
	function getLevelClass(level: string): string {
		switch (level) {
			case LOG_LEVELS.ERROR:
				return 'log-level-error';
			case LOG_LEVELS.WARN:
				return 'log-level-warn';
			case LOG_LEVELS.INFO:
				return 'log-level-info';
			case LOG_LEVELS.DEBUG:
				return 'log-level-debug';
			case LOG_LEVELS.ACTION:
				return 'log-level-action';
			case LOG_LEVELS.API:
				return 'log-level-api';
			default:
				return 'log-level-debug';
		}
	}

	// Copy all logs to clipboard
	async function handleCopy() {
		try {
			const exportData = await exportLogs();
			const text = formatLogsForCopy(exportData);
			await navigator.clipboard.writeText(text);
			showCopyToast = true;
			setTimeout(() => {
				showCopyToast = false;
			}, 2000);
		} catch (error) {
			console.error('Failed to copy logs:', error);
		}
	}

	// Clear all logs
	async function handleClear() {
		if (confirm($_('developer_logs_clear_confirm'))) {
			await clearDeveloperLogs();
		}
	}

	// Toggle log data expansion
	function toggleExpand(logId: string) {
		expandedLogId = expandedLogId === logId ? null : logId;
	}

	onMount(() => {
		void loadDeveloperLogs().finally(() => {
			isLoading = false;
		});
	});
</script>

<div class="developer-logs-container">
	<!-- Header -->
	<div class="developer-logs-header">
		<button class="developer-logs-back-button" onclick={onBack} type="button">
			<ArrowLeft size={16} />
			<span>{$_('developer_logs_back')}</span>
		</button>
		<div class="developer-logs-actions">
			<button
				class="developer-logs-action-button"
				disabled={$developerLogs.length === 0}
				onclick={handleCopy}
				title={$_('developer_logs_copy_button')}
				type="button"
			>
				<Copy size={14} />
			</button>
			<button
				class="developer-logs-action-button developer-logs-action-danger"
				disabled={$developerLogs.length === 0}
				onclick={handleClear}
				title={$_('developer_logs_clear_button')}
				type="button"
			>
				<Trash2 size={14} />
			</button>
		</div>
	</div>

	<!-- Title -->
	<h2 class="developer-logs-title">{$_('developer_logs_title')}</h2>

	<!-- Filter Tabs -->
	<div class="developer-logs-filters">
		<button
			class="developer-logs-filter-tab"
			class:active={activeFilter === 'all'}
			onclick={() => (activeFilter = 'all')}
			type="button"
		>
			{$_('developer_logs_filter_all')}
			<span class="developer-logs-filter-count">{$developerLogs.length}</span>
		</button>
		<button
			class="developer-logs-filter-tab developer-logs-filter-error"
			class:active={activeFilter === 'error'}
			onclick={() => (activeFilter = 'error')}
			type="button"
		>
			<AlertCircle size={12} />
			{$_('developer_logs_filter_errors')}
			{#if $errorLogs.length > 0}
				<span class="developer-logs-filter-count">{$errorLogs.length}</span>
			{/if}
		</button>
		<button
			class="developer-logs-filter-tab developer-logs-filter-warn"
			class:active={activeFilter === 'warn'}
			onclick={() => (activeFilter = 'warn')}
			type="button"
		>
			<AlertTriangle size={12} />
			{$_('developer_logs_filter_warnings')}
			{#if $warningLogs.length > 0}
				<span class="developer-logs-filter-count">{$warningLogs.length}</span>
			{/if}
		</button>
	</div>

	<!-- Log List -->
	<div class="developer-logs-list">
		{#if isLoading}
			<div class="developer-logs-loading">
				<LoadingSpinner size="medium" />
				<span>{$_('developer_logs_loading')}</span>
			</div>
		{:else if filteredLogs.length === 0}
			<div class="developer-logs-empty">
				<p class="developer-logs-empty-title">{$_('developer_logs_empty_title')}</p>
				<p class="developer-logs-empty-hint">{$_('developer_logs_empty_hint')}</p>
			</div>
		{:else}
			{#each filteredLogs as log (log.id)}
				<div class="developer-logs-entry {getLevelClass(log.level)}">
					<span class="developer-logs-entry-time">{formatTime(log.timestamp)}</span>
					{#if activeFilter === 'all'}
						<span class="developer-logs-entry-level">{log.level.toUpperCase()}</span>
					{/if}
					<span class="developer-logs-entry-source">{log.source}</span>
					<span class="developer-logs-entry-message">{log.message}</span>
					{#if log.data !== undefined}
						<button
							class="developer-logs-entry-data-toggle"
							onclick={() => toggleExpand(log.id)}
							type="button"
						>
							{expandedLogId === log.id ? '−' : '+'}
						</button>
					{/if}
				</div>
				{#if expandedLogId === log.id && log.data !== undefined}
					<pre class="developer-logs-entry-data">{JSON.stringify(log.data, null, 2)}</pre>
				{/if}
			{/each}
		{/if}
	</div>

	<!-- Copy Toast -->
	{#if showCopyToast}
		<div class="developer-logs-toast">
			<Check size={14} />
			<span>{$_('developer_logs_copied')}</span>
		</div>
	{/if}
</div>
