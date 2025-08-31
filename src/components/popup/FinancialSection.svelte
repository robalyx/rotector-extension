<script lang="ts">
    import {calculateFundingPercentage, formatCurrency, statistics} from '@/lib/stores/statistics';
    import WeeklyUsageChart from './WeeklyUsageChart.svelte';

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
  <h3 class="financial-section-title">Funding Goal</h3>

  <div class="financial-compact">
    <!-- Progress section -->
    <div class="progress-section">
      <div class="progress-labels">
        <div class="progress-label-left">
          <span class="progress-label">Raised</span>
          <span class="progress-amount-raised">{formatCurrency(donations)}</span>
        </div>
        <div class="progress-label-right">
          {#if isFullyFunded}
            <span class="progress-label">Surplus</span>
            <span class="progress-amount-surplus">+{formatCurrency(surplus)}</span>
          {:else}
            <span class="progress-label">Remaining</span>
            <span class="progress-amount-remaining">{formatCurrency(remaining)}</span>
          {/if}
        </div>
      </div>

      <!-- Progress bar -->
      <div
          class="funding-progress-bar"
          aria-label={isFullyFunded ? `Fully funded with ${formatCurrency(surplus)} surplus` : `${formatCurrency(donations)} raised, ${formatCurrency(remaining)} remaining of ${formatCurrency(totalGoal)} goal`}
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
        title="Support on Ko-fi"
        type="button"
    >
      <span class="kofi-button-icon" aria-hidden="true"></span>
      {isFullyFunded ? 'Thank you!' : 'Support Development'}
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
          title={chartsExpanded ? 'Hide usage charts' : 'Show usage charts'}
          type="button"
      >
        <span class="charts-toggle-icon">
          <svg
              class="chevron-icon"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
          </svg>
        </span>
        <span class="charts-toggle-text">Weekly Usage Charts</span>
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

