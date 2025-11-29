<script lang="ts">
	import { _ } from 'svelte-i18n';
	import {
		Check,
		X,
		ShieldAlert,
		UserX,
		Swords,
		MessageSquareWarning,
		Ban,
		Bug,
		Megaphone,
		Theater,
		FileQuestion
	} from 'lucide-svelte';

	const detectItems = [
		{
			icon: ShieldAlert,
			descKey: 'onboarding_scope_detect_sexual'
		},
		{
			icon: UserX,
			descKey: 'onboarding_scope_detect_predatory'
		}
	];

	const notDetectItems = [
		{
			icon: Swords,
			descKey: 'onboarding_scope_not_detect_violence'
		},
		{
			icon: MessageSquareWarning,
			descKey: 'onboarding_scope_not_detect_hate'
		},
		{
			icon: Ban,
			descKey: 'onboarding_scope_not_detect_harassment'
		},
		{
			icon: Bug,
			descKey: 'onboarding_scope_not_detect_scams'
		},
		{
			icon: Megaphone,
			descKey: 'onboarding_scope_not_detect_spam'
		},
		{
			icon: Theater,
			descKey: 'onboarding_scope_not_detect_impersonation'
		},
		{
			icon: FileQuestion,
			descKey: 'onboarding_scope_not_detect_misinformation'
		}
	];
</script>

<div class="guide-step">
	<h4 class="guide-step-title">{$_('onboarding_scope_title')}</h4>
	<p class="guide-step-description">{$_('onboarding_scope_description')}</p>

	<div class="guide-scope-explanation">
		<p class="guide-scope-explanation-text">{$_('onboarding_scope_explanation')}</p>
	</div>

	<div class="guide-scope-sections">
		<div class="guide-scope-section">
			<div class="guide-scope-heading guide-scope-heading-detect">
				<Check size={18} />
				<span>{$_('onboarding_scope_detect_heading')}</span>
			</div>
			<div class="guide-scope-list">
				{#each detectItems as item (item.descKey)}
					<div class="guide-scope-item">
						<div class="guide-scope-item-icon guide-scope-item-icon-detect">
							<item.icon size={18} />
						</div>
						<span class="guide-scope-item-text">{$_(item.descKey)}</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="guide-scope-section">
			<div class="guide-scope-heading guide-scope-heading-not-detect">
				<X size={18} />
				<span>{$_('onboarding_scope_not_detect_heading')}</span>
			</div>
			<div class="guide-scope-list">
				{#each notDetectItems as item (item.descKey)}
					<div class="guide-scope-item">
						<div class="guide-scope-item-icon guide-scope-item-icon-not-detect">
							<item.icon size={18} />
						</div>
						<span class="guide-scope-item-text">{$_(item.descKey)}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
