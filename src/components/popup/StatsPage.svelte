<script lang="ts">
    import StatisticsSection from './stats/StatisticsSection.svelte';
    import QueueLimitsSection from './stats/QueueLimitsSection.svelte';
    import FinancialSection from './stats/FinancialSection.svelte';
    import ChangelogSection from './stats/ChangelogSection.svelte';
    import ChangelogBanner from './shared/ChangelogBanner.svelte';
</script>

<div class="stats-page">
    <!-- Changelog Banner -->
    <ChangelogBanner />

    <!-- Statistics Section -->
    <StatisticsSection />

    <!-- Queue Limits Section -->
    <QueueLimitsSection />

    <!-- Financial Section -->
    <FinancialSection />

    <!-- Changelog Section -->
    <ChangelogSection />
</div>
