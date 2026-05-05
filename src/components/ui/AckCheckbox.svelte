<script lang="ts">
	import { Check } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		checked: boolean;
		variant?: 'default' | 'all' | 'changelog-disable';
		textClass?: string;
		label: Snippet;
		onchange?: (event: Event) => void;
	}

	let {
		checked = $bindable(false),
		variant = 'default',
		textClass = 'queue-ack-text',
		label,
		onchange
	}: Props = $props();

	const itemClass = $derived(
		variant === 'all'
			? 'queue-ack-item-all'
			: variant === 'changelog-disable'
				? 'changelog-modal-disable'
				: 'queue-ack-item'
	);
</script>

<label class={itemClass}>
	<input class="queue-ack-checkbox" {onchange} type="checkbox" bind:checked />
	<span class="queue-ack-checkmark" class:checked>
		{#if checked}
			<Check aria-hidden="true" size={14} strokeWidth={3} />
		{/if}
	</span>
	<span class={textClass}>{@render label()}</span>
</label>
