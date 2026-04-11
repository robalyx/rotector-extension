<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Flag, Hourglass, Hash } from '@lucide/svelte';

	const badgeTypes = [
		{
			icon: Flag,
			color: 'var(--color-status-unsafe)',
			nameKey: 'onboarding_badge_reportable',
			descKey: 'onboarding_badge_reportable_desc'
		},
		{
			icon: Hourglass,
			color: 'var(--color-status-queued)',
			nameKey: 'onboarding_badge_queue',
			descKey: 'onboarding_badge_queue_desc'
		},
		{
			icon: Hash,
			color: 'var(--color-status-integration)',
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
