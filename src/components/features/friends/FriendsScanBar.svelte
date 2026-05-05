<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { _ } from 'svelte-i18n';
	import { fetchAllFriendIds } from '@/lib/services/roblox/friends';
	import { queryMultipleUsers } from '@/lib/services/rotector/unified-query';
	import { ROTECTOR_API_ID } from '@/lib/stores/custom-apis';
	import { createAbortableBatch } from '@/lib/utils/api/abortable-batch';
	import { getAssetUrl } from '@/lib/utils/assets';
	import { logger } from '@/lib/utils/logging/logger';
	import { LOOKUP_CONTEXT, STATUS } from '@/lib/types/constants';
	import StatusIcon from '@/components/icons/StatusIcon.svelte';
	import type { StatusIconName } from '@/lib/utils/icon-mapping';

	interface Props {
		userId: string;
	}

	interface CategoryConfig {
		labelKey: string;
		icon: StatusIconName;
		color: string;
	}

	const CATEGORIES: Record<string, CategoryConfig> = {
		safe: {
			labelKey: 'tooltip_status_not_checked',
			icon: 'safe',
			color: 'var(--color-status-safe)'
		},
		pending: {
			labelKey: 'tooltip_status_under_review',
			icon: 'pending',
			color: 'var(--color-status-pending)'
		},
		unsafe: {
			labelKey: 'tooltip_status_unsafe',
			icon: 'unsafe',
			color: 'var(--color-status-unsafe)'
		},
		mixed: { labelKey: 'tooltip_status_mixed', icon: 'mixed', color: 'var(--color-status-mixed)' },
		past: {
			labelKey: 'tooltip_status_past_offender',
			icon: 'past-offender',
			color: 'var(--color-status-past-offender)'
		}
	};

	let { userId }: Props = $props();

	let phase = $state<'scanning' | 'complete' | 'error'>('scanning');
	let progress = $state(0);
	let counts = new SvelteMap<string, number>();
	const scanBatch = createAbortableBatch();

	const totalCount = $derived.by(() => [...counts.values()].reduce((s, n) => s + n, 0));

	// Auto-scan on mount, abort on cleanup
	$effect(() => {
		void startScan();
		return () => scanBatch.abort();
	});

	function flagToCategory(flagType: number): string {
		switch (flagType) {
			case STATUS.FLAGS.PENDING:
				return 'pending';
			case STATUS.FLAGS.UNSAFE:
			case STATUS.FLAGS.REDACTED:
				return 'unsafe';
			case STATUS.FLAGS.MIXED:
				return 'mixed';
			case STATUS.FLAGS.PAST_OFFENDER:
				return 'past';
			default:
				return 'safe';
		}
	}

	async function startScan() {
		const signal = scanBatch.nextSignal();

		phase = 'scanning';
		progress = 0;
		counts.clear();

		try {
			// Fetch all friend IDs via paginated Roblox API
			const friendIds = await fetchAllFriendIds(
				userId,
				(fetched) => {
					progress = Math.min(fetched * 0.15, 30);
				},
				signal
			);

			if (friendIds.length === 0) {
				phase = 'complete';
				return;
			}

			// Route through unified query so the shared user-status cache warms for the friends list tiles that follow
			progress = 30;
			const results = await queryMultipleUsers(
				friendIds.map((id) => id.toString()),
				{ lookupContext: LOOKUP_CONTEXT.FRIENDS, signal }
			);
			progress = 80;

			for (const combined of results.values()) {
				const rotectorEntry = combined.get(ROTECTOR_API_ID);
				const flagType = rotectorEntry?.data?.flagType;
				if (flagType === undefined) continue;
				const category = flagToCategory(flagType);
				counts.set(category, (counts.get(category) ?? 0) + 1);
			}

			progress = 100;
			phase = 'complete';
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') {
				return;
			}
			logger.error('Friend scan failed', err);
			phase = 'error';
		}
	}
</script>

{#if phase === 'scanning'}
	<span class="rotector-scan-progress-wrapper">
		<img alt="" height="14" src={getAssetUrl('/icon/16.png')} width="14" />
		<span
			class="rotector-scan-progress"
			aria-label={$_('friends_scan_progress_aria')}
			aria-valuemax="100"
			aria-valuemin="0"
			aria-valuenow={Math.round(progress)}
			role="progressbar"
		>
			<span style:width="{Math.round(progress)}%" class="rotector-scan-progress-fill"></span>
		</span>
		<span class="rotector-scan-progress-text">{Math.round(progress)}%</span>
	</span>
{:else if phase === 'complete'}
	<span class="rotector-scan-results">
		<img alt="" height="14" src={getAssetUrl('/icon/16.png')} width="14" />
		<span class="rotector-scan-bar">
			{#each Object.entries(CATEGORIES) as [key, config] (key)}
				{@const count = counts.get(key) ?? 0}
				{#if count > 0}
					<span
						style:background-color={config.color}
						style:width="{(count / totalCount) * 100}%"
						class="rotector-scan-segment"
					></span>
				{/if}
			{/each}
		</span>
		{#each Object.entries(CATEGORIES) as [key, config] (key)}
			{@const count = counts.get(key) ?? 0}
			{#if count > 0}
				<span
					style:color={config.color}
					class="rotector-scan-chip"
					aria-label={$_('friends_scan_chip_aria', {
						values: { count, label: $_(config.labelKey) }
					})}
					title={$_(config.labelKey)}
				>
					<StatusIcon name={config.icon} color={config.color} size={13} strokeWidth={2.5} />
					{count}
				</span>
			{/if}
		{/each}
	</span>
{:else if phase === 'error'}
	<span class="rotector-scan-error" role="alert">
		{$_('friends_scan_error_retry')}
	</span>
{/if}
