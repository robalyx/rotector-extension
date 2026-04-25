<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { QueueHistoryEntry } from '@/lib/types/queue-history';
	import { TriangleAlert, CircleCheckBig, Clock, ExternalLink, Loader, X } from '@lucide/svelte';

	interface Props {
		entry: QueueHistoryEntry;
		variant: 'processing' | 'flagged' | 'safe';
		timeText: string;
		onView: (userId: number) => void;
		onRemove: (userId: number) => void;
	}

	let { entry, variant, timeText, onView, onRemove }: Props = $props();
</script>

<div
	class="queue-row"
	class:queue-row-flagged={variant === 'flagged'}
	class:queue-row-processing={variant === 'processing'}
	class:queue-row-safe={variant === 'safe'}
>
	<span class="queue-row-icon" aria-hidden="true">
		{#if variant === 'processing'}
			{#if entry.processing}
				<Loader class="queue-icon-spin" size={14} strokeWidth={2.25} />
			{:else}
				<Clock size={14} strokeWidth={2.25} />
			{/if}
		{:else if variant === 'flagged'}
			<TriangleAlert size={14} strokeWidth={2.25} />
		{:else}
			<CircleCheckBig size={14} strokeWidth={2.25} />
		{/if}
	</span>

	<div class="queue-row-body">
		<div class="queue-row-id">{entry.userId}</div>
		<div class="queue-row-time">{timeText}</div>
	</div>

	<div class="queue-row-actions">
		<button
			class="queue-row-action"
			aria-label={$_('queue_history_view_profile')}
			onclick={() => onView(entry.userId)}
			title={$_('queue_history_view_profile')}
			type="button"
		>
			<ExternalLink size={13} strokeWidth={2.25} />
		</button>
		<button
			class="queue-row-action queue-row-action-remove"
			aria-label={$_('queue_history_remove')}
			onclick={() => onRemove(entry.userId)}
			title={$_('queue_history_remove')}
			type="button"
		>
			<X size={13} strokeWidth={2.5} />
		</button>
	</div>
</div>
