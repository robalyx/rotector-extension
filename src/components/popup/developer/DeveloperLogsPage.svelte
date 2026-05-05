<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowLeft, Copy, Trash2, CircleAlert, TriangleAlert, Check } from '@lucide/svelte';
	import {
		developerLogs,
		errorLogs,
		warningLogs,
		loadDeveloperLogs,
		clearDeveloperLogs
	} from '@/lib/stores/developer-logs';
	import { exportLogs, formatLogsForCopy } from './log-export';
	import { LOG_LEVELS, type LogLevel } from '@/lib/types/developer-logs';
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';
	import { logger } from '@/lib/utils/logging/logger';
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

	const filteredLogs = $derived.by(() => {
		if (activeFilter === 'error') return $errorLogs;
		if (activeFilter === 'warn') return $warningLogs;
		return $developerLogs;
	});

	function formatTime(timestamp: number): string {
		return new Date(timestamp).toISOString().slice(11, 23);
	}

	const LEVEL_CLASS: Record<LogLevel, string> = {
		[LOG_LEVELS.ERROR]: 'log-level-error',
		[LOG_LEVELS.WARN]: 'log-level-warn',
		[LOG_LEVELS.INFO]: 'log-level-info',
		[LOG_LEVELS.DEBUG]: 'log-level-debug',
		[LOG_LEVELS.ACTION]: 'log-level-action',
		[LOG_LEVELS.API]: 'log-level-api'
	};

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
			logger.error('Failed to copy logs:', error);
		}
	}

	async function handleClear() {
		if (confirm($_('developer_logs_clear_confirm'))) {
			await clearDeveloperLogs();
		}
	}

	function toggleExpand(logId: string) {
		expandedLogId = expandedLogId === logId ? null : logId;
	}

	onMount(() => {
		void loadDeveloperLogs().finally(() => {
			isLoading = false;
		});
	});
</script>

<div class="developer-panel-container">
	<div class="developer-panel-header">
		<button class="developer-panel-back-button" onclick={onBack} type="button">
			<ArrowLeft size={16} />
			<span>{$_('developer_logs_back')}</span>
		</button>
		<div class="developer-panel-actions">
			<button
				class="developer-panel-action-button"
				disabled={$developerLogs.length === 0}
				onclick={handleCopy}
				title={$_('developer_logs_copy_button')}
				type="button"
			>
				<Copy size={14} />
			</button>
			<button
				class="developer-panel-action-button developer-panel-action-danger"
				disabled={$developerLogs.length === 0}
				onclick={handleClear}
				title={$_('developer_logs_clear_button')}
				type="button"
			>
				<Trash2 size={14} />
			</button>
		</div>
	</div>

	<h2 class="developer-panel-title">{$_('developer_logs_title')}</h2>

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
			<CircleAlert size={12} />
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
			<TriangleAlert size={12} />
			{$_('developer_logs_filter_warnings')}
			{#if $warningLogs.length > 0}
				<span class="developer-logs-filter-count">{$warningLogs.length}</span>
			{/if}
		</button>
	</div>

	<div class="developer-logs-list">
		{#if isLoading}
			<div class="developer-panel-loading">
				<LoadingSpinner size="medium" />
				<span>{$_('developer_logs_loading')}</span>
			</div>
		{:else if filteredLogs.length === 0}
			<div class="developer-panel-empty">
				<p class="developer-panel-empty-title">{$_('developer_logs_empty_title')}</p>
				<p class="developer-panel-empty-hint">{$_('developer_logs_empty_hint')}</p>
			</div>
		{:else}
			{#each filteredLogs as log (log.id)}
				<div class="developer-logs-entry {LEVEL_CLASS[log.level]}">
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

	{#if showCopyToast}
		<div class="developer-panel-toast">
			<Check size={14} />
			<span>{$_('developer_logs_copied')}</span>
		</div>
	{/if}
</div>
