<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { _ } from 'svelte-i18n';
	import { apiClient } from '@/lib/services/api-client';
	import { fetchAllFriendIds } from '@/lib/services/roblox-friends-api';
	import { getAssetUrl } from '@/lib/utils/assets';
	import { chunkArray } from '@/lib/utils/array';
	import { logger } from '@/lib/utils/logger';
	import { API_CONFIG, LOOKUP_CONTEXT, STATUS } from '@/lib/types/constants';
	import StatusIcon from '@/lib/components/icons/StatusIcon.svelte';
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
			labelKey: 'tooltip_status_not_flagged',
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
	let abortController: AbortController | null = $state(null);

	const totalCount = $derived.by(() => {
		let sum = 0;
		for (const count of counts.values()) {
			sum += count;
		}
		return sum;
	});

	// Auto-scan on mount, abort on cleanup
	$effect(() => {
		void startScan();
		return () => {
			abortController?.abort();
		};
	});

	function flagToCategory(flagType: number): string {
		switch (flagType) {
			case STATUS.FLAGS.PENDING:
				return 'pending';
			case STATUS.FLAGS.UNSAFE:
				return 'unsafe';
			case STATUS.FLAGS.MIXED:
				return 'mixed';
			case STATUS.FLAGS.PAST_OFFENDER:
				return 'past';
			default:
				return 'safe';
		}
	}

	function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			if (signal.aborted) {
				reject(new DOMException('Aborted', 'AbortError'));
				return;
			}

			const timer = setTimeout(() => {
				signal.removeEventListener('abort', onAbort);
				resolve();
			}, ms);

			function onAbort() {
				clearTimeout(timer);
				reject(new DOMException('Aborted', 'AbortError'));
			}

			signal.addEventListener('abort', onAbort, { once: true });
		});
	}

	async function startScan() {
		const controller = new AbortController();
		abortController = controller;
		const { signal } = controller;

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

			// Check friend statuses against Rotector API
			progress = 30;
			const chunks = chunkArray(friendIds, API_CONFIG.BATCH_SIZE);

			for (let i = 0; i < chunks.length; i++) {
				if (signal.aborted) {
					throw new DOMException('Aborted', 'AbortError');
				}

				try {
					const statuses = await apiClient.checkMultipleUsers(chunks[i], {
						lookupContext: LOOKUP_CONTEXT.FRIENDS
					});

					for (const status of statuses) {
						const category = flagToCategory(status.flagType);
						counts.set(category, (counts.get(category) ?? 0) + 1);
					}
				} catch (err) {
					if (err instanceof DOMException && err.name === 'AbortError') {
						throw err;
					}
					logger.warn('Friend scan batch failed', { batchIndex: i, error: err });
				}

				progress = 30 + ((i + 1) / chunks.length) * 70;

				if (i < chunks.length - 1) {
					await abortableDelay(API_CONFIG.BATCH_DELAY, signal);
				}
			}

			logger.debug('Friend scan complete', {
				totalFriends: friendIds.length,
				results: Object.fromEntries(counts)
			});
			phase = 'complete';
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') {
				return;
			}
			logger.error('Friend scan failed', err);
			phase = 'error';
		} finally {
			abortController = null;
		}
	}
</script>

{#if phase === 'scanning'}
	<span class="rotector-scan-progress-wrapper">
		<img alt="" height="14" src={getAssetUrl('/icon/16.png')} width="14" />
		<span class="rotector-scan-progress">
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
				<span style:color={config.color} class="rotector-scan-chip" title={$_(config.labelKey)}>
					<StatusIcon name={config.icon} color={config.color} size={13} strokeWidth={2.5} />
					{count}
				</span>
			{/if}
		{/each}
	</span>
{:else if phase === 'error'}
	<span class="rotector-scan-error">
		{$_('friends_scan_error_retry')}
	</span>
{/if}
