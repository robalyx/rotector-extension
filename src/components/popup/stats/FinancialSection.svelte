<script lang="ts">
	import { calculateFundingPercentage, formatCurrency, statistics } from '@/lib/stores/statistics';
	import WeeklyUsageChart from './WeeklyUsageChart.svelte';
	import { ChevronDown } from 'lucide-svelte';
	import { t } from '@/lib/stores/i18n';

	// Reactive values derived from statistics
	const donations = $derived($statistics?.totalDonations ?? 0);
	const totalGoal = $derived($statistics?.aiTotalCost ?? 0);
	const remaining = $derived($statistics?.remainingCosts ?? 0);
	const fundingPercentage = $derived(calculateFundingPercentage(donations, totalGoal));

	// Financial calculations
	const isFullyFunded = $derived(remaining === 0 && donations > 0);
	const surplus = $derived(isFullyFunded ? donations - totalGoal : 0);

	// Charts expansion state
	let chartsExpanded = $state(false);

	// Handle Ko-fi button click
	function handleKofiClick() {
		window.open('https://ko-fi.com/jaxron', '_blank', 'noopener,noreferrer');
	}

	// Handle keyboard events for accessibility
	function handleKofiKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleKofiClick();
		}
	}

	// Toggle charts expansion
	function toggleCharts() {
		chartsExpanded = !chartsExpanded;
	}

	// Handle keyboard events for charts toggle
	function handleChartsToggleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleCharts();
		}
	}
</script>

<div class="financial-section">
	<h3 class="financial-section-title">{t('stats_financial_title')}</h3>

	<div class="financial-compact">
		<!-- Progress section -->
		<div class="progress-section">
			<div class="progress-labels">
				<div class="progress-label-left">
					<span class="progress-label">{t('stats_financial_raised')}</span>
					<span class="progress-amount-raised">{formatCurrency(donations)}</span>
				</div>
				<div class="progress-label-right">
					{#if isFullyFunded}
						<span class="progress-label">{t('stats_financial_surplus')}</span>
						<span class="progress-amount-surplus">+{formatCurrency(surplus)}</span>
					{:else}
						<span class="progress-label">{t('stats_financial_remaining')}</span>
						<span class="progress-amount-remaining">{formatCurrency(remaining)}</span>
					{/if}
				</div>
			</div>

			<!-- Progress bar -->
			<div
				class="funding-progress-bar"
				aria-label={isFullyFunded
					? t('stats_financial_aria_funded', [formatCurrency(surplus)])
					: t('stats_financial_aria_progress', [
							formatCurrency(donations),
							formatCurrency(remaining),
							formatCurrency(totalGoal)
						])}
				aria-valuemax="100"
				aria-valuemin="0"
				aria-valuenow={fundingPercentage}
				role="progressbar"
			>
				<div
					style:width="{fundingPercentage}%"
					class="funding-progress-fill"
					class:funding-complete={isFullyFunded}
					class:funding-in-progress={!isFullyFunded}
				></div>
			</div>
		</div>

		<!-- Support button -->
		<button
			class="kofi-support-button"
			onclick={handleKofiClick}
			onkeydown={handleKofiKeydown}
			title={t('stats_financial_kofi_title')}
			type="button"
		>
			<span class="kofi-button-icon" aria-hidden="true"></span>
			{isFullyFunded ? t('stats_financial_button_funded') : t('stats_financial_button_support')}
		</button>
	</div>

	<!-- Charts Section -->
	{#if $statistics?.weeklyUsage}
		<div class="charts-section">
			<!-- Charts Toggle Button -->
			<button
				class="charts-toggle"
				class:expanded={chartsExpanded}
				aria-controls="charts-content"
				aria-expanded={chartsExpanded}
				onclick={toggleCharts}
				onkeydown={handleChartsToggleKeydown}
				title={chartsExpanded ? t('stats_financial_charts_hide') : t('stats_financial_charts_show')}
				type="button"
			>
				<span class="charts-toggle-icon">
					<ChevronDown class="chevron-icon" size={18} />
				</span>
				<span class="charts-toggle-text">{t('stats_financial_charts_toggle')}</span>
			</button>

			<!-- Expandable Charts Content -->
			<div
				id="charts-content"
				class="charts-content"
				class:expanded={chartsExpanded}
				aria-hidden={!chartsExpanded}
			>
				<WeeklyUsageChart weeklyUsage={$statistics.weeklyUsage} />
			</div>
		</div>
	{/if}
</div>
