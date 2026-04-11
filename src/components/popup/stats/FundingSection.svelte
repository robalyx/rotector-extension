<script lang="ts">
	import SiKofi from '@icons-pack/svelte-simple-icons/icons/SiKofi';
	import { _ } from 'svelte-i18n';
	import { stats } from '@/lib/stores/stats';
	import { calculatePercentage, formatCurrency } from '@/lib/utils/format';

	const donations = $derived($stats?.funding.donations ?? 0);
	const goal = $derived($stats?.funding.goal ?? 0);
	const fundingPercentage = $derived(calculatePercentage(donations, goal));
	const isFullyFunded = $derived(goal > 0 && donations >= goal);

	function handleKofiClick() {
		window.open('https://ko-fi.com/jaxron', '_blank', 'noopener,noreferrer');
	}
</script>

<section class="funding-section">
	<header class="funding-head">
		<h2 class="popup-section-title">{$_('stats_funding_title')}</h2>
		<span class="funding-percentage">{fundingPercentage}%</span>
	</header>

	<div
		class="funding-bar"
		aria-valuemax="100"
		aria-valuemin="0"
		aria-valuenow={fundingPercentage}
		role="progressbar"
	>
		<div
			style:width="{fundingPercentage}%"
			class="funding-bar-fill"
			class:complete={isFullyFunded}
		></div>
	</div>

	<p class="funding-amounts">
		{#if isFullyFunded}
			{$_('stats_funding_fully_funded', { values: { raised: formatCurrency(donations) } })}
		{:else}
			{$_('stats_funding_raised_of', {
				values: { raised: formatCurrency(donations), goal: formatCurrency(goal) }
			})}
		{/if}
	</p>

	<button class="funding-button" onclick={handleKofiClick} type="button">
		<SiKofi size={14} />
		<span>{$_('stats_funding_support_kofi')}</span>
	</button>
</section>
