<script lang="ts">
	interface Props {
		text: string;
	}

	let { text }: Props = $props();
</script>

<span class="help-indicator" aria-label={text} role="img" title={text}>?</span>
