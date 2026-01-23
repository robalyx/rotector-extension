<script lang="ts">
	import { AlertTriangle, ChevronDown, ChevronUp, ImageOff } from 'lucide-svelte';
	import LoadingSpinner from '../ui/LoadingSpinner.svelte';
	import View3DButton from '../ui/View3DButton.svelte';
	import type { OutfitWithThumbnail } from '@/lib/types/api';
	import type { FlaggedOutfitInfo } from '@/lib/utils/violation-formatter';

	interface Props {
		outfits: OutfitWithThumbnail[];
		flagInfo: FlaggedOutfitInfo | null;
		onSelect: (outfit: OutfitWithThumbnail) => void;
	}

	let { outfits, flagInfo, onSelect }: Props = $props();

	let isExpanded = $state(false);

	const isStacked = $derived(outfits.length > 1);
	const primaryOutfit = $derived(outfits[0]);
	const isFlagged = $derived(flagInfo !== null);

	function toggleExpand() {
		if (isStacked) {
			isExpanded = !isExpanded;
		}
	}

	function handleSelect(outfit: OutfitWithThumbnail, event: MouseEvent) {
		event.stopPropagation();
		onSelect(outfit);
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
			<View3DButton onclick={(e: MouseEvent) => handleSelect(primaryOutfit, e)} />
		{:else if primaryOutfit.thumbnailState === 'pending'}
			<div class="outfit-stack-thumbnail-pending">
				<LoadingSpinner size="small" />
			</div>
		{:else}
			<div class="outfit-stack-thumbnail-placeholder">
				<ImageOff size={24} />
			</div>
			<View3DButton onclick={(e: MouseEvent) => handleSelect(primaryOutfit, e)} />
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
				<button
					class="outfit-stack-expanded-item"
					onclick={(e) => handleSelect(outfit, e)}
					title={outfit.name}
					type="button"
				>
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
							<ImageOff size={16} />
						</div>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
