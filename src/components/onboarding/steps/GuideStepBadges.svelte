<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Flag, Hourglass, Shirt, Hash } from 'lucide-svelte';

	const badgeTypes = [
		{
			icon: Flag,
			color: '#ff4444',
			nameKey: 'onboarding_badge_reportable',
			descKey: 'onboarding_badge_reportable_desc'
		},
		{
			icon: Hourglass,
			color: '#4f46e5',
			nameKey: 'onboarding_badge_queue',
			descKey: 'onboarding_badge_queue_desc'
		},
		{
			icon: Shirt,
			color: '#a855f7',
			nameKey: 'onboarding_badge_outfit',
			descKey: 'onboarding_badge_outfit_desc'
		},
		{
			icon: Hash,
			color: '#14b8a6',
			nameKey: 'onboarding_badge_integration',
			descKey: 'onboarding_badge_integration_desc'
		}
	];
</script>

<div class="guide-step">
	<h4 class="guide-step-title">{$_('onboarding_badges_title')}</h4>
	<p class="guide-step-description">{$_('onboarding_badges_description')}</p>

	<div class="guide-badges-grid">
		{#each badgeTypes as badge (badge.nameKey)}
			<div class="guide-badge-item">
				<div style:background-color={badge.color} class="guide-badge-icon">
					<badge.icon color="white" size={14} />
				</div>
				<div class="guide-badge-info">
					<span class="guide-badge-name">{$_(badge.nameKey)}</span>
					<span class="guide-badge-desc">{$_(badge.descKey)}</span>
				</div>
			</div>
		{/each}
	</div>
</div>
