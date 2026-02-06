<script lang="ts">
	interface Props {
		size?: number;
	}

	let { size = 24 }: Props = $props();
</script>

<svg
	aria-hidden="true"
	fill="currentColor"
	height={size}
	viewBox="0 0 234.01 210.01"
	width={size}
	xmlns="http://www.w3.org/2000/svg"
>
	<path d="M36.3 32.67 0 173.71 141.05 210l36.3-141zm81.51 138-78.47-20.19L59.53 72 138 92.2z" />
	<path d="M93 0 56.67 141.05l141 36.3L234 36.3zm81.51 138L96 117.81l20.2-78.47 78.47 20.19z" />
</svg>
