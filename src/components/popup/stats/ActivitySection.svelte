<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { stats, statsRange, statsState } from '@/lib/stores/stats';
	import { ACTIVITY_HOURS, type ActivityHours } from '@/lib/types/stats';
	import { GROUP_CATEGORIES, USER_CATEGORIES } from './activity-chart';
	import { formatCompact, formatNumber } from '@/lib/utils/format';
	import ActivityLegendPill from './ActivityLegendPill.svelte';
	import ActivityLineChart from './ActivityLineChart.svelte';

	let userVisibility = $state<Record<string, boolean>>(
		Object.fromEntries(USER_CATEGORIES.map((c) => [c.key, true]))
	);
	let groupVisibility = $state<Record<string, boolean>>(
		Object.fromEntries(GROUP_CATEGORIES.map((c) => [c.key, true]))
	);

	const isLoading = $derived($statsState === 'loading');
	const entries = $derived($stats?.activity.entries ?? []);
	const totals = $derived($stats?.totals);

	function handleRangeSelect(hours: ActivityHours) {
		statsRange.set(hours);
	}
</script>

<section class="activity-section">
	<header class="activity-section-head">
		<div class="activity-section-titles">
			<h2 class="popup-section-title">{$_('stats_activity_title')}</h2>
			<span class="activity-section-subtitle">{$_('stats_activity_subtitle')}</span>
		</div>
		<div class="activity-range-toggle" role="tablist">
			{#each ACTIVITY_HOURS as hours (hours)}
				<button
					class="activity-range-button"
					class:active={$statsRange === hours}
					aria-selected={$statsRange === hours}
					onclick={() => handleRangeSelect(hours)}
					role="tab"
					type="button"
				>
					{hours === 24
						? $_('stats_activity_range_24h')
						: hours === 168
							? $_('stats_activity_range_7d')
							: $_('stats_activity_range_30d')}
				</button>
			{/each}
		</div>
	</header>

	{#if $statsState === 'error'}
		<div class="activity-error" role="alert">{$_('stats_activity_error')}</div>
	{/if}

	<div class="activity-group">
		<div class="activity-group-label">{$_('stats_activity_users')}</div>
		<div class="activity-legend">
			{#each USER_CATEGORIES as category (category.key)}
				<ActivityLegendPill
					color={category.color}
					label={$_(category.labelKey)}
					onclick={() =>
						(userVisibility = { ...userVisibility, [category.key]: !userVisibility[category.key] })}
					value={formatCompact(totals?.[category.key])}
					visible={userVisibility[category.key] !== false}
				/>
			{/each}
		</div>
		<ActivityLineChart
			ariaLabel={$_('stats_activity_users_chart_label')}
			categories={USER_CATEGORIES}
			{entries}
			hours={$statsRange}
			loading={isLoading}
			visibility={userVisibility}
		/>
	</div>

	<div class="activity-group">
		<div class="activity-group-label">{$_('stats_activity_groups')}</div>
		<div class="activity-legend">
			{#each GROUP_CATEGORIES as category (category.key)}
				<ActivityLegendPill
					color={category.color}
					label={$_(category.labelKey)}
					onclick={() =>
						(groupVisibility = {
							...groupVisibility,
							[category.key]: !groupVisibility[category.key]
						})}
					value={formatCompact(totals?.[category.key])}
					visible={groupVisibility[category.key] !== false}
				/>
			{/each}
		</div>
		<ActivityLineChart
			ariaLabel={$_('stats_activity_groups_chart_label')}
			categories={GROUP_CATEGORIES}
			{entries}
			hours={$statsRange}
			loading={isLoading}
			visibility={groupVisibility}
		/>
	</div>

	<div class="activity-group activity-community">
		<div class="activity-group-label">{$_('stats_activity_community')}</div>
		<div class="activity-community-line">
			<span class="activity-community-value" title={formatNumber(totals?.votesCast)}>
				{formatCompact(totals?.votesCast)}
			</span>
			<span class="activity-community-label">{$_('stats_activity_votes_cast')}</span>
		</div>
	</div>
</section>
