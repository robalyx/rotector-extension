<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		status?: string;
		children: Snippet;
	}

	let { title, status, children }: Props = $props();
</script>

<section class="popup-section">
	<header class="popup-section-head">
		<h2 class="popup-section-title">{title}</h2>
		{#if status}
			<span class="popup-section-status">{status}</span>
		{/if}
	</header>
	<div class="popup-section-body">
		{@render children()}
	</div>
</section>
