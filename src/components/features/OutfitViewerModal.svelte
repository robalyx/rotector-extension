<script lang="ts">
	import { _ } from 'svelte-i18n';
	import {
		robloxApiService,
		THUMBNAIL_RETRY_DELAY,
		VIEWER_ITEMS_PER_PAGE
	} from '@/lib/services/roblox-api-service';
	import { logger } from '@/lib/utils/logger';
	import { getAssetUrl } from '@/lib/utils/assets';
	import { hasOwn } from '@/lib/utils/object';
	import { themeManager } from '@/lib/utils/theme';
	import { CircleAlert, Shirt, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import Modal from '../ui/Modal.svelte';
	import OutfitStack from './OutfitStack.svelte';
	import Outfit3DPanel from './Outfit3DPanel.svelte';
	import type { OutfitWithThumbnail } from '@/lib/types/api';
	import type { FlaggedOutfitInfo } from '@/lib/utils/violation-formatter';

	const lightLogoUrl = getAssetUrl('/assets/rotector-logo-light.webp');
	const darkLogoUrl = getAssetUrl('/assets/rotector-logo-dark.webp');

	interface Props {
		isOpen: boolean;
		userId: string;
		flaggedOutfits: FlaggedOutfitInfo[];
		onClose: () => void;
	}

	let { isOpen = $bindable(), userId, flaggedOutfits, onClose }: Props = $props();

	let allOutfits = $state<OutfitWithThumbnail[]>([]);
	let isLoading = $state(false);
	let hasError = $state(false);
	let currentPage = $state(1);
	let hasLoadedOnce = $state(false);
	let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let currentTheme = $state<'light' | 'dark'>('light');
	let selectedOutfit = $state<OutfitWithThumbnail | null>(null);
	let loadedCount = $state(0);

	const hasFlaggedOutfits = $derived(flaggedOutfits.length > 0);
	const logoUrl = $derived(currentTheme === 'dark' ? darkLogoUrl : lightLogoUrl);

	const flagInfoById = $derived.by(() => {
		const lookup: Record<string, FlaggedOutfitInfo> = {};
		for (const info of flaggedOutfits) {
			if (info.outfitId !== null) lookup[info.outfitId] = info;
		}
		return lookup;
	});

	const flagInfoByLowerName = $derived.by(() => {
		const lookup: Record<string, FlaggedOutfitInfo> = {};
		for (const info of flaggedOutfits) {
			if (info.outfitId === null) lookup[info.name.toLowerCase()] = info;
		}
		return lookup;
	});

	function getFlagInfoById(id: number): FlaggedOutfitInfo | null {
		const key = String(id);
		return hasOwn(flagInfoById, key) ? (flagInfoById[key] ?? null) : null;
	}

	function getFlagInfoByName(name: string): FlaggedOutfitInfo | null {
		const key = name.toLowerCase();
		return hasOwn(flagInfoByLowerName, key) ? (flagInfoByLowerName[key] ?? null) : null;
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

	// Client-side pagination
	const totalPages = $derived(Math.ceil(groupedOutfits.length / VIEWER_ITEMS_PER_PAGE));
	const canGoBack = $derived(currentPage > 1);
	const canGoForward = $derived(currentPage < totalPages);
	const showPagination = $derived(totalPages > 1);

	// Get current page of grouped outfits
	const paginatedGroups = $derived.by(() => {
		const start = (currentPage - 1) * VIEWER_ITEMS_PER_PAGE;
		const end = start + VIEWER_ITEMS_PER_PAGE;
		return groupedOutfits.slice(start, end);
	});

	// Subscribe to theme changes for logo switching
	$effect(() => {
		const unsubscribe = themeManager.effectiveTheme.subscribe((theme) => {
			currentTheme = theme;
		});
		return unsubscribe;
	});

	// Load all outfits when modal opens
	$effect(() => {
		if (isOpen && !hasLoadedOnce && !isLoading) {
			void loadAllOutfits();
		}
	});

	// Auto-select first outfit when data loads
	$effect(() => {
		const firstEntry = groupedOutfits[0];
		if (firstEntry && selectedOutfit === null) {
			const [, firstGroup] = firstEntry;
			const firstOutfit = firstGroup.outfits[0];
			if (firstOutfit) selectedOutfit = firstOutfit;
		}
	});

	// Reset selection when modal closes
	$effect(() => {
		if (!isOpen) {
			selectedOutfit = null;
		}
	});

	// Auto-retry pending thumbnails
	$effect(() => {
		if (!isOpen) return;

		const hasPendingThumbnails = allOutfits.some((o) => o.thumbnailState === 'pending');

		if (hasPendingThumbnails) {
			retryTimeoutId = setTimeout(() => {
				void retryPendingThumbnails();
			}, THUMBNAIL_RETRY_DELAY);
		}

		return () => {
			if (retryTimeoutId) {
				clearTimeout(retryTimeoutId);
				retryTimeoutId = null;
			}
		};
	});

	// Paginate through the API to collect every outfit the user owns
	async function loadAllOutfits() {
		isLoading = true;
		hasError = false;
		loadedCount = 0;

		try {
			const collected: OutfitWithThumbnail[] = [];
			let page = 1;
			let hasMore = true;

			while (hasMore) {
				const result = await robloxApiService.getUserOutfits(userId, page, VIEWER_ITEMS_PER_PAGE);
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

	async function retryPendingThumbnails() {
		const pendingOutfits = allOutfits.filter((o) => o.thumbnailState === 'pending');
		if (pendingOutfits.length === 0) return;

		const pendingIds = pendingOutfits.map((o) => o.id);
		const newThumbnails = await robloxApiService.batchFetchThumbnails(pendingIds);

		allOutfits = allOutfits.map((outfit) => {
			if (outfit.thumbnailState === 'pending' && newThumbnails.has(outfit.id)) {
				const result = newThumbnails.get(outfit.id);
				if (result === 'blocked') {
					return { ...outfit, thumbnailState: 'error' as const };
				} else if (result) {
					robloxApiService.updateCachedThumbnail(userId, outfit.id, result);
					return { ...outfit, thumbnailUrl: result, thumbnailState: 'completed' as const };
				}
			}
			return outfit;
		});
	}
</script>

<Modal {onClose} showStatusChip={false} size="wide" title={$_('outfit_viewer_title')} bind:isOpen>
	{#snippet headerContent()}
		<div class="outfit-viewer-header-logo">
			<img alt="Rotector" src={logoUrl} />
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
				{#if hasFlaggedOutfits}
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
				<button
					class="outfit-pagination-btn"
					class:outfit-pagination-btn-disabled={!canGoBack}
					aria-label={$_('outfit_viewer_prev_page')}
					disabled={!canGoBack || isLoading}
					onclick={() => goToPage(currentPage - 1)}
					type="button"
				>
					<ChevronLeft size={14} />
				</button>

				<span class="outfit-pagination-info">
					{$_('outfit_viewer_page', { values: { 0: currentPage.toString() } })}
				</span>

				<button
					class="outfit-pagination-btn"
					class:outfit-pagination-btn-disabled={!canGoForward}
					aria-label={$_('outfit_viewer_next_page')}
					disabled={!canGoForward || isLoading}
					onclick={() => goToPage(currentPage + 1)}
					type="button"
				>
					<ChevronRight size={14} />
				</button>
			</div>
		{/if}
	{/snippet}
</Modal>
