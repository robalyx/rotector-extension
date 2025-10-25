<script lang="ts">
	import HelpIndicator from './HelpIndicator.svelte';

	interface Props {
		label: string;
		value: number;
		min?: number;
		max?: number;
		step?: number;
		helpText?: string;
		onChange: (value: number) => void;
	}

	let {
		label,
		value = $bindable(),
		min = 1,
		max = 100,
		step = 1,
		helpText,
		onChange
	}: Props = $props();

	// Handle input changes
	function handleInput(event: Event) {
		if (!(event.target instanceof HTMLInputElement)) return;
		const target = event.target;
		let newValue = parseInt(target.value, 10);

		// Validate and clamp value
		if (isNaN(newValue)) {
			newValue = min;
		} else if (newValue < min) {
			newValue = min;
		} else if (newValue > max) {
			newValue = max;
		}

		value = newValue;
		onChange(newValue);
	}

	// Handle blur to ensure valid value
	function handleBlur(event: FocusEvent) {
		if (!(event.target instanceof HTMLInputElement)) return;
		const target = event.target;
		if (!target.value || isNaN(parseInt(target.value, 10))) {
			target.value = String(value);
		}
	}
</script>

<div class="number-input-container">
	<div class="number-input-label">
		<span>{label}</span>
		{#if helpText}
			<HelpIndicator text={helpText} />
		{/if}
	</div>
	<div class="number-input-wrapper">
		<input
			class="number-input"
			{max}
			{min}
			onblur={handleBlur}
			oninput={handleInput}
			{step}
			type="number"
			{value}
		/>
		<span class="number-input-range">({min}-{max})</span>
	</div>
</div>
