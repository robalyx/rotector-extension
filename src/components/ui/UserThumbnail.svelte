<script lang="ts">
	interface Props {
		src: string | null | undefined;
		lazy?: boolean;
	}

	let { src, lazy = false }: Props = $props();
</script>

{#if src}
	<img alt="" loading={lazy ? 'lazy' : 'eager'} {src} />
{/if}
