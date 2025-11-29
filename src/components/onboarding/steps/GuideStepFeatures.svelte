<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Info, ListPlus, Vote, ChevronDown } from 'lucide-svelte';
	import { getAssetUrl } from '@/lib/utils/assets';

	const features = [
		{
			icon: Info,
			color: '#3b82f6',
			titleKey: 'onboarding_feature_tooltips_title',
			descKey: 'onboarding_feature_tooltips_desc',
			images: [getAssetUrl('/assets/onboarding/feature-tooltips.webp')]
		},
		{
			icon: ListPlus,
			color: '#f97316',
			titleKey: 'onboarding_feature_queue_title',
			descKey: 'onboarding_feature_queue_desc',
			images: [
				getAssetUrl('/assets/onboarding/feature-queue-tooltip.webp'),
				getAssetUrl('/assets/onboarding/feature-queue-modal.webp')
			]
		},
		{
			icon: Vote,
			color: '#22c55e',
			titleKey: 'onboarding_feature_voting_title',
			descKey: 'onboarding_feature_voting_desc',
			images: [getAssetUrl('/assets/onboarding/feature-voting.webp')]
		}
	];

	let expandedIndex = $state<number | null>(null);

	// Toggle accordion expansion for a feature
	function toggleFeature(index: number) {
		expandedIndex = expandedIndex === index ? null : index;
	}
</script>

<div class="guide-step">
	<h4 class="guide-step-title">{$_('onboarding_features_title')}</h4>
	<p class="guide-step-description">{$_('onboarding_features_description')}</p>

	<div class="guide-features-list">
		{#each features as feature, index (feature.titleKey)}
			<div class="guide-feature-card">
				<button class="guide-feature-header" onclick={() => toggleFeature(index)} type="button">
					<div style:background-color={feature.color} class="guide-feature-icon">
						<feature.icon color="white" size={20} />
					</div>
					<div class="guide-feature-info">
						<span class="guide-feature-title">{$_(feature.titleKey)}</span>
						<span class="guide-feature-desc">{$_(feature.descKey)}</span>
					</div>
					<ChevronDown
						class="guide-feature-chevron {expandedIndex === index ? 'expanded' : ''}"
						size={20}
					/>
				</button>
				{#if expandedIndex === index}
					<div class="guide-feature-images">
						{#each feature.images as image, i (i)}
							<img alt={$_(feature.titleKey)} src={image} />
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>
