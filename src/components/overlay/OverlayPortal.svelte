<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getOverlayContainer } from '@/lib/stores/overlay';

	let { children }: { children: Snippet } = $props();

	function portal(el: HTMLElement) {
		const target = getOverlayContainer() ?? document.body;
		target.appendChild(el);
		el.hidden = false;
		return {
			destroy() {
				el.parentNode?.removeChild(el);
			}
		};
	}
</script>

<div hidden use:portal>
	{@render children()}
</div>
