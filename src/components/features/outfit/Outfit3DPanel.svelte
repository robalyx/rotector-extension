<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Box, Sun } from '@lucide/svelte';
	import Outfit3DViewer from './Outfit3DViewer.svelte';
	import type { OutfitWithThumbnail } from '@/lib/types/api';
	import type { FlaggedOutfitInfo } from '@/lib/utils/status/violation-formatter';

	interface Props {
		outfit: OutfitWithThumbnail | null;
		flagInfo: FlaggedOutfitInfo | null;
	}

	let { outfit, flagInfo }: Props = $props();

	let brightness = $state(1);
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
			<div class="outfit-meta-stack">
				<div class="outfit-meta">
					<span class="outfit-meta-label">
						{$_('outfit_viewer_caveat_label')}
					</span>
					<p class="outfit-meta-content">
						{$_('outfit_viewer_disclaimer')}
					</p>
				</div>

				<div class="outfit-meta">
					<div class="outfit-meta-label-row">
						<span class="outfit-meta-label">
							{$_('outfit_viewer_reason_label')}
						</span>
						<span class="outfit-meta-confidence">{flagInfo.confidence}%</span>
					</div>
					<p class="outfit-meta-content">{flagInfo.reason}</p>
				</div>
			</div>
		{/if}

		<div class="outfit-viewer-brightness">
			<Sun size={14} />
			<input
				class="outfit-viewer-brightness-slider"
				aria-label={$_('outfit_3d_brightness_aria')}
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
