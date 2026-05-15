<script lang="ts">
	import {
		CircleCheck,
		CircleAlert,
		TriangleAlert,
		Clock,
		LoaderCircle,
		History,
		CircleQuestionMark,
		Lock,
		Ban,
		Plug,
		RefreshCw
	} from '@lucide/svelte';
	import type { StatusIconName } from '@/lib/utils/icon-mapping';

	interface Props {
		name: StatusIconName;
		size?: number | string;
		class?: string;
		color?: string;
		strokeWidth?: number;
	}

	let { name, size = 20, class: className = '', color, strokeWidth = 2 }: Props = $props();

	// Lucide's LucideProps.color is string (not string | undefined), so conditional spread
	// is required under exactOptionalPropertyTypes when color is not provided
	const colorProp = $derived(color === undefined ? {} : { color });

	const ICON_BY_NAME: Partial<Record<StatusIconName, typeof CircleCheck>> = {
		safe: CircleCheck,
		unsafe: CircleAlert,
		error: TriangleAlert,
		pending: Clock,
		queued: Clock,
		checking: Clock,
		loading: LoaderCircle,
		provisional: CircleQuestionMark,
		mixed: CircleQuestionMark,
		'past-offender': History,
		redacted: Lock,
		restricted: Ban,
		integration: Plug,
		unknown: RefreshCw
	};
	const Icon = $derived(ICON_BY_NAME[name]);
</script>

{#if Icon}
	<Icon class={className} {...colorProp} {size} {strokeWidth} />
{:else if name === 'outfit'}
	<svg
		class={className}
		fill="none"
		height={size}
		stroke={color}
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width={strokeWidth}
		viewBox="0 0 24 24"
		width={size}
		xmlns="http://www.w3.org/2000/svg"
	>
		<circle cx="12" cy="12" r="10" stroke-dasharray="4 3" />
		<path d="m9 12 2 2 4-4" />
	</svg>
{/if}
