<script lang="ts">
	import {
		CircleCheck,
		AlertCircle,
		AlertTriangle,
		Clock,
		Loader2,
		Workflow,
		History,
		CircleHelp,
		Ban
	} from 'lucide-svelte';
	import type { StatusIconName } from '@/lib/utils/icon-mapping';

	interface Props {
		name: StatusIconName;
		size?: number | string;
		class?: string;
		color?: string;
		strokeWidth?: number;
	}

	let { name, size = 20, class: className = '', color, strokeWidth = 2 }: Props = $props();
</script>

{#if name === 'safe'}
	<CircleCheck class={className} {color} {size} {strokeWidth} />
{:else if name === 'unsafe'}
	<AlertCircle class={className} {color} {size} {strokeWidth} />
{:else if name === 'error'}
	<AlertTriangle class={className} {color} {size} {strokeWidth} />
{:else if name === 'pending' || name === 'queued' || name === 'checking'}
	<Clock class={className} {color} {size} {strokeWidth} />
{:else if name === 'loading'}
	<Loader2 class={className} {color} {size} {strokeWidth} />
{:else if name === 'integration'}
	<Workflow class={className} {color} {size} {strokeWidth} />
{:else if name === 'past-offender'}
	<History class={className} {color} {size} {strokeWidth} />
{:else if name === 'mixed'}
	<CircleHelp class={className} {color} {size} {strokeWidth} />
{:else if name === 'restricted'}
	<Ban class={className} {color} {size} {strokeWidth} />
{:else if name === 'outfit'}
	<!-- Dashed circle with checkmark -->
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
