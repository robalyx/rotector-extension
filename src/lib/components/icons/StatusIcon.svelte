<script lang="ts">
	import {
		CircleCheck,
		AlertCircle,
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

{#if name === 'safe' || name === 'likely-safe'}
	<CircleCheck class={className} {color} {size} {strokeWidth} />
{:else if name === 'unsafe' || name === 'error'}
	<AlertCircle class={className} {color} {size} {strokeWidth} />
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
{/if}
