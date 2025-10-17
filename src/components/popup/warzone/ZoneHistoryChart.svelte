<script lang="ts">
    import {onMount} from 'svelte';
    import type {ZoneHistoricalStats} from '@/lib/types/api';
    import {apiClient} from '@/lib/services/api-client';
    import LoadingSpinner from '../../ui/LoadingSpinner.svelte';

    interface Props {
        zoneId: number;
    }

    let {zoneId}: Props = $props();

    // Available chart display modes
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
        details: { label: string; value: string }[];
    }

    let selectedChart = $state<ChartType>('liberation');
    let historicalData = $state<ZoneHistoricalStats | null>(null);
    let isLoading = $state(true);
    let error = $state<string | null>(null);

    // Chart configuration
    const CHART_HEIGHT = 200;
    const CHART_WIDTH = 300;
    const MARGIN = {top: 20, right: 15, bottom: 30, left: 15};
    const CHART_AREA_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
    const CHART_AREA_WIDTH = CHART_WIDTH - MARGIN.left - MARGIN.right;

    // Tooltip state
    let tooltipVisible = $state(false);
    let tooltipData = $state<{
        date: string;
        x: number;
        y: number;
        transform: string;
        content: {
            label: string;
            value: string;
            details?: { label: string; value: string }[];
        };
    } | null>(null);

    onMount(async () => {
        await loadHistoricalData();
    });

    async function loadHistoricalData() {
        isLoading = true;
        error = null;

        try {
            historicalData = await apiClient.getWarZoneStatistics(zoneId);
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load zone historical data';
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
            const maxValue = Math.max(1, ...stats.map(s => s.liberation));
            return stats.map((stat, index) => ({
                date: formatDate(stat.date),
                value: stat.liberation,
                displayValue: `${stat.liberation.toFixed(1)}%`,
                height: (stat.liberation / maxValue) * CHART_AREA_HEIGHT,
                x: MARGIN.left + index * pointSpacing,
                y: CHART_HEIGHT - MARGIN.bottom,
                color: getProgressColor(stat.liberation),
                details: [
                    {label: 'Date', value: stat.date},
                    {label: 'Total Users', value: stat.totalUsers.toLocaleString()},
                    {label: 'Banned', value: stat.bannedUsers.toString()}
                ]
            }));
        } else if (selectedChart === 'users') {
            const maxValue = Math.max(1, ...stats.map(s => s.totalUsers));
            return stats.map((stat, index) => {
                const total = stat.totalUsers;
                const baseHeight = (total / maxValue) * CHART_AREA_HEIGHT;
                const bannedHeight = total === 0 ? 0 : Math.max((stat.bannedUsers / total) * baseHeight, 1);
                const flaggedHeight = total === 0 ? 0 : Math.max((stat.flaggedUsers / total) * baseHeight, 1);
                const confirmedHeight = total === 0 ? 0 : Math.max((stat.confirmedUsers / total) * baseHeight, 1);

                return {
                    date: formatDate(stat.date),
                    value: total,
                    displayValue: total.toLocaleString(),
                    height: Math.max(baseHeight, 2),
                    x: MARGIN.left + index * pointSpacing,
                    y: CHART_HEIGHT - MARGIN.bottom,
                    color: 'var(--color-primary)',
                    stacked: {
                        banned: {height: bannedHeight, color: 'var(--color-error)'},
                        flagged: {height: flaggedHeight, color: 'var(--color-warning)'},
                        confirmed: {height: confirmedHeight, color: 'var(--color-success)'}
                    },
                    details: [
                        {label: 'Date', value: stat.date},
                        {label: 'Banned', value: stat.bannedUsers.toString()},
                        {label: 'Flagged', value: stat.flaggedUsers.toString()},
                        {label: 'Confirmed', value: stat.confirmedUsers.toString()}
                    ]
                };
            });
        } else {
            // banRate - calculate success rate
            const maxValue = 100;
            return stats.map((stat, index) => {
                const banRate = stat.totalUsers > 0 ? (stat.bannedUsers / stat.totalUsers * 100) : 0;
                return {
                    date: formatDate(stat.date),
                    value: banRate,
                    displayValue: `${banRate.toFixed(1)}%`,
                    height: (banRate / maxValue) * CHART_AREA_HEIGHT,
                    x: MARGIN.left + index * pointSpacing,
                    y: CHART_HEIGHT - MARGIN.bottom,
                    color: 'var(--color-error)',
                    details: [
                        {label: 'Date', value: stat.date},
                        {label: 'Banned', value: stat.bannedUsers.toString()},
                        {label: 'Total Users', value: stat.totalUsers.toLocaleString()}
                    ]
                };
            });
        }
    });

    // Generate SVG path for line chart
    const linePath = $derived.by(() => {
        if (chartData.length === 0) return '';

        const points = chartData.map(d => `${d.x},${d.y - d.height}`);
        return `M ${points.join(' L ')}`;
    });

    // Generate SVG path for area fill
    const areaPath = $derived.by(() => {
        if (chartData.length === 0) return '';

        const firstPoint = chartData[0];
        const lastPoint = chartData[chartData.length - 1];

        const topPoints = chartData.map(d => `${d.x},${d.y - d.height}`);
        return `M ${firstPoint.x},${firstPoint.y} L ${topPoints.join(' L ')} L ${lastPoint.x},${lastPoint.y} Z`;
    });

    // Handle line hover
    function handlePointHover(event: MouseEvent, data: ChartDataPoint) {
        const svgRect = (event.currentTarget as SVGElement).closest('svg')?.getBoundingClientRect();
        if (!svgRect) return;

        // Calculate scale factor between viewBox and rendered size
        const scaleX = svgRect.width / CHART_WIDTH;
        const scaleY = svgRect.height / CHART_HEIGHT;

        // Calculate point's actual screen position
        const pointScreenX = svgRect.left + (data.x * scaleX);
        const pointScreenY = svgRect.top + (data.y * scaleY);

        // Tooltip dimensions
        const TOOLTIP_WIDTH = 160;
        const TOOLTIP_HALF = TOOLTIP_WIDTH / 2;

        // Use viewport width for bounds checking
        const viewportWidth = document.documentElement.clientWidth;

        // Determine horizontal alignment based on available space
        let transform: string;

        if (pointScreenX + TOOLTIP_HALF > viewportWidth - 10) {
            // Close to right edge - align tooltip's right edge to point
            transform = 'translate(-100%, -100%)';
        } else if (pointScreenX - TOOLTIP_HALF < 10) {
            // Close to left edge - align tooltip's left edge to point
            transform = 'translate(0, -100%)';
        } else {
            // Enough space - center tooltip on point
            transform = 'translate(-50%, -100%)';
        }

        const tooltipX = pointScreenX;

        const rawY = pointScreenY - (data.height * scaleY) - 10;
        const tooltipY = Math.max(12, Math.min(rawY, document.documentElement.clientHeight - 12));

        tooltipVisible = true;
        tooltipData = {
            date: data.date,
            x: tooltipX,
            y: tooltipY,
            transform,
            content: {
                label: getChartLabel(),
                value: data.displayValue,
                details: data.details
            }
        };
    }

    function handlePointLeave() {
        tooltipVisible = false;
        tooltipData = null;
    }

    function getChartLabel(): string {
        switch (selectedChart) {
            case 'liberation': return 'Zone Liberation';
            case 'users': return 'Total Users';
            case 'banRate': return 'Ban Success Rate';
            default: return '';
        }
    }

    function handleTabKeydown(event: KeyboardEvent, chartType: ChartType) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectedChart = chartType;
        }
    }

    function formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
            Retry
        </button>
    </div>
{:else if historicalData}
    <div class="war-zone-chart">
        <!-- Chart Type Tabs -->
        <div class="war-zone-chart-tabs" role="tablist">
            <button
                class="war-zone-chart-tab"
                class:active={selectedChart === 'liberation'}
                aria-selected={selectedChart === 'liberation'}
                onclick={() => selectedChart = 'liberation'}
                onkeydown={(e) => handleTabKeydown(e, 'liberation')}
                role="tab"
                tabindex="0"
                type="button"
            >
                Liberation
            </button>
            <button
                class="war-zone-chart-tab"
                class:active={selectedChart === 'users'}
                aria-selected={selectedChart === 'users'}
                onclick={() => selectedChart = 'users'}
                onkeydown={(e) => handleTabKeydown(e, 'users')}
                role="tab"
                tabindex="0"
                type="button"
            >
                Users
            </button>
            <button
                class="war-zone-chart-tab"
                class:active={selectedChart === 'banRate'}
                aria-selected={selectedChart === 'banRate'}
                onclick={() => selectedChart = 'banRate'}
                onkeydown={(e) => handleTabKeydown(e, 'banRate')}
                role="tab"
                tabindex="0"
                type="button"
            >
                Ban Rate
            </button>
        </div>

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
                        y1={CHART_HEIGHT - MARGIN.bottom - (gridLevel * CHART_AREA_HEIGHT)}
                        y2={CHART_HEIGHT - MARGIN.bottom - (gridLevel * CHART_AREA_HEIGHT)}
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
                        <span>Banned</span>
                    </div>
                    <div class="legend-item">
                        <div style:background-color="var(--color-warning)" class="legend-color"></div>
                        <span>Flagged</span>
                    </div>
                    <div class="legend-item">
                        <div style:background-color="var(--color-success)" class="legend-color"></div>
                        <span>Confirmed</span>
                    </div>
                </div>
            {/if}
        </div>
    </div>
{/if}

<!-- Tooltip -->
{#if tooltipVisible && tooltipData}
    <div
        style:left="{tooltipData.x}px"
        style:top="{tooltipData.y}px"
        style:transform="{tooltipData.transform}"
        class="war-zone-chart-tooltip"
    >
        <div class="tooltip-main-value">
            {tooltipData.content.value}
        </div>
        <div class="tooltip-subtitle">
            {tooltipData.content.label} • {tooltipData.date}
        </div>
        {#if tooltipData.content.details}
            <div class="tooltip-details">
                {#each tooltipData.content.details as detail (detail.label)}
                    <div class="tooltip-detail">
                        <span class="tooltip-detail-label">{detail.label}:</span>
                        <span class="tooltip-detail-value">{detail.value}</span>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
{/if}
