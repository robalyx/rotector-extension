<script lang="ts">
	import { loadStats, statsRange } from '@/lib/stores/stats';
	import { STATS_POLL_INTERVAL } from '@/lib/types/stats';
	import ActivitySection from './stats/ActivitySection.svelte';
	import ChangelogCompactRow from './stats/ChangelogCompactRow.svelte';
	import FundingSection from './stats/FundingSection.svelte';
	import RateLimitsSection from './stats/RateLimitsSection.svelte';
	import TotalsBand from './stats/TotalsBand.svelte';

	$effect(() => {
		const hours = $statsRange;
		void loadStats(hours);
		const id = setInterval(() => {
			void loadStats(hours, true);
		}, STATS_POLL_INTERVAL);
		return () => clearInterval(id);
	});
</script>

<div class="stats-page">
	<TotalsBand />

	<div class="popup-divider"></div>

	<ActivitySection />

	<div class="popup-divider"></div>

	<RateLimitsSection />

	<div class="popup-divider"></div>

	<FundingSection />

	<div class="popup-divider"></div>

	<ChangelogCompactRow />
</div>
