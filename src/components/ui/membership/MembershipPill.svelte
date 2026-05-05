<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { MembershipTier, MembershipTierName } from '@/lib/types/api';
	import { designKey } from '@/lib/utils/membership-designs';
	import MembershipIcon from './MembershipIcon.svelte';

	interface Props {
		tier: MembershipTier;
		tierName: MembershipTierName;
		badgeDesign: number;
		iconDesign: number;
		textDesign: number;
	}

	const TOOLTIP_KEY: Record<MembershipTier, string> = {
		1: 'membership_tooltip_supporter',
		2: 'membership_tooltip_patron',
		3: 'membership_tooltip_benefactor'
	};

	const { tier, tierName, badgeDesign, iconDesign, textDesign }: Props = $props();

	const bodyKey = $derived(designKey(badgeDesign, tier, 'badge'));
	const iconKey = $derived(designKey(iconDesign, tier, 'icon'));
	const textKey = $derived(designKey(textDesign, tier, 'text'));
	const label = $derived(tierName.toUpperCase());
	const tooltipKey = $derived(TOOLTIP_KEY[tier]);
</script>

<span class="membership-pill tier-{tier} body-{bodyKey}" title={$_(tooltipKey)}>
	{#if iconKey !== 'none'}
		<span class="membership-pill-icon">
			<MembershipIcon {iconKey} size={10} />
		</span>
	{/if}
	<span class="membership-pill-label text-{textKey}">{label}</span>
</span>
