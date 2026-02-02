<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowLeft, Trash2, Activity, Zap, Clock, Copy, Check } from 'lucide-svelte';
	import {
		performanceEntries,
		categoryStats,
		slowestOperations,
		loadPerformanceEntries,
		clearPerformanceEntries
	} from '@/lib/stores/performance';
	import type { TraceCategory } from '@/lib/types/performance';
	import { formatDurationMs, formatTimeOfDay } from '@/lib/utils/time';
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';
	import { _ } from 'svelte-i18n';

	interface Props {
		onBack: () => void;
	}

	let { onBack }: Props = $props();

	let isLoading = $state(true);
	let expandedTraceId = $state<string | null>(null);
	let showCopyToast = $state(false);

	// Category colors
	const CATEGORY_COLORS: Record<TraceCategory, string> = {
		controller: '#8b5cf6',
		observer: '#06b6d4',
		api: '#f59e0b',
		dom: '#10b981',
		blur: '#ec4899',
		component: '#3b82f6'
	};

	// Get bar width as percentage
	function getBarWidth(value: number, max: number): number {
		if (max === 0) return 0;
		return Math.min(100, (value / max) * 100);
	}

	// Format performance data for clipboard
	function formatPerformanceForCopy(): string {
		const lines: string[] = [
			'=== Performance Traces ===',
			`Total entries: ${$performanceEntries.length}`,
			''
		];

		// Category summary
		if ($categoryStats.length > 0) {
			lines.push('=== Category Summary ===');
			for (const stat of $categoryStats) {
				lines.push(
					`${stat.category.toUpperCase()}: ${formatDurationMs(stat.avgDuration)} avg, ${formatDurationMs(stat.minDuration)} min, ${formatDurationMs(stat.maxDuration)} max (${stat.count} traces)`
				);
			}
			lines.push('');
		}

		// Slowest operations
		if ($slowestOperations.length > 0) {
			lines.push('=== Slowest Operations ===');
			$slowestOperations.forEach((entry, i) => {
				lines.push(
					`${i + 1}. [${entry.category}] ${entry.operation} - ${formatDurationMs(entry.duration)}`
				);
			});
			lines.push('');
		}

		// All traces
		lines.push('=== All Traces ===');
		for (const entry of $performanceEntries) {
			const time = new Date(entry.timestamp).toISOString();
			lines.push(
				`[${time}] [${entry.category}] ${entry.operation} - ${formatDurationMs(entry.duration)}${entry.success ? '' : ' (FAILED)'}`
			);
			if (entry.metadata) {
				lines.push(`  metadata: ${JSON.stringify(entry.metadata)}`);
			}
		}

		return lines.join('\n');
	}

	// Copy performance data to clipboard
	async function handleCopy() {
		try {
			const text = formatPerformanceForCopy();
			await navigator.clipboard.writeText(text);
			showCopyToast = true;
			setTimeout(() => {
				showCopyToast = false;
			}, 2000);
		} catch (error) {
			console.error('Failed to copy performance data:', error);
		}
	}

	// Clear all performance data
	async function handleClear() {
		if (confirm($_('performance_dashboard_clear_confirm'))) {
			await clearPerformanceEntries();
		}
	}

	// Toggle trace expansion
	function toggleExpand(traceId: string) {
		expandedTraceId = expandedTraceId === traceId ? null : traceId;
	}

	onMount(() => {
		void loadPerformanceEntries().finally(() => {
			isLoading = false;
		});
	});

	// Computed max for bar scaling
	const maxAvgDuration = $derived(Math.max(...$categoryStats.map((s) => s.avgDuration), 1));

	// Recent traces (last 20)
	const recentTraces = $derived($performanceEntries.slice(0, 20));
</script>

<div class="perf-dashboard-container">
	<!-- Header -->
	<div class="perf-dashboard-header">
		<button class="perf-dashboard-back-button" onclick={onBack} type="button">
			<ArrowLeft size={16} />
			<span>{$_('performance_dashboard_back')}</span>
		</button>
		<div class="perf-dashboard-actions">
			<button
				class="perf-dashboard-action-button"
				disabled={$performanceEntries.length === 0}
				onclick={handleCopy}
				title={$_('performance_dashboard_copy_button')}
				type="button"
			>
				<Copy size={14} />
			</button>
			<button
				class="perf-dashboard-action-button perf-dashboard-action-danger"
				disabled={$performanceEntries.length === 0}
				onclick={handleClear}
				title={$_('performance_dashboard_clear_button')}
				type="button"
			>
				<Trash2 size={14} />
			</button>
		</div>
	</div>

	<!-- Title -->
	<h2 class="perf-dashboard-title">{$_('performance_dashboard_title')}</h2>

	{#if isLoading}
		<div class="perf-loading">
			<LoadingSpinner size="medium" />
		</div>
	{:else if $performanceEntries.length === 0}
		<div class="perf-empty">
			<p class="perf-empty-title">{$_('performance_dashboard_empty_title')}</p>
			<p class="perf-empty-hint">{$_('performance_dashboard_empty_hint')}</p>
		</div>
	{:else}
		<!-- Category Overview -->
		<div class="flex flex-col gap-1.5">
			<h3 class="perf-section-header">
				<Activity size={12} />
				{$_('performance_dashboard_category_overview')}
			</h3>
			<div class="perf-category-list">
				{#each $categoryStats as stat (stat.category)}
					<div class="perf-category-row">
						<span style:color={CATEGORY_COLORS[stat.category]} class="perf-category-label">
							{stat.category}
						</span>
						<div class="perf-category-bar-container">
							<div
								style:width="{getBarWidth(stat.avgDuration, maxAvgDuration)}%"
								style:background-color={CATEGORY_COLORS[stat.category]}
								class="perf-category-bar"
							></div>
						</div>
						<span class="perf-category-stats">
							{formatDurationMs(stat.avgDuration)} avg ({stat.count})
						</span>
					</div>
				{/each}
			</div>
		</div>

		<!-- Slowest Operations -->
		<div class="flex flex-col gap-1.5">
			<h3 class="perf-section-header">
				<Zap size={12} />
				{$_('performance_dashboard_slowest')}
			</h3>
			<div class="perf-slowest-list">
				{#each $slowestOperations as entry, i (entry.id)}
					<div class="perf-slowest-item">
						<span class="perf-slowest-rank">{i + 1}</span>
						<span
							style:background-color="{CATEGORY_COLORS[entry.category]}20"
							style:color={CATEGORY_COLORS[entry.category]}
							class="perf-slowest-category"
						>
							{entry.category}
						</span>
						<span class="perf-slowest-operation">{entry.operation}</span>
						<span class="perf-slowest-duration">{formatDurationMs(entry.duration)}</span>
					</div>
				{/each}
			</div>
		</div>

		<!-- Recent Traces -->
		<div class="flex flex-col gap-1.5">
			<h3 class="perf-section-header">
				<Clock size={12} />
				{$_('performance_dashboard_recent')}
			</h3>
			<div class="perf-traces-list">
				{#each recentTraces as entry (entry.id)}
					<div>
						<button
							class="perf-trace-entry w-full text-left"
							onclick={() => entry.metadata && toggleExpand(entry.id)}
							type="button"
						>
							<span class="perf-trace-time">{formatTimeOfDay(entry.timestamp)}</span>
							<span
								style:background-color="{CATEGORY_COLORS[entry.category]}20"
								style:color={CATEGORY_COLORS[entry.category]}
								class="perf-trace-category"
							>
								{entry.category}
							</span>
							<span class="perf-trace-operation">{entry.operation}</span>
							<span class="perf-trace-duration">{formatDurationMs(entry.duration)}</span>
							{#if entry.metadata}
								<span class="perf-trace-expand">{expandedTraceId === entry.id ? '−' : '+'}</span>
							{/if}
						</button>
						{#if expandedTraceId === entry.id && entry.metadata}
							<pre class="perf-trace-metadata">{JSON.stringify(entry.metadata, null, 2)}</pre>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Copy Toast -->
	{#if showCopyToast}
		<div class="perf-toast">
			<Check size={14} />
			<span>{$_('performance_dashboard_copied')}</span>
		</div>
	{/if}
</div>
