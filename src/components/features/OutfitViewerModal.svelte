<script lang="ts">
	import { _ } from 'svelte-i18n';
	import {
		robloxApiService,
		THUMBNAIL_RETRY_DELAY,
		VIEWER_ITEMS_PER_PAGE
	} from '@/lib/services/roblox-api-service';
	import { logger } from '@/lib/utils/logger';
	import { getAssetUrl } from '@/lib/utils/assets';
	import { themeManager } from '@/lib/utils/theme';
	import { AlertTriangle, AlertCircle, Shirt, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import Modal from '../ui/Modal.svelte';
	import LoadingSpinner from '../ui/LoadingSpinner.svelte';
	import OutfitStack from './OutfitStack.svelte';
	import type { OutfitWithThumbnail } from '@/lib/types/api';
	import type { FlaggedOutfitInfo } from '@/lib/utils/violation-formatter';

	const lightLogoUrl = getAssetUrl('/assets/rotector-logo-light.webp');
	const darkLogoUrl = getAssetUrl('/assets/rotector-logo-dark.webp');

	interface Props {
		isOpen: boolean;
		userId: string;
		flaggedOutfits: Map<string, FlaggedOutfitInfo>;
		onClose: () => void;
	}

	let { isOpen = $bindable(), userId, flaggedOutfits, onClose }: Props = $props();

	let allOutfits = $state<OutfitWithThumbnail[]>([]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let currentPage = $state(1);
	let hasLoadedOnce = $state(false);
	let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let currentTheme = $state<'light' | 'dark'>('light');

	const hasFlaggedOutfits = $derived(flaggedOutfits.size > 0);
	const logoUrl = $derived(currentTheme === 'dark' ? darkLogoUrl : lightLogoUrl);

	// Group all outfits by name and sort with flagged first
	const groupedOutfits = $derived.by(() => {
		const groups: Record<string, OutfitWithThumbnail[]> = {};

		for (const outfit of allOutfits) {
			const existing = groups[outfit.name] || [];
			existing.push(outfit);
			groups[outfit.name] = existing;
		}

		const entries = Object.entries(groups);
		entries.sort(([nameA], [nameB]) => {
			const aFlagged = flaggedOutfits.has(nameA);
			const bFlagged = flaggedOutfits.has(nameB);

			if (aFlagged && !bFlagged) return -1;
			if (!aFlagged && bFlagged) return 1;
			return nameA.localeCompare(nameB);
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

	// Fetch all outfits from API and sort client-side
	async function loadAllOutfits() {
		isLoading = true;
		error = null;

		try {
			const collected: OutfitWithThumbnail[] = [];
			let page = 1;
			let hasMore = true;

			while (hasMore) {
				const result = await robloxApiService.getUserOutfits(userId, page, VIEWER_ITEMS_PER_PAGE);
				collected.push(...result.outfits);
				hasMore = result.hasNextPage;
				page++;
			}

			allOutfits = collected;
			currentPage = 1;
			hasLoadedOnce = true;
			logger.debug('Loaded all outfits for viewer', { total: allOutfits.length });
		} catch (err) {
			error = 'Failed to load outfits';
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

<Modal {onClose} title={$_('outfit_viewer_title')} bind:isOpen>
	{#snippet headerContent()}
		<div class="outfit-viewer-header-logo">
			<img alt="Rotector" src={logoUrl} />
		</div>
	{/snippet}

	<div class="outfit-viewer-disclaimer">
		<AlertTriangle class="outfit-viewer-disclaimer-icon" size={16} />
		<span>{$_('outfit_viewer_disclaimer')}</span>
	</div>

	{#if isLoading && allOutfits.length === 0}
		<div class="outfit-viewer-loading">
			<LoadingSpinner size="medium" />
			<span>{$_('outfit_viewer_loading')}</span>
		</div>
	{:else if error}
		<div class="outfit-viewer-error">
			<AlertCircle size={24} />
			<span>{$_('outfit_viewer_error')}</span>
			<button class="outfit-viewer-retry" onclick={loadAllOutfits} type="button">
				{$_('outfit_viewer_retry')}
			</button>
		</div>
	{:else if groupedOutfits.length === 0}
		<div class="outfit-viewer-empty">
			<Shirt size={32} />
			<span>{$_('outfit_viewer_empty')}</span>
		</div>
	{:else}
		{#if hasFlaggedOutfits}
			<p class="mb-3 text-xs text-text-subtle">
				{$_('outfit_viewer_flagged_count', { values: { 0: flaggedOutfits.size.toString() } })}
			</p>
		{/if}

		<div class="outfit-viewer-grid">
			{#each paginatedGroups as [name, outfitGroup] (name)}
				<OutfitStack flagInfo={flaggedOutfits.get(name) ?? null} outfits={outfitGroup} />
			{/each}
		</div>
	{/if}

	{#snippet actions()}
		{#if showPagination}
			<button
				class="outfit-pagination-btn"
				class:outfit-pagination-btn-disabled={!canGoBack}
				aria-label={$_('outfit_viewer_prev_page')}
				disabled={!canGoBack || isLoading}
				onclick={() => goToPage(currentPage - 1)}
				type="button"
			>
				<ChevronLeft size={16} />
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
				<ChevronRight size={16} />
			</button>
		{/if}
	{/snippet}
</Modal>
