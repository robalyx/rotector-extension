<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { SvelteMap } from 'svelte/reactivity';
	import {
		getUserOutfits,
		THUMBNAIL_RETRY_DELAY,
		VIEWER_ITEMS_PER_PAGE
	} from '@/lib/services/roblox/api';
	import { retryPendingOutfitThumbnails } from '@/lib/services/roblox/outfit-thumbnail-retry';
	import { logger } from '@/lib/utils/logging/logger';
	import { CircleAlert, Shirt } from '@lucide/svelte';
	import AppLogo from '../../ui/AppLogo.svelte';
	import Modal from '../../ui/Modal.svelte';
	import OutfitStack from './OutfitStack.svelte';
	import Outfit3DPanel from './Outfit3DPanel.svelte';
	import OutfitPaginator from './OutfitPaginator.svelte';
	import type { OutfitWithThumbnail } from '@/lib/types/api';
	import type { FlaggedOutfitInfo } from '@/lib/utils/status/violation-formatter';

	interface Props {
		userId: string;
		flaggedOutfits: FlaggedOutfitInfo[];
		onClose: () => void;
	}

	let { userId, flaggedOutfits, onClose }: Props = $props();

	let allOutfits = $state<OutfitWithThumbnail[]>([]);
	let isLoading = $state(false);
	let hasError = $state(false);
	let currentPage = $state(1);
	let hasLoadedOnce = $state(false);
	let selectedOutfit = $state<OutfitWithThumbnail | null>(null);
	let loadedCount = $state(0);

	const flagInfoById = $derived.by(() => {
		const lookup = new SvelteMap<string, FlaggedOutfitInfo>();
		for (const info of flaggedOutfits) {
			if (info.outfitId !== null) lookup.set(info.outfitId, info);
		}
		return lookup;
	});

	const flagInfoByLowerName = $derived.by(() => {
		const lookup = new SvelteMap<string, FlaggedOutfitInfo>();
		for (const info of flaggedOutfits) {
			if (info.outfitId === null) lookup.set(info.name.toLowerCase(), info);
		}
		return lookup;
	});

	function getFlagInfoById(id: number): FlaggedOutfitInfo | null {
		return flagInfoById.get(String(id)) ?? null;
	}

	function getFlagInfoByName(name: string): FlaggedOutfitInfo | null {
		return flagInfoByLowerName.get(name.toLowerCase()) ?? null;
	}

	const selectedFlagInfo = $derived(
		selectedOutfit
			? (getFlagInfoById(selectedOutfit.id) ?? getFlagInfoByName(selectedOutfit.name))
			: null
	);

	// Group by (name, id-flag) so an ID-flagged outfit never collapses into a same-named unflagged sibling
	const groupedOutfits = $derived.by(() => {
		const groups: Record<
			string,
			{ name: string; outfits: OutfitWithThumbnail[]; flagInfo: FlaggedOutfitInfo | null }
		> = {};

		for (const outfit of allOutfits) {
			const idFlag = getFlagInfoById(outfit.id);
			const groupKey = `${outfit.name}\x00${idFlag?.outfitId ?? ''}`;
			const existing = groups[groupKey];
			if (existing) {
				existing.outfits.push(outfit);
			} else {
				groups[groupKey] = {
					name: outfit.name,
					outfits: [outfit],
					flagInfo: idFlag ?? getFlagInfoByName(outfit.name)
				};
			}
		}

		const entries = Object.entries(groups);
		entries.sort(([, a], [, b]) => {
			const aFlagged = a.flagInfo !== null;
			const bFlagged = b.flagInfo !== null;
			if (aFlagged && !bFlagged) return -1;
			if (!aFlagged && bFlagged) return 1;
			return a.name.localeCompare(b.name);
		});

		return entries;
	});

	const totalPages = $derived(Math.ceil(groupedOutfits.length / VIEWER_ITEMS_PER_PAGE));
	const canGoBack = $derived(currentPage > 1);
	const canGoForward = $derived(currentPage < totalPages);
	const showPagination = $derived(totalPages > 1);

	const paginatedGroups = $derived.by(() => {
		const start = (currentPage - 1) * VIEWER_ITEMS_PER_PAGE;
		const end = start + VIEWER_ITEMS_PER_PAGE;
		return groupedOutfits.slice(start, end);
	});

	$effect(() => {
		if (!hasLoadedOnce && !isLoading) {
			void loadAllOutfits();
		}
	});

	$effect(() => {
		if (selectedOutfit !== null) return;
		const firstOutfit = groupedOutfits[0]?.[1].outfits[0];
		if (firstOutfit) selectedOutfit = firstOutfit;
	});

	$effect(() => {
		if (!allOutfits.some((o) => o.thumbnailState === 'pending')) return;
		const id = setTimeout(() => {
			void (async () => {
				const snapshot = allOutfits;
				const updated = await retryPendingOutfitThumbnails(snapshot, userId);
				if (allOutfits === snapshot) allOutfits = updated;
			})();
		}, THUMBNAIL_RETRY_DELAY);
		return () => clearTimeout(id);
	});

	// Pages through every outfit in sequence so subsequent grouping and pagination operates on the full set
	async function loadAllOutfits() {
		isLoading = true;
		hasError = false;
		loadedCount = 0;

		try {
			const collected: OutfitWithThumbnail[] = [];
			let page = 1;
			let hasMore = true;

			while (hasMore) {
				const result = await getUserOutfits(userId, page, VIEWER_ITEMS_PER_PAGE);
				collected.push(...result.outfits);
				loadedCount = collected.length;
				hasMore = result.hasNextPage;
				page++;
			}

			allOutfits = collected;
			currentPage = 1;
			hasLoadedOnce = true;
			logger.debug('Loaded all outfits for viewer', { total: allOutfits.length });
		} catch (err) {
			hasError = true;
			hasLoadedOnce = true;
			logger.error('Failed to load outfits:', err);
		} finally {
			isLoading = false;
		}
	}

	function goToPage(page: number) {
		if (page < 1 || page > totalPages) return;
		currentPage = page;
	}

	function selectOutfit(outfit: OutfitWithThumbnail) {
		selectedOutfit = outfit;
	}
</script>

<Modal isOpen={true} {onClose} showStatusChip={false} size="wide" title={$_('outfit_viewer_title')}>
	{#snippet headerContent()}
		<div class="outfit-viewer-header-logo">
			<AppLogo />
		</div>
	{/snippet}

	<div class="outfit-viewer-two-panel">
		<div class="outfit-viewer-left-panel">
			{#if isLoading && allOutfits.length === 0}
				<div class="outfit-viewer-loading">
					<div class="outfit-viewer-progress">
						<div class="outfit-viewer-progress-bar">
							<div class="outfit-viewer-progress-fill"></div>
						</div>
						<span class="outfit-viewer-progress-text">
							{$_('outfit_viewer_loading_count', { values: { 0: loadedCount.toString() } })}
						</span>
					</div>
				</div>
			{:else if hasError}
				<div class="outfit-viewer-error">
					<CircleAlert size={20} />
					<span>{$_('outfit_viewer_error')}</span>
					<button class="outfit-viewer-retry" onclick={loadAllOutfits} type="button">
						{$_('outfit_viewer_retry')}
					</button>
				</div>
			{:else if groupedOutfits.length === 0}
				<div class="outfit-viewer-empty">
					<Shirt size={28} />
					<span>{$_('outfit_viewer_empty')}</span>
				</div>
			{:else}
				{#if flaggedOutfits.length > 0}
					<p class="outfit-viewer-flagged-count">
						{$_('outfit_viewer_flagged_count', { values: { 0: flaggedOutfits.length.toString() } })}
					</p>
				{/if}

				<div class="outfit-viewer-grid">
					{#each paginatedGroups as [groupKey, group] (groupKey)}
						<OutfitStack
							flagInfo={group.flagInfo}
							onSelect={selectOutfit}
							outfits={group.outfits}
						/>
					{/each}
				</div>
			{/if}
		</div>

		<Outfit3DPanel flagInfo={selectedFlagInfo} outfit={selectedOutfit} />
	</div>

	{#snippet actions()}
		{#if showPagination}
			<div class="outfit-pagination-bar">
				<OutfitPaginator
					{canGoBack}
					{canGoForward}
					{currentPage}
					disabled={isLoading}
					iconSize={14}
					nextLabelKey="outfit_viewer_next_page"
					onChange={goToPage}
					pageInfoKey="outfit_viewer_page"
					prevLabelKey="outfit_viewer_prev_page"
				/>
			</div>
		{/if}
	{/snippet}
</Modal>
