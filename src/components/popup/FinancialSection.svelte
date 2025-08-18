<script lang="ts">
    import {calculateFundingPercentage, formatCurrency, statistics} from '@/lib/stores/statistics';

    // Reactive values derived from statistics
    const donations = $derived($statistics?.totalDonations ?? 0);
    const totalGoal = $derived($statistics?.aiTotalCost ?? 0);
    const remaining = $derived($statistics?.remainingCosts ?? 0);
    const fundingPercentage = $derived(calculateFundingPercentage(donations, totalGoal));

    // Financial calculations
    const isFullyFunded = $derived(remaining === 0 && donations > 0);
    const surplus = $derived(isFullyFunded ? donations - totalGoal : 0);

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
</div>

