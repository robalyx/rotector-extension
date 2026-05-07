<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { QueueHistoryEntry } from '@/lib/types/queue-history';
	import type { UserInfo } from '@/lib/services/roblox/users';
	import { ExternalLink, X } from '@lucide/svelte';

	interface Props {
		entry: QueueHistoryEntry;
		variant: 'processing' | 'flagged' | 'safe';
		timeText: string;
		userInfo: UserInfo | null | undefined;
		onView: (userId: number) => void;
		onRemove: (userId: number) => void;
	}

	let { entry, variant, timeText, userInfo, onView, onRemove }: Props = $props();
</script>

<div class="queue-row">
	<button
		class="queue-row-identity"
		aria-label={userInfo === undefined ? $_('queue_history_view_profile') : undefined}
		onclick={() => onView(entry.userId)}
		title={`User ID: ${String(entry.userId)}`}
		type="button"
	>
		<span
			class="queue-row-avatar"
			class:queue-row-avatar-flagged={variant === 'flagged'}
			class:queue-row-avatar-processing={variant === 'processing'}
			class:queue-row-avatar-safe={variant === 'safe'}
		>
			{#if userInfo?.thumbnailUrl}
				<img alt="" loading="lazy" src={userInfo.thumbnailUrl} />
			{/if}
		</span>

		<span class="queue-row-body">
			{#if userInfo === undefined}
				<span class="queue-row-skeleton-name" aria-hidden="true"></span>
				<span class="queue-row-skeleton-meta" aria-hidden="true"></span>
			{:else if userInfo === null}
				<span class="queue-row-name">{$_('queue_history_user_unknown')}</span>
				<span class="queue-row-meta">{timeText}</span>
			{:else}
				<span class="queue-row-name">{userInfo.displayName || userInfo.username}</span>
				<span class="queue-row-meta">@{userInfo.username} · {timeText}</span>
			{/if}
		</span>
	</button>

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
