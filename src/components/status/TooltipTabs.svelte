<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import LoadingSpinner from '../ui/LoadingSpinner.svelte';
	import { logger } from '@/lib/utils/logging/logger';
	import { updateSetting } from '@/lib/stores/settings';

	export interface TabInfo {
		id: string;
		name: string;
		loading: boolean;
		error: boolean;
		noData: boolean;
		landscapeImageDataUrl: string | undefined;
	}

	interface Props {
		tabs: TabInfo[];
		activeTab: string;
	}

	let { tabs, activeTab = $bindable() }: Props = $props();

	function selectTab(id: string) {
		activeTab = id;
		updateSetting('lastSelectedCustomApiTab', id).catch((error: unknown) => {
			logger.error('Failed to save tab preference:', error);
		});
	}
</script>

{#if tabs.length > 1}
	<div class="tooltip-tabs">
		{#each tabs as tab (tab.id)}
			{@const hasImage = !!tab.landscapeImageDataUrl}
			<button
				class="tooltip-tab"
				class:active={activeTab === tab.id}
				class:error={!hasImage && tab.error}
				class:loading={!hasImage && tab.loading}
				class:no-data={!hasImage && tab.noData}
				class:tooltipTabHasImage={hasImage}
				onclick={(e) => {
					e.stopPropagation();
					selectTab(tab.id);
				}}
				title={tab.name}
				type="button"
			>
				{#if hasImage}
					<img
						class="tooltip-tab-image"
						alt={tab.name}
						onerror={(e) => {
							if (!(e.currentTarget instanceof HTMLImageElement)) return;
							e.currentTarget.style.display = 'none';
							const textSpan = e.currentTarget.nextElementSibling;
							if (textSpan instanceof HTMLElement) {
								textSpan.style.display = 'inline';
							}
						}}
						src={tab.landscapeImageDataUrl}
					/>
					<span class="tooltip-tab-name tooltip-tab-name-fallback">{tab.name}</span>
				{:else}
					<span class="tooltip-tab-name">{tab.name}</span>
					{#if tab.loading}
						<LoadingSpinner size="small" />
					{:else if tab.error}
						<CircleAlert class="tooltip-tab-error-indicator" size={12} />
					{/if}
				{/if}
			</button>
		{/each}
	</div>
{/if}
