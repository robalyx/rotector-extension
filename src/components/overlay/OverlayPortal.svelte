<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getOverlayContainer } from '@/lib/utils/overlay-portal-registry';

	let { children }: { children: Snippet } = $props();

	function portal(el: HTMLElement) {
		const target = getOverlayContainer() ?? document.body;
		target.append(el);
		el.hidden = false;
		return {
			destroy() {
				el.remove();
			}
		};
	}
</script>

<div hidden use:portal>
	{@render children()}
</div>
