<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		description: string;
		active: boolean;
		disabled?: boolean;
		onclick?: () => void;
		icon?: Snippet;
	}

	let { label, description, active, disabled = false, onclick, icon }: Props = $props();
</script>

<button
	class="preset-card"
	class:active
	class:disabled
	aria-pressed={active}
	{disabled}
	{onclick}
	type="button"
>
	{#if icon}
		<div class="onboarding-preset-icon">{@render icon()}</div>
		<span class="preset-card-label">{label}</span>
	{:else}
		<span class="preset-card-label-row">
			<span class="preset-card-dot" aria-hidden="true"></span>
			<span class="preset-card-label">{label}</span>
		</span>
	{/if}
	<span class="preset-card-description">{description}</span>
</button>
