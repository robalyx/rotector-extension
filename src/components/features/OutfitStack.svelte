<script lang="ts">
	import { Shirt, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-svelte';
	import LoadingSpinner from '../ui/LoadingSpinner.svelte';
	import type { OutfitWithThumbnail } from '@/lib/types/api';
	import type { FlaggedOutfitInfo } from '@/lib/utils/violation-formatter';

	interface Props {
		outfits: OutfitWithThumbnail[];
		flagInfo: FlaggedOutfitInfo | null;
	}

	let { outfits, flagInfo }: Props = $props();

	let isExpanded = $state(false);

	const isStacked = $derived(outfits.length > 1);
	const primaryOutfit = $derived(outfits[0]);
	const isFlagged = $derived(flagInfo !== null);

	function toggleExpand() {
		if (isStacked) {
			isExpanded = !isExpanded;
		}
	}
</script>

<div class="outfit-stack-container" aria-label={primaryOutfit.name} role="group">
	<!-- Primary outfit card -->
	<button
		class="outfit-stack-primary"
		class:outfit-stack-item-flagged={isFlagged}
		class:outfit-stack-primary-clickable={isStacked}
		aria-expanded={isStacked ? isExpanded : undefined}
		onclick={toggleExpand}
		type="button"
	>
		{#if primaryOutfit.thumbnailUrl}
			<img
				class="outfit-stack-thumbnail"
				alt={primaryOutfit.name}
				loading="lazy"
				src={primaryOutfit.thumbnailUrl}
			/>
		{:else if primaryOutfit.thumbnailState === 'pending'}
			<div class="outfit-stack-thumbnail-pending">
				<LoadingSpinner size="small" />
			</div>
		{:else}
			<div class="outfit-stack-thumbnail-placeholder">
				<Shirt size={24} />
			</div>
		{/if}

		{#if isFlagged}
			<div class="outfit-stack-flagged-indicator">
				<AlertTriangle size={10} />
			</div>
		{/if}

		{#if isStacked}
			<div class="outfit-stack-count-badge">
				{outfits.length}
				{#if isExpanded}
					<ChevronUp size={10} />
				{:else}
					<ChevronDown size={10} />
				{/if}
			</div>
		{/if}
	</button>

	<span class="outfit-stack-name" title={primaryOutfit.name}>{primaryOutfit.name}</span>

	<!-- Expanded view showing all outfits -->
	{#if isExpanded && isStacked}
		<div class="outfit-stack-expanded">
			{#each outfits.slice(1) as outfit (outfit.id)}
				<div class="outfit-stack-expanded-item">
					{#if outfit.thumbnailUrl}
						<img
							class="outfit-stack-thumbnail"
							alt={outfit.name}
							loading="lazy"
							src={outfit.thumbnailUrl}
						/>
					{:else if outfit.thumbnailState === 'pending'}
						<div class="outfit-stack-thumbnail-pending">
							<LoadingSpinner size="small" />
						</div>
					{:else}
						<div class="outfit-stack-thumbnail-placeholder">
							<Shirt size={16} />
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
