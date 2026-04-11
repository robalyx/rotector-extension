<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { stats } from '@/lib/stores/stats';
	import { formatCompact, formatNumber } from '@/lib/utils/format';

	const totals = $derived($stats?.totals);

	const usersTotal = $derived(
		totals
			? totals.usersConfirmed + totals.usersFlagged + totals.usersMixed + totals.usersBanned
			: undefined
	);

	const groupsTotal = $derived(
		totals
			? totals.groupsConfirmed + totals.groupsFlagged + totals.groupsMixed + totals.groupsLocked
			: undefined
	);
</script>

<section class="totals-band" aria-label={$_('stats_totals_aria')}>
	<div class="totals-band-item">
		<span class="totals-band-value" title={formatNumber(usersTotal)}>
			{formatCompact(usersTotal)}
		</span>
		<span class="totals-band-label">{$_('stats_totals_users')}</span>
	</div>
	<div class="totals-band-item">
		<span class="totals-band-value" title={formatNumber(groupsTotal)}>
			{formatCompact(groupsTotal)}
		</span>
		<span class="totals-band-label">{$_('stats_totals_groups')}</span>
	</div>
	<div class="totals-band-item">
		<span class="totals-band-value" title={formatNumber(totals?.queuedUsers)}>
			{formatCompact(totals?.queuedUsers)}
		</span>
		<span class="totals-band-label">{$_('stats_totals_queued')}</span>
	</div>
</section>
