<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { _ } from 'svelte-i18n';
	import { createAbortableBatch } from '@/lib/utils/api/abortable-batch';
	import { getAssetUrl } from '@/lib/utils/assets';
	import { logger } from '@/lib/utils/logging/logger';
	import StatusIcon from '@/components/icons/StatusIcon.svelte';
	import type { StatusIconName } from '@/lib/utils/icon-mapping';
	import type { ScanCategory, ScanCounts } from '@/lib/services/rotector/scan-jobs';

	interface Props {
		scan: (onProgress: (pct: number) => void, signal: AbortSignal) => Promise<ScanCounts>;
		label: string;
	}

	interface CategoryConfig {
		labelKey: string;
		icon: StatusIconName;
		color: string;
	}

	const CATEGORIES: Record<ScanCategory, CategoryConfig> = {
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

	const CATEGORY_ORDER = Object.keys(CATEGORIES) as ScanCategory[];

	let { scan, label }: Props = $props();

	let phase = $state<'scanning' | 'complete' | 'error'>('scanning');
	let progress = $state(0);
	let counts = new SvelteMap<ScanCategory, number>();
	const scanBatch = createAbortableBatch();

	const totalCount = $derived.by(() => [...counts.values()].reduce((s, n) => s + n, 0));

	$effect(() => {
		void startScan();
		return () => scanBatch.abort();
	});

	async function startScan() {
		const signal = scanBatch.nextSignal();

		phase = 'scanning';
		progress = 0;
		counts.clear();

		try {
			const result = await scan((pct) => {
				progress = pct;
			}, signal);
			for (const [k, v] of result) counts.set(k, v);
			progress = 100;
			phase = 'complete';
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			logger.error(`Scan failed (${label})`, err);
			phase = 'error';
		}
	}
</script>

{#if phase === 'scanning'}
	<span class="rotector-scan-progress-wrapper">
		<img alt="" height="14" src={getAssetUrl('/icon/16.png')} width="14" />
		<span
			class="rotector-scan-progress"
			aria-label={$_('scan_progress_aria')}
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
		{#if totalCount === 0}
			<span class="rotector-scan-chip rotector-scan-chip-empty">
				{$_('scan_complete_empty')}
			</span>
		{:else}
			<span class="rotector-scan-bar">
				{#each CATEGORY_ORDER as key (key)}
					{@const count = counts.get(key) ?? 0}
					{#if count > 0}
						<span
							style:background-color={CATEGORIES[key].color}
							style:width="{(count / totalCount) * 100}%"
							class="rotector-scan-segment"
						></span>
					{/if}
				{/each}
			</span>
			<span class="rotector-scan-chips" aria-label={$_('scan_summary_aria')} role="group">
				{#each CATEGORY_ORDER as key (key)}
					{@const count = counts.get(key) ?? 0}
					{#if count > 0}
						<span
							style:color={CATEGORIES[key].color}
							class="rotector-scan-chip"
							aria-label={$_('scan_chip_aria', {
								values: { count, label: $_(CATEGORIES[key].labelKey) }
							})}
							title={$_(CATEGORIES[key].labelKey)}
						>
							<StatusIcon
								name={CATEGORIES[key].icon}
								color={CATEGORIES[key].color}
								size={13}
								strokeWidth={2.5}
							/>
							{count}
						</span>
					{/if}
				{/each}
			</span>
		{/if}
	</span>
{:else if phase === 'error'}
	<span class="rotector-scan-error" role="alert">
		{$_('scan_error_retry')}
		<button class="rotector-scan-retry" onclick={() => void startScan()} type="button">
			{$_('scan_error_retry_action')}
		</button>
	</span>
{/if}
