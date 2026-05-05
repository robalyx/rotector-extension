<script lang="ts">
	import HelpIndicator from './HelpIndicator.svelte';

	interface Props {
		label: string;
		value: number;
		min?: number | undefined;
		max?: number | undefined;
		step?: number | undefined;
		helpText?: string | undefined;
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

	function handleInput(event: Event) {
		if (!(event.target instanceof HTMLInputElement)) return;
		const parsed = parseInt(event.target.value, 10);
		const newValue = Math.max(min, Math.min(max, isNaN(parsed) ? min : parsed));
		value = newValue;
		onChange(newValue);
	}

	function handleBlur(event: FocusEvent) {
		if (!(event.target instanceof HTMLInputElement)) return;
		if (parseInt(event.target.value, 10) !== value) {
			event.target.value = String(value);
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
			aria-label={label}
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
