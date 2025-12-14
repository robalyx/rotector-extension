<script lang="ts">
	import StatisticsSection from './stats/StatisticsSection.svelte';
	import QueueLimitsDisplay from '../ui/QueueLimitsDisplay.svelte';
	import FinancialSection from './stats/FinancialSection.svelte';
	import ChangelogSection from './stats/ChangelogSection.svelte';
</script>

<div class="stats-page">
	<!-- Statistics Section -->
	<StatisticsSection />

	<!-- Queue Limits Section -->
	<QueueLimitsDisplay variant="popup" />

	<!-- Financial Section -->
	<FinancialSection />

	<!-- Changelog Section -->
	<ChangelogSection />
</div>
