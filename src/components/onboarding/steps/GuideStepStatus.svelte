<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { CircleCheck, AlertCircle, Clock, History, CircleHelp } from 'lucide-svelte';

	const statusTypes = [
		{
			icon: CircleCheck,
			color: '#888888',
			nameKey: 'onboarding_status_not_flagged',
			descKey: 'onboarding_status_not_flagged_desc'
		},
		{
			icon: Clock,
			color: '#f97316',
			nameKey: 'onboarding_status_pending',
			descKey: 'onboarding_status_pending_desc'
		},
		{
			icon: AlertCircle,
			color: '#ff4444',
			nameKey: 'onboarding_status_unsafe',
			descKey: 'onboarding_status_unsafe_desc'
		},
		{
			icon: Clock,
			color: '#999999',
			nameKey: 'onboarding_status_queued',
			descKey: 'onboarding_status_queued_desc'
		},
		{
			icon: CircleHelp,
			color: '#eab308',
			nameKey: 'onboarding_status_mixed',
			descKey: 'onboarding_status_mixed_desc'
		},
		{
			icon: History,
			color: '#4a9eff',
			nameKey: 'onboarding_status_past_offender',
			descKey: 'onboarding_status_past_offender_desc'
		}
	];
</script>

<div class="guide-step">
	<h4 class="guide-step-title">{$_('onboarding_status_title')}</h4>
	<p class="guide-step-description">{$_('onboarding_status_description')}</p>

	<div class="guide-status-grid">
		{#each statusTypes as status (status.nameKey)}
			<div class="guide-status-item">
				<div style:color={status.color} class="guide-status-icon">
					<status.icon size={24} />
				</div>
				<div class="guide-status-info">
					<span class="guide-status-name">{$_(status.nameKey)}</span>
					<span class="guide-status-desc">{$_(status.descKey)}</span>
				</div>
			</div>
		{/each}
	</div>
</div>
