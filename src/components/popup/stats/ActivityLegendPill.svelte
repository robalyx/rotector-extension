<script lang="ts">
	interface Props {
		color: string;
		label: string;
		value: string;
		visible: boolean;
		onclick: () => void;
	}

	let { color, label, value, visible, onclick }: Props = $props();
</script>

<button
	class="activity-legend-pill"
	class:inactive={!visible}
	aria-pressed={visible}
	{onclick}
	type="button"
>
	<span style:background-color={color} class="activity-legend-dot" aria-hidden="true"></span>
	<span class="activity-legend-label">{label}</span>
	<span class="activity-legend-value">{value}</span>
</button>
