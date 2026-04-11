<script lang="ts">
	interface Props {
		label: string;
		description: string;
		active: boolean;
		disabled?: boolean;
		onclick?: () => void;
	}

	let { label, description, active, disabled = false, onclick }: Props = $props();
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
	<span class="preset-card-label-row">
		<span class="preset-card-dot" aria-hidden="true"></span>
		<span class="preset-card-label">{label}</span>
	</span>
	<span class="preset-card-description">{description}</span>
</button>
