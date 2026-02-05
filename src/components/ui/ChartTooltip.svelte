<script lang="ts">
	export interface TooltipDetail {
		label: string;
		value: string;
	}

	interface Props {
		visible: boolean;
		x: number;
		y: number;
		transform: string;
		mainValue: string;
		subtitle: string;
		details?: TooltipDetail[];
	}

	let { visible, x, y, transform, mainValue, subtitle, details }: Props = $props();
</script>

{#if visible}
	<div style:left="{x}px" style:top="{y}px" style:transform class="chart-tooltip">
		<div class="tooltip-main-value">
			{mainValue}
		</div>
		<div class="tooltip-subtitle">
			{subtitle}
		</div>
		{#if details && details.length > 0}
			<div class="tooltip-details">
				{#each details as detail (detail.label)}
					<div class="tooltip-detail">
						<span class="tooltip-detail-label">{detail.label}:</span>
						<span class="tooltip-detail-value">{detail.value}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
