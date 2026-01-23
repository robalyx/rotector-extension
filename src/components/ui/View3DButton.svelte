<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Box } from 'lucide-svelte';

	interface Props {
		onclick: (event: MouseEvent) => void;
	}

	let { onclick }: Props = $props();
</script>

<button class="view-3d-button" {onclick} title={$_('outfit_3d_view_button')} type="button">
	<Box size={12} />
</button>
