<script lang="ts">
	import { onMount } from 'svelte';
	import type { ZoneHistoricalStats, GlobalHistoricalStats } from '@/lib/types/api';
	import { apiClient } from '@/lib/services/api-client';
	import { t } from '@/lib/stores/i18n';
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';
	import ChartTabs from '../../ui/ChartTabs.svelte';
	import ChartTooltip from '../../ui/ChartTooltip.svelte';
	import { calculateTooltipPosition } from '@/lib/utils/chart-tooltip';
	import type { TooltipDetail } from '../../ui/ChartTooltip.svelte';

	interface Props {
		mode: 'global' | 'zone';
		zoneId?: number;
	}

	let { mode, zoneId }: Props = $props();

	type ChartType = 'liberation' | 'users' | 'banRate';

	interface ChartDataPoint {
		date: string;
		value: number;
		displayValue: string;
		height: number;
		x: number;
		y: number;
		color: string;
		stacked?: {
			banned: { height: number; color: string };
			flagged: { height: number; color: string };
			confirmed: { height: number; color: string };
		};
		details: TooltipDetail[];
	}

	let selectedChart = $state<ChartType>('liberation');
	let historicalData = $state<ZoneHistoricalStats | GlobalHistoricalStats | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	// Chart configuration
	const CHART_HEIGHT = 200;
	const CHART_WIDTH = 300;
	const MARGIN = { top: 20, right: 15, bottom: 30, left: 15 };
	const CHART_AREA_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
	const CHART_AREA_WIDTH = CHART_WIDTH - MARGIN.left - MARGIN.right;

	// Tooltip state
	let tooltipVisible = $state(false);
	let tooltipData = $state<{
		date: string;
		x: number;
		y: number;
		transform: string;
		mainValue: string;
		subtitle: string;
		details: TooltipDetail[];
	} | null>(null);

	// Chart tabs configuration - use derived to make reactive with translations
	const chartTabs = $derived([
		{ value: 'liberation' as ChartType, label: t('warzone_chart_tab_liberation') },
		{ value: 'users' as ChartType, label: t('warzone_chart_tab_users') },
		{ value: 'banRate' as ChartType, label: t('warzone_chart_tab_ban_rate') }
	]);

	onMount(async () => {
		await loadHistoricalData();
	});

	async function loadHistoricalData() {
		isLoading = true;
		error = null;

		try {
			if (mode === 'global') {
				historicalData = await apiClient.getGlobalStatisticsHistory();
			} else {
				if (zoneId === undefined) {
					throw new Error('zoneId is required for zone mode');
				}
				historicalData = await apiClient.getWarZoneStatistics(zoneId);
			}
		} catch (err) {
			const translatedMode = mode === 'global' ? t('warzone_mode_global') : t('warzone_mode_zone');
			error = err instanceof Error ? err.message : t('warzone_chart_error_load', [translatedMode]);
		} finally {
			isLoading = false;
		}
	}

	// Transform data for chart visualization
	const chartData: ChartDataPoint[] = $derived.by(() => {
		if (!historicalData?.dailyStats || historicalData.dailyStats.length === 0) return [];

		const stats = historicalData.dailyStats;
		const pointSpacing = CHART_AREA_WIDTH / Math.max(stats.length - 1, 1);

		if (selectedChart === 'liberation') {
			const maxValue = Math.max(1, ...stats.map((s) => s.liberation));
			return stats.map((stat, index) => ({
				date: formatDate(stat.date),
				value: stat.liberation,
				displayValue: `${stat.liberation.toFixed(1)}%`,
				height: (stat.liberation / maxValue) * CHART_AREA_HEIGHT,
				x: MARGIN.left + index * pointSpacing,
				y: CHART_HEIGHT - MARGIN.bottom,
				color: getProgressColor(stat.liberation),
				details: [
					{ label: t('warzone_chart_tooltip_date'), value: stat.date },
					{
						label: t('warzone_chart_tooltip_total_users'),
						value: stat.totalUsers.toLocaleString()
					},
					{ label: t('warzone_chart_tooltip_banned'), value: stat.bannedUsers.toLocaleString() }
				]
			}));
		} else if (selectedChart === 'users') {
			const maxValue = Math.max(1, ...stats.map((s) => s.totalUsers));
			return stats.map((stat, index) => {
				const total = stat.totalUsers;
				const baseHeight = (total / maxValue) * CHART_AREA_HEIGHT;
				const bannedHeight =
					total === 0 || stat.bannedUsers === 0
						? 0
						: Math.max((stat.bannedUsers / total) * baseHeight, 1);
				const flaggedHeight =
					total === 0 || stat.flaggedUsers === 0
						? 0
						: Math.max((stat.flaggedUsers / total) * baseHeight, 1);
				const confirmedHeight =
					total === 0 || stat.confirmedUsers === 0
						? 0
						: Math.max((stat.confirmedUsers / total) * baseHeight, 1);

				return {
					date: formatDate(stat.date),
					value: total,
					displayValue: total.toLocaleString(),
					height: Math.max(baseHeight, 2),
					x: MARGIN.left + index * pointSpacing,
					y: CHART_HEIGHT - MARGIN.bottom,
					color: 'var(--color-primary)',
					stacked: {
						banned: { height: bannedHeight, color: 'var(--color-error)' },
						flagged: { height: flaggedHeight, color: 'var(--color-warning)' },
						confirmed: { height: confirmedHeight, color: 'var(--color-success)' }
					},
					details: [
						{ label: t('warzone_chart_tooltip_date'), value: stat.date },
						{ label: t('warzone_chart_legend_banned'), value: stat.bannedUsers.toLocaleString() },
						{ label: t('warzone_chart_legend_flagged'), value: stat.flaggedUsers.toLocaleString() },
						{
							label: t('warzone_chart_legend_confirmed'),
							value: stat.confirmedUsers.toLocaleString()
						}
					]
				};
			});
		} else {
			// banRate - calculate ban rate percentage
			const maxValue = 100;
			return stats.map((stat, index) => {
				const banRate = stat.totalUsers > 0 ? (stat.bannedUsers / stat.totalUsers) * 100 : 0;
				return {
					date: formatDate(stat.date),
					value: banRate,
					displayValue: `${banRate.toFixed(1)}%`,
					height: (banRate / maxValue) * CHART_AREA_HEIGHT,
					x: MARGIN.left + index * pointSpacing,
					y: CHART_HEIGHT - MARGIN.bottom,
					color: 'var(--color-error)',
					details: [
						{ label: t('warzone_chart_tooltip_date'), value: stat.date },
						{ label: t('warzone_chart_tooltip_banned'), value: stat.bannedUsers.toLocaleString() },
						{
							label: t('warzone_chart_tooltip_total_users'),
							value: stat.totalUsers.toLocaleString()
						}
					]
				};
			});
		}
	});

	// Generate SVG path for line chart
	const linePath = $derived.by(() => {
		if (chartData.length === 0) return '';

		const points = chartData.map((d) => `${d.x},${d.y - d.height}`);
		return `M ${points.join(' L ')}`;
	});

	// Generate SVG path for area fill
	const areaPath = $derived.by(() => {
		if (chartData.length === 0) return '';

		const firstPoint = chartData[0];
		const lastPoint = chartData[chartData.length - 1];

		const topPoints = chartData.map((d) => `${d.x},${d.y - d.height}`);
		return `M ${firstPoint.x},${firstPoint.y} L ${topPoints.join(' L ')} L ${lastPoint.x},${lastPoint.y} Z`;
	});

	function handlePointHover(event: MouseEvent, data: ChartDataPoint) {
		const position = calculateTooltipPosition(
			event,
			{ width: CHART_WIDTH, height: CHART_HEIGHT },
			data.x,
			data.y,
			data.height
		);

		if (!position) return;

		tooltipVisible = true;
		tooltipData = {
			date: data.date,
			x: position.x,
			y: position.y,
			transform: position.transform,
			mainValue: data.displayValue,
			subtitle: `${getChartLabel()} • ${data.date}`,
			details: data.details
		};
	}

	function handlePointLeave() {
		tooltipVisible = false;
		tooltipData = null;
	}

	function getChartLabel(): string {
		switch (selectedChart) {
			case 'liberation':
				return mode === 'global'
					? t('warzone_chart_label_global_liberation')
					: t('warzone_chart_label_zone_liberation');
			case 'users':
				return t('warzone_chart_label_total_users');
			case 'banRate':
				return mode === 'global'
					? t('warzone_chart_label_global_ban_rate')
					: t('warzone_chart_label_zone_ban_rate');
			default:
				return '';
		}
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const monthNames = [
			'Jan',
			'Feb',
			'Mar',
			'Apr',
			'May',
			'Jun',
			'Jul',
			'Aug',
			'Sep',
			'Oct',
			'Nov',
			'Dec'
		];
		return `${monthNames[date.getMonth()]} ${date.getDate()}`;
	}

	function getProgressColor(progress: number): string {
		if (progress >= 75) return 'var(--color-success)';
		if (progress >= 50) return 'var(--color-primary)';
		if (progress >= 25) return 'var(--color-warning)';
		return 'var(--color-error)';
	}
</script>

{#if isLoading}
	<div class="war-zone-chart-loading">
		<LoadingSpinner />
	</div>
{:else if error}
	<div class="war-zone-chart-error">
		<p class="error-message">{error}</p>
		<button class="retry-button" onclick={loadHistoricalData} type="button">
			{t('warzone_common_button_retry')}
		</button>
	</div>
{:else if historicalData}
	<div class="war-zone-chart">
		<!-- Chart Type Tabs -->
		<ChartTabs
			class="war-zone-chart-tabs"
			onSelect={(value: ChartType) => (selectedChart = value)}
			selected={selectedChart}
			tabs={chartTabs}
		/>

		<!-- Chart Container -->
		<div class="war-zone-chart-container" role="tabpanel">
			<svg
				class="war-zone-chart-svg"
				height={CHART_HEIGHT}
				viewBox="0 0 {CHART_WIDTH} {CHART_HEIGHT}"
				width={CHART_WIDTH}
			>
				<!-- Grid Lines -->
				{#each [0, 0.25, 0.5, 0.75, 1] as gridLevel (gridLevel)}
					<line
						class="grid-line"
						x1={MARGIN.left}
						x2={CHART_WIDTH - MARGIN.right}
						y1={CHART_HEIGHT - MARGIN.bottom - gridLevel * CHART_AREA_HEIGHT}
						y2={CHART_HEIGHT - MARGIN.bottom - gridLevel * CHART_AREA_HEIGHT}
					/>
				{/each}

				{#if selectedChart !== 'users'}
					<!-- Area fill for line charts -->
					<path
						class="war-zone-chart-area"
						d={areaPath}
						fill={chartData[0]?.color ?? 'var(--color-primary)'}
						opacity="0.1"
					/>

					<!-- Line path -->
					<path
						class="war-zone-chart-line"
						d={linePath}
						fill="none"
						stroke={chartData[0]?.color ?? 'var(--color-primary)'}
						stroke-width="2"
					/>

					<!-- Data points -->
					{#each chartData as data (data.date)}
						<circle
							class="war-zone-chart-point"
							cx={data.x}
							cy={data.y - data.height}
							fill={data.color}
							onmouseenter={(e) => handlePointHover(e, data)}
							onmouseleave={handlePointLeave}
							r="4"
							role="graphics-symbol"
						/>
					{/each}

					<!-- Latest value label -->
					{#if chartData.length > 0}
						<text
							class="bar-value"
							text-anchor="middle"
							x={chartData[chartData.length - 1].x}
							y={chartData[chartData.length - 1].y - chartData[chartData.length - 1].height - 8}
						>
							{chartData[chartData.length - 1].displayValue}
						</text>
					{/if}
				{:else}
					<!-- Stacked area chart for users -->
					{#each chartData as data (data.date)}
						<g class="stacked-group">
							{#if data.stacked}
								<rect
									class="war-zone-chart-stacked"
									fill={data.stacked.banned.color}
									height={data.stacked.banned.height}
									onmouseenter={(e) => handlePointHover(e, data)}
									onmouseleave={handlePointLeave}
									role="graphics-symbol"
									width="8"
									x={data.x - 4}
									y={data.y - data.stacked.banned.height}
								/>
								<rect
									class="war-zone-chart-stacked"
									fill={data.stacked.flagged.color}
									height={data.stacked.flagged.height}
									onmouseenter={(e) => handlePointHover(e, data)}
									onmouseleave={handlePointLeave}
									role="graphics-symbol"
									width="8"
									x={data.x - 4}
									y={data.y - data.stacked.banned.height - data.stacked.flagged.height}
								/>
								<rect
									class="war-zone-chart-stacked"
									fill={data.stacked.confirmed.color}
									height={data.stacked.confirmed.height}
									onmouseenter={(e) => handlePointHover(e, data)}
									onmouseleave={handlePointLeave}
									role="graphics-symbol"
									width="8"
									x={data.x - 4}
									y={data.y - data.height}
								/>
							{/if}
						</g>
					{/each}

					<!-- Latest value label -->
					{#if chartData.length > 0}
						<text
							class="bar-value"
							text-anchor="middle"
							x={chartData[chartData.length - 1].x}
							y={chartData[chartData.length - 1].y - chartData[chartData.length - 1].height - 8}
						>
							{chartData[chartData.length - 1].displayValue}
						</text>
					{/if}
				{/if}
			</svg>

			{#if selectedChart === 'users'}
				<!-- Legend for user breakdown -->
				<div class="war-zone-chart-legend">
					<div class="legend-item">
						<div style:background-color="var(--color-error)" class="legend-color"></div>
						<span>{t('warzone_chart_legend_banned')}</span>
					</div>
					<div class="legend-item">
						<div style:background-color="var(--color-warning)" class="legend-color"></div>
						<span>{t('warzone_chart_legend_flagged')}</span>
					</div>
					<div class="legend-item">
						<div style:background-color="var(--color-success)" class="legend-color"></div>
						<span>{t('warzone_chart_legend_confirmed')}</span>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Tooltip -->
{#if tooltipVisible && tooltipData}
	<ChartTooltip
		details={tooltipData.details}
		mainValue={tooltipData.mainValue}
		subtitle={tooltipData.subtitle}
		transform={tooltipData.transform}
		variant="warzone"
		visible={tooltipVisible}
		x={tooltipData.x}
		y={tooltipData.y}
	/>
{/if}
