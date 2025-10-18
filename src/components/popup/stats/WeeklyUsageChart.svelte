<script lang="ts">
	import type { WeeklyUsage } from '@/lib/types/statistics';
	import { formatCurrency, formatNumber } from '@/lib/stores/statistics';
	import ChartTabs from '../../ui/ChartTabs.svelte';
	import ChartTooltip from '../../ui/ChartTooltip.svelte';
	import { calculateBarTooltipPosition } from '@/lib/utils/chart-tooltip';
	import type { TooltipDetail } from '../../ui/ChartTooltip.svelte';

	let { weeklyUsage }: { weeklyUsage: WeeklyUsage } = $props();

	type ChartType = 'cost' | 'requests' | 'tokens';

	interface ChartDataPoint {
		week: string;
		value: number;
		displayValue: string;
		height: number;
		x: number;
		y: number;
		color: string;
		stacked?: {
			prompt: { height: number; color: string };
			completion: { height: number; color: string };
			reasoning: { height: number; color: string };
		};
		details: TooltipDetail[];
	}

	let selectedChart = $state<ChartType>('cost');

	// Chart configuration
	const CHART_HEIGHT = 190;
	const CHART_WIDTH = 280;
	const BAR_WIDTH = 40;
	const BAR_SPACING = 20;
	const MARGIN = { top: 20, right: 15, bottom: 25, left: 15 };

	// Tooltip state
	let tooltipVisible = $state(false);
	let tooltipData = $state<{
		week: string;
		x: number;
		y: number;
		transform: string;
		mainValue: string;
		subtitle: string;
		details: TooltipDetail[];
	} | null>(null);

	// Chart tabs configuration
	const chartTabs = [
		{ value: 'cost' as ChartType, label: 'AI Costs' },
		{ value: 'requests' as ChartType, label: 'AI Requests' },
		{ value: 'tokens' as ChartType, label: 'AI Tokens' }
	];

	// Weekly data in chronological order (oldest to newest)
	const weeksData = $derived([
		{ key: 'week4', ...weeklyUsage.week4, label: '3 Weeks\nAgo' },
		{ key: 'week3', ...weeklyUsage.week3, label: '2 Weeks\nAgo' },
		{ key: 'week2', ...weeklyUsage.week2, label: 'Last Week' },
		{ key: 'week1', ...weeklyUsage.week1, label: 'This Week' }
	]);

	// Transform data for chart visualization
	const chartData: ChartDataPoint[] = $derived.by(() => {
		if (selectedChart === 'cost') {
			const maxValue = Math.max(1, ...weeksData.map((w) => w.totalCost));
			return weeksData.map((week, index) => ({
				week: week.label,
				value: week.totalCost,
				displayValue: formatCurrency(week.totalCost),
				height: Math.max(
					(week.totalCost / maxValue) * (CHART_HEIGHT - MARGIN.top - MARGIN.bottom),
					2
				),
				x: MARGIN.left + 15 + index * (BAR_WIDTH + BAR_SPACING),
				y: CHART_HEIGHT - MARGIN.bottom,
				color: 'var(--color-primary)',
				details: [
					{
						label: 'Total Requests',
						value: formatNumber(week.totalRequests)
					},
					{
						label: 'Period',
						value: formatDateRange(week.startDate, week.endDate)
					}
				]
			}));
		} else if (selectedChart === 'requests') {
			const maxValue = Math.max(1, ...weeksData.map((w) => w.totalRequests));
			return weeksData.map((week, index) => ({
				week: week.label,
				value: week.totalRequests,
				displayValue: formatNumber(week.totalRequests),
				height: Math.max(
					(week.totalRequests / maxValue) * (CHART_HEIGHT - MARGIN.top - MARGIN.bottom),
					2
				),
				x: MARGIN.left + 15 + index * (BAR_WIDTH + BAR_SPACING),
				y: CHART_HEIGHT - MARGIN.bottom,
				color: 'var(--color-success)',
				details: [
					{
						label: 'Total Cost',
						value: formatCurrency(week.totalCost)
					},
					{
						label: 'Period',
						value: formatDateRange(week.startDate, week.endDate)
					}
				]
			}));
		} else {
			// tokens - display as stacked bars
			const maxValue = Math.max(
				1,
				...weeksData.map(
					(w) => w.totalPromptTokens + w.totalCompletionTokens + w.totalReasoningTokens
				)
			);
			return weeksData.map((week, index) => {
				const total =
					week.totalPromptTokens + week.totalCompletionTokens + week.totalReasoningTokens;
				const baseHeight = (total / maxValue) * (CHART_HEIGHT - MARGIN.top - MARGIN.bottom);
				const promptHeight =
					total === 0 ? 0 : Math.max((week.totalPromptTokens / total) * baseHeight, 1);
				const completionHeight =
					total === 0 ? 0 : Math.max((week.totalCompletionTokens / total) * baseHeight, 1);
				const reasoningHeight =
					total === 0 ? 0 : Math.max((week.totalReasoningTokens / total) * baseHeight, 1);

				return {
					week: week.label,
					value: total,
					displayValue: formatNumber(total),
					height: Math.max(baseHeight, 2),
					x: MARGIN.left + 15 + index * (BAR_WIDTH + BAR_SPACING),
					y: CHART_HEIGHT - MARGIN.bottom,
					color: 'var(--color-primary)',
					stacked: {
						prompt: {
							height: promptHeight,
							color: 'var(--color-primary)'
						},
						completion: {
							height: completionHeight,
							color: 'var(--color-success)'
						},
						reasoning: {
							height: reasoningHeight,
							color: 'var(--color-warning)'
						}
					},
					details: [
						{
							label: 'Prompt Tokens',
							value: formatNumber(week.totalPromptTokens)
						},
						{
							label: 'Completion Tokens',
							value: formatNumber(week.totalCompletionTokens)
						},
						{
							label: 'Reasoning Tokens',
							value: formatNumber(week.totalReasoningTokens)
						},
						{
							label: 'Total Cost',
							value: formatCurrency(week.totalCost)
						},
						{
							label: 'Period',
							value: formatDateRange(week.startDate, week.endDate)
						}
					]
				};
			});
		}
	});

	function handleBarHover(event: MouseEvent, data: ChartDataPoint) {
		// Calculate actual height for stacked bars
		const stackedSum = data.stacked
			? data.stacked.prompt.height + data.stacked.completion.height + data.stacked.reasoning.height
			: data.height;

		const position = calculateBarTooltipPosition(
			event,
			{ width: CHART_WIDTH, height: CHART_HEIGHT },
			data.x,
			data.y,
			BAR_WIDTH,
			stackedSum
		);

		if (!position) return;

		tooltipVisible = true;
		tooltipData = {
			week: data.week,
			x: position.x,
			y: position.y,
			transform: position.transform,
			mainValue: data.displayValue,
			subtitle: `${getChartLabel()} • ${data.week}`,
			details: data.details
		};
	}

	function handleBarLeave() {
		tooltipVisible = false;
		tooltipData = null;
	}

	function getChartLabel(): string {
		switch (selectedChart) {
			case 'cost':
				return 'Weekly AI Costs';
			case 'requests':
				return 'Weekly AI Requests';
			case 'tokens':
				return 'Total AI Tokens';
			default:
				return '';
		}
	}

	function formatDateRange(startDate: string, endDate: string): string {
		const start = new Date(startDate);
		const end = new Date(endDate);
		const now = new Date();
		const currentYear = now.getFullYear();

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

		const formatDate = (date: Date, includeYear: boolean = false) => {
			const month = monthNames[date.getMonth()];
			const day = date.getDate();
			const year = date.getFullYear();

			if (includeYear || year !== currentYear) {
				return `${month} ${day}, ${year}`;
			}
			return `${month} ${day}`;
		};

		// Single date display
		if (startDate === endDate) {
			return formatDate(start, start.getFullYear() !== currentYear);
		}

		// Same month abbreviated format
		if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
			const month = monthNames[start.getMonth()];
			const includeYear = start.getFullYear() !== currentYear;
			return includeYear
				? `${month} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`
				: `${month} ${start.getDate()}-${end.getDate()}`;
		}

		// Full range for different months
		const includeYear = start.getFullYear() !== currentYear || end.getFullYear() !== currentYear;
		return `${formatDate(start, includeYear)} - ${formatDate(end, includeYear)}`;
	}
</script>

<div class="weekly-usage-chart">
	<!-- Chart Type Tabs -->
	<ChartTabs
		onSelect={(value: ChartType) => (selectedChart = value)}
		selected={selectedChart}
		tabs={chartTabs}
	/>

	<!-- Chart Container -->
	<div class="chart-container" role="tabpanel">
		<svg
			class="chart-svg"
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
					y1={CHART_HEIGHT -
						MARGIN.bottom -
						gridLevel * (CHART_HEIGHT - MARGIN.top - MARGIN.bottom)}
					y2={CHART_HEIGHT -
						MARGIN.bottom -
						gridLevel * (CHART_HEIGHT - MARGIN.top - MARGIN.bottom)}
				/>
			{/each}

			<!-- Y-axis -->
			<line
				style:opacity="1"
				class="grid-line"
				x1={MARGIN.left}
				x2={MARGIN.left}
				y1={MARGIN.top}
				y2={CHART_HEIGHT - MARGIN.bottom}
			/>

			<!-- Chart Bars -->
			{#each chartData as data, index (data.week)}
				<g class="bar-group">
					{#if selectedChart === 'tokens' && data.stacked}
						<!-- Stacked bars for tokens -->
						<rect
							class="chart-bar stacked-bar"
							aria-label="Prompt tokens for {data.week}: {formatNumber(
								weeksData[index].totalPromptTokens
							)}"
							fill={data.stacked.prompt.color}
							height={data.stacked.prompt.height}
							onmouseenter={(e) => handleBarHover(e, data)}
							onmouseleave={handleBarLeave}
							role="graphics-symbol"
							width={BAR_WIDTH}
							x={data.x}
							y={data.y - data.stacked.prompt.height}
						/>
						<rect
							class="chart-bar stacked-bar"
							aria-label="Completion tokens for {data.week}: {formatNumber(
								weeksData[index].totalCompletionTokens
							)}"
							fill={data.stacked.completion.color}
							height={data.stacked.completion.height}
							onmouseenter={(e) => handleBarHover(e, data)}
							onmouseleave={handleBarLeave}
							role="graphics-symbol"
							width={BAR_WIDTH}
							x={data.x}
							y={data.y - data.stacked.prompt.height - data.stacked.completion.height}
						/>
						<rect
							class="chart-bar stacked-bar"
							aria-label="Reasoning tokens for {data.week}: {formatNumber(
								weeksData[index].totalReasoningTokens
							)}"
							fill={data.stacked.reasoning.color}
							height={data.stacked.reasoning.height}
							onmouseenter={(e) => handleBarHover(e, data)}
							onmouseleave={handleBarLeave}
							role="graphics-symbol"
							width={BAR_WIDTH}
							x={data.x}
							y={data.y -
								(data.stacked.prompt.height +
									data.stacked.completion.height +
									data.stacked.reasoning.height)}
						/>
					{:else}
						<!-- Regular bars -->
						<rect
							class="chart-bar"
							aria-label="{getChartLabel()} for {data.week}: {data.displayValue}"
							fill={data.color}
							height={data.height}
							onmouseenter={(e) => handleBarHover(e, data)}
							onmouseleave={handleBarLeave}
							role="graphics-symbol"
							width={BAR_WIDTH}
							x={data.x}
							y={data.y - data.height}
						/>
					{/if}

					<!-- Value label above bar -->
					<text
						class="bar-value"
						text-anchor="middle"
						x={data.x + BAR_WIDTH / 2}
						y={data.y -
							(selectedChart === 'tokens' && data.stacked
								? data.stacked.prompt.height +
									data.stacked.completion.height +
									data.stacked.reasoning.height
								: data.height) -
							5}
					>
						{data.displayValue}
					</text>

					<!-- Week labels -->
					{#if data.week.includes('\n')}
						{#each data.week.split('\n') as line, lineIndex (lineIndex)}
							<text
								class="week-label"
								text-anchor="middle"
								x={data.x + BAR_WIDTH / 2}
								y={CHART_HEIGHT - 8 + lineIndex * 12}
							>
								{line}
							</text>
						{/each}
					{:else}
						<text
							class="week-label"
							text-anchor="middle"
							x={data.x + BAR_WIDTH / 2}
							y={CHART_HEIGHT - 8}
						>
							{data.week}
						</text>
					{/if}
				</g>
			{/each}
		</svg>

		{#if selectedChart === 'tokens'}
			<!-- Legend for tokens -->
			<div class="chart-legend">
				<div class="legend-item">
					<div style:background-color="var(--color-primary)" class="legend-color"></div>
					<span>Prompt</span>
				</div>
				<div class="legend-item">
					<div style:background-color="var(--color-success)" class="legend-color"></div>
					<span>Completion</span>
				</div>
				<div class="legend-item">
					<div style:background-color="var(--color-warning)" class="legend-color"></div>
					<span>Reasoning</span>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Tooltip -->
{#if tooltipVisible && tooltipData}
	<ChartTooltip
		details={tooltipData.details}
		mainValue={tooltipData.mainValue}
		subtitle={tooltipData.subtitle}
		transform={tooltipData.transform}
		visible={tooltipVisible}
		x={tooltipData.x}
		y={tooltipData.y}
	/>
{/if}
