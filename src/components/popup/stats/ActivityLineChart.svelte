<script lang="ts">
	import uPlot from 'uplot';
	import 'uplot/dist/uPlot.min.css';
	import { onDestroy } from 'svelte';
	import { _ } from 'svelte-i18n';
	import {
		computeDeltas,
		computeYBounds,
		formatTickLabel,
		type CategoryDescriptor
	} from '@/lib/utils/activity-chart';
	import type { ActivityHours, HourlyStatEntry } from '@/lib/types/stats';

	interface Props {
		entries: HourlyStatEntry[];
		categories: readonly CategoryDescriptor[];
		visibility: Record<string, boolean>;
		hours: ActivityHours;
		height?: number;
		loading?: boolean;
		ariaLabel: string;
	}

	let {
		entries,
		categories,
		visibility,
		hours,
		height = 110,
		loading = false,
		ariaLabel
	}: Props = $props();

	let container: HTMLDivElement | undefined = $state();
	let chartInstance: uPlot | undefined;

	const hasData = $derived(entries.length >= 2);
	const cachedDeltas = $derived(categories.map((cat) => computeDeltas(entries, cat.key)));

	function buildData(): uPlot.AlignedData {
		if (entries.length < 2) {
			return [[], ...categories.map(() => [] as number[])];
		}
		const timestamps = entries
			.slice(1)
			.map((e) => Math.floor(new Date(e.timestamp).getTime() / 1000));
		return [timestamps, ...cachedDeltas];
	}

	function computeRange(): [number, number] | null {
		if (hours === 24 || entries.length < 4) return null;
		const visibleSeries = cachedDeltas.filter((_, i) => {
			const cat = categories[i];
			return !cat || visibility[cat.key] !== false;
		});
		if (visibleSeries.length === 0) return null;
		const bounds = computeYBounds(visibleSeries);
		return bounds ? [bounds.min, bounds.max] : null;
	}

	// uPlot renders to canvas so CSS variables must be resolved to raw colors first
	function resolveColors(el: HTMLElement) {
		const styles = getComputedStyle(el);
		return {
			axis: styles.getPropertyValue('--color-text-subtle').trim(),
			grid: styles.getPropertyValue('--color-border-subtle').trim()
		};
	}

	function buildOptions(width: number, axisColor: string, gridColor: string): uPlot.Options {
		return {
			width,
			height,
			padding: [8, 8, 4, 8],
			cursor: {
				drag: { x: false, y: false },
				points: { size: 5 }
			},
			legend: { show: false },
			scales: {
				x: { time: true },
				y: {
					range: (_u, dataMin, dataMax) => computeRange() ?? [dataMin, dataMax]
				}
			},
			axes: [
				{
					stroke: axisColor,
					grid: { stroke: gridColor, width: 1 },
					ticks: { show: false },
					font: '10px system-ui, sans-serif',
					size: 20,
					values: (_u, ticks) => ticks.map((t) => formatTickLabel(new Date(t * 1000), hours))
				},
				{
					stroke: axisColor,
					grid: { stroke: gridColor, width: 1 },
					ticks: { show: false },
					font: '10px system-ui, sans-serif',
					size: 36,
					values: (_u, ticks) => ticks.map((t) => Math.round(t).toString())
				}
			],
			series: [
				{},
				...categories.map((cat) => ({
					label: cat.key,
					stroke: cat.color,
					fill: `${cat.color}14`,
					width: 1.5,
					points: { show: false },
					show: visibility[cat.key] !== false
				}))
			]
		};
	}

	function destroyChart() {
		if (chartInstance) {
			chartInstance.destroy();
			chartInstance = undefined;
		}
	}

	// Create on first data, feed subsequent updates via setData, destroy when data empties
	$effect(() => {
		if (!container || !hasData) {
			destroyChart();
			return;
		}

		if (chartInstance) {
			chartInstance.setData(buildData());
			return;
		}

		const width = container.clientWidth || 310;
		const { axis, grid } = resolveColors(container);
		chartInstance = new uPlot(buildOptions(width, axis, grid), buildData(), container);
	});

	// Toggle series visibility
	$effect(() => {
		const shows = categories.map((cat) => visibility[cat.key] !== false);
		const chart = chartInstance;
		if (!chart) return;
		shows.forEach((show, idx) => {
			chart.setSeries(idx + 1, { show });
		});
	});

	onDestroy(destroyChart);
</script>

<div style:min-height="{height}px" class="activity-chart">
	{#if hasData}
		<div bind:this={container} class="activity-chart-canvas" aria-label={ariaLabel}></div>
	{:else if !loading}
		<div class="activity-chart-empty" aria-label={ariaLabel} role="img">
			{$_('stats_activity_no_data')}
		</div>
	{/if}
</div>
