<script lang="ts">
	import type { Statistics } from '@/lib/types/statistics';
	import { formatNumber } from '@/lib/stores/statistics';

	interface Props {
		integrationType: 'bloxdb';
		statistics: Statistics | null;
	}

	let { integrationType, statistics }: Props = $props();

	// Position and visibility state for tooltip
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let triggerElement = $state<HTMLElement>();

	// Transform statistics data for display in tooltip
	const integrationStats = $derived.by(() => {
		if (!statistics || integrationType !== 'bloxdb') return null;

		return {
			uniqueUsers: statistics.totalBloxdbUniqueUsers,
			existingUsers: statistics.totalBloxdbExistingUsers,
			totalUsers: statistics.totalBloxdbUniqueUsers + statistics.totalBloxdbExistingUsers
		};
	});

	function showTooltip() {
		if (!triggerElement) return;

		const triggerRect = triggerElement.getBoundingClientRect();

		// Center tooltip horizontally above trigger element
		const rawX = triggerRect.left + triggerRect.width / 2;
		const rawY = triggerRect.top - 8;

		// Prevent tooltip overflow by constraining to viewport boundaries
		const tooltipWidth = 160;
		const finalX = Math.max(tooltipWidth / 2, Math.min(rawX, window.innerWidth - tooltipWidth / 2));
		const finalY = Math.max(8, rawY);

		tooltipX = finalX;
		tooltipY = finalY;
		tooltipVisible = true;
	}

	function hideTooltip() {
		tooltipVisible = false;
	}
</script>

<span
	bind:this={triggerElement}
	class="help-indicator"
	onblur={hideTooltip}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			showTooltip();
		}
	}}
	onmouseenter={showTooltip}
	onmouseleave={hideTooltip}
	role="button"
	tabindex="0"
>
	?
</span>

{#if tooltipVisible}
	{@const stats = integrationStats}
	<div style:left="{tooltipX}px" style:top="{tooltipY}px" class="integration-tooltip">
		<div class="integration-tooltip-header">
			{#if integrationType === 'bloxdb'}
				BloxDB Statistics
			{/if}
		</div>
		<div class="integration-tooltip-content">
			{#if integrationType === 'bloxdb'}
				<div class="integration-stat-item">
					<div class="integration-stat-value">{formatNumber(stats?.uniqueUsers ?? 0)}</div>
					<div class="integration-stat-label">Unique Users</div>
				</div>
				<div class="integration-stat-item">
					<div class="integration-stat-value">{formatNumber(stats?.existingUsers ?? 0)}</div>
					<div class="integration-stat-label">Existing Users</div>
				</div>
				<div class="integration-stat-divider"></div>
				<div class="integration-stat-item integration-stat-total">
					<div class="integration-stat-value">{formatNumber(stats?.totalUsers ?? 0)}</div>
					<div class="integration-stat-label">Total Users</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
