<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';

	interface Props {
		currentPage: number;
		canGoBack: boolean;
		canGoForward: boolean;
		disabled?: boolean;
		iconSize?: number;
		prevLabelKey: string;
		nextLabelKey: string;
		pageInfoKey: string;
		onChange: (page: number) => void;
	}

	let {
		currentPage,
		canGoBack,
		canGoForward,
		disabled = false,
		iconSize = 16,
		prevLabelKey,
		nextLabelKey,
		pageInfoKey,
		onChange
	}: Props = $props();
</script>

<button
	class="outfit-pagination-btn"
	class:outfit-pagination-btn-disabled={!canGoBack}
	aria-label={$_(prevLabelKey)}
	disabled={!canGoBack || disabled}
	onclick={() => onChange(currentPage - 1)}
	type="button"
>
	<ChevronLeft size={iconSize} />
</button>

<span class="outfit-pagination-info">
	{$_(pageInfoKey, { values: { 0: currentPage.toString() } })}
</span>

<button
	class="outfit-pagination-btn"
	class:outfit-pagination-btn-disabled={!canGoForward}
	aria-label={$_(nextLabelKey)}
	disabled={!canGoForward || disabled}
	onclick={() => onChange(currentPage + 1)}
	type="button"
>
	<ChevronRight size={iconSize} />
</button>
