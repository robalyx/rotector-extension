<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		href: string;
		class?: string;
		title?: string;
		'aria-label'?: string;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
	}

	let {
		href,
		class: className,
		title,
		'aria-label': ariaLabel,
		onclick,
		children
	}: Props = $props();
</script>

<a
	class={className}
	aria-label={ariaLabel}
	{href}
	{onclick}
	rel="noopener noreferrer"
	target="_blank"
	{title}
>
	{@render children()}
</a>
