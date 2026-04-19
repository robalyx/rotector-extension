<script lang="ts">
	import { Loader2 } from '@lucide/svelte';

	interface Props {
		checked: boolean;
		disabled?: boolean;
		loading?: boolean;
		onchange: (checked: boolean) => void;
	}

	let { checked, disabled = false, loading = false, onchange }: Props = $props();

	function handleChange(event: Event) {
		if (!(event.target instanceof HTMLInputElement)) {
			return;
		}
		onchange(event.target.checked);
	}
</script>

<label class="toggle-container" class:loading aria-busy={loading}>
	<input
		name="toggle"
		class="
	        peer size-0 opacity-0
	        focus:outline-none
	      "
		{checked}
		disabled={disabled || loading}
		onchange={handleChange}
		type="checkbox"
	/>
	<span class="toggle-switch" class:checked class:disabled class:loading>
		<span class="toggle-handle" class:checked class:disabled class:loading>
			{#if loading}
				<Loader2 class="toggle-spinner" size={10} />
			{/if}
		</span>
	</span>
</label>
