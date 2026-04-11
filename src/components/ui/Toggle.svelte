<script lang="ts">
	interface Props {
		checked: boolean;
		disabled?: boolean;
		onchange: (checked: boolean) => void;
	}

	let { checked = $bindable(), disabled = false, onchange }: Props = $props();

	function handleChange(event: Event) {
		if (!(event.target instanceof HTMLInputElement)) {
			return;
		}
		checked = event.target.checked;
		onchange(checked);
	}
</script>

<label class="toggle-container">
	<input
		name="toggle"
		class="
	        peer size-0 opacity-0
	        focus:outline-none
	      "
		{checked}
		{disabled}
		onchange={handleChange}
		type="checkbox"
	/>
	<span class="toggle-switch" class:checked class:disabled>
		<span class="toggle-handle" class:checked class:disabled></span>
	</span>
</label>
