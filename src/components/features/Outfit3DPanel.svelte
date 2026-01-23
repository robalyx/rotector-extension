<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Box, Sun } from 'lucide-svelte';
	import Outfit3DViewer from '../ui/Outfit3DViewer.svelte';
	import type { OutfitWithThumbnail } from '@/lib/types/api';
	import type { FlaggedOutfitInfo } from '@/lib/utils/violation-formatter';

	interface Props {
		outfit: OutfitWithThumbnail | null;
		flagInfo: FlaggedOutfitInfo | null;
	}

	let { outfit, flagInfo }: Props = $props();

	let brightness = $state(1.0);
</script>

<div class="outfit-viewer-right-panel">
	{#if outfit}
		{#key outfit.id}
			<div class="outfit-viewer-3d-container">
				<Outfit3DViewer {brightness} height={400} outfitId={outfit.id} width={400} />
			</div>
		{/key}

		<span class="outfit-viewer-3d-name">{outfit.name}</span>

		{#if flagInfo}
			<div class="outfit-viewer-flagged-box">
				<div class="outfit-viewer-flagged-reason">{flagInfo.reason}</div>
				<div class="outfit-viewer-flagged-confidence">
					{$_('outfit_viewer_confidence', { values: { 0: flagInfo.confidence.toString() } })}
				</div>
			</div>
		{/if}

		<div class="outfit-viewer-brightness">
			<Sun size={14} />
			<input
				class="outfit-viewer-brightness-slider"
				max="2"
				min="0.3"
				step="0.1"
				type="range"
				bind:value={brightness}
			/>
		</div>

		<p class="outfit-viewer-3d-hint">{$_('outfit_3d_drag_hint')}</p>
	{:else}
		<div class="outfit-viewer-3d-empty">
			<Box size={32} />
			<span>{$_('outfit_viewer_select_outfit')}</span>
		</div>
	{/if}
</div>
