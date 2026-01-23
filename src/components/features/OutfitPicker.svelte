<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { robloxApiService, THUMBNAIL_RETRY_DELAY } from '@/lib/services/roblox-api-service';
	import { logger } from '@/lib/utils/logger';
	import {
		ChevronDown,
		ChevronUp,
		ChevronLeft,
		ChevronRight,
		AlertCircle,
		Shirt,
		Check,
		ImageOff
	} from 'lucide-svelte';
	import LoadingSpinner from '../ui/LoadingSpinner.svelte';
	import View3DButton from '../ui/View3DButton.svelte';
	import Outfit3DModal from './Outfit3DModal.svelte';
	import type { OutfitWithThumbnail, CurrentAvatarInfo } from '@/lib/types/api';

	interface Props {
		userId: string | number;
		maxSelections: number;
		selectedOutfits?: string[];
		onSelectionChange: (outfitNames: string[]) => void;
		disabled?: boolean;
	}

	let {
		userId,
		maxSelections,
		selectedOutfits = $bindable([]),
		onSelectionChange,
		disabled = false
	}: Props = $props();

	// Component state
	let isExpanded = $state(false);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let outfits = $state<OutfitWithThumbnail[]>([]);
	let currentAvatar = $state<CurrentAvatarInfo | null>(null);
	let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

	// 3D modal state
	let modal3DOutfit = $state<{ outfitId?: number; userId?: number; name: string } | null>(null);
	let isModal3DOpen = $state(false);

	// Pagination state
	let currentPage = $state(1);
	let hasNextPage = $state(false);

	// Track selection count
	const selectionCount = $derived(selectedOutfits.length);
	const canSelectMore = $derived(selectionCount < maxSelections);
	const hasSelections = $derived(selectionCount > 0);

	// Pagination helpers
	const canGoBack = $derived(currentPage > 1);
	const canGoForward = $derived(hasNextPage);
	const showPagination = $derived(currentPage > 1 || hasNextPage);

	// Current avatar display name
	const currentAvatarName = $derived(currentAvatar?.username ?? 'Current');

	// Check if current avatar is selected
	const isCurrentAvatarSelected = $derived(selectedOutfits.includes(currentAvatarName));

	// Toggle outfit selection
	function toggleOutfit(outfitName: string): void {
		if (disabled) return;

		if (selectedOutfits.includes(outfitName)) {
			selectedOutfits = selectedOutfits.filter((name) => name !== outfitName);
		} else if (canSelectMore) {
			selectedOutfits = [...selectedOutfits, outfitName];
		}
		onSelectionChange(selectedOutfits);
	}

	// Get selection index for badge display
	function getSelectionIndex(outfitName: string): number {
		return selectedOutfits.indexOf(outfitName) + 1;
	}

	// Open 3D modal for an outfit or current avatar
	function open3DModal(
		data: { outfitId?: number; userId?: number; name: string },
		event: MouseEvent
	): void {
		event.stopPropagation();
		modal3DOutfit = data;
		isModal3DOpen = true;
	}

	function close3DModal(): void {
		isModal3DOpen = false;
		modal3DOutfit = null;
	}

	// Toggle expanded state and load outfits if needed
	async function toggleExpanded() {
		if (disabled && !isExpanded) return;

		isExpanded = !isExpanded;

		if (isExpanded && outfits.length === 0 && !isLoading && !error) {
			await loadOutfits(1);
		}
	}

	// Load outfits from Roblox API
	async function loadOutfits(page: number) {
		isLoading = true;
		error = null;

		try {
			if (page === 1 && !currentAvatar) {
				const [avatarInfo, result] = await Promise.all([
					robloxApiService.getCurrentAvatarInfo(userId),
					robloxApiService.getUserOutfits(userId, page)
				]);
				currentAvatar = avatarInfo;
				outfits = result.outfits;
				currentPage = result.currentPage;
				hasNextPage = result.hasNextPage;
			} else {
				const result = await robloxApiService.getUserOutfits(userId, page);
				outfits = result.outfits;
				currentPage = result.currentPage;
				hasNextPage = result.hasNextPage;
			}
			logger.debug('Loaded outfits', { page, count: outfits.length, hasNextPage });
		} catch (err) {
			error = 'Failed to load outfits';
			logger.error('Failed to load outfits:', err);
		} finally {
			isLoading = false;
		}
	}

	// Pagination navigation
	async function goToPage(page: number) {
		if (page < 1 || isLoading) return;
		await loadOutfits(page);
	}

	// Retry loading pending thumbnails
	async function retryPendingThumbnails() {
		const pendingOutfits = outfits.filter((o) => o.thumbnailState === 'pending');

		if (pendingOutfits.length === 0) return;

		const pendingIds = pendingOutfits.map((o) => o.id);
		const newThumbnails = await robloxApiService.batchFetchThumbnails(pendingIds);

		// Update outfits with new thumbnail URLs
		outfits = outfits.map((outfit) => {
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

	// Auto-retry pending thumbnails
	$effect(() => {
		if (!isExpanded) return;

		const hasPendingThumbnails = outfits.some((o) => o.thumbnailState === 'pending');

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
</script>

<div
	class="outfit-picker-card"
	class:outfit-picker-disabled={disabled}
	class:outfit-picker-has-selections={hasSelections}
>
	<!-- Header -->
	<button
		class="outfit-picker-header"
		disabled={disabled && !isExpanded}
		onclick={toggleExpanded}
		type="button"
	>
		<div class="outfit-picker-header-content">
			<Shirt class="outfit-picker-icon" size={24} />
			<div class="outfit-picker-title-section">
				<span class="outfit-picker-title">{$_('queue_popup_outfit_check_title')}</span>
				<span class="outfit-picker-subtitle">
					{#if hasSelections}
						{$_('queue_popup_outfit_selected_count', {
							values: { 0: selectionCount.toString(), 1: maxSelections.toString() }
						})}
					{:else if disabled}
						{$_('queue_popup_outfit_limit_exhausted')}
					{:else}
						{$_('queue_popup_outfit_select_prompt', { values: { 0: maxSelections.toString() } })}
					{/if}
				</span>
			</div>
		</div>
		<div class="outfit-picker-chevron">
			{#if isExpanded}
				<ChevronUp size={20} />
			{:else}
				<ChevronDown size={20} />
			{/if}
		</div>
	</button>

	<!-- Expandable content -->
	{#if isExpanded}
		<div class="outfit-picker-content">
			{#if isLoading}
				<div class="outfit-picker-loading">
					<LoadingSpinner size="small" />
					<span>{$_('queue_popup_outfit_loading')}</span>
				</div>
			{:else if error}
				<div class="outfit-picker-error">
					<AlertCircle size={20} />
					<span>{$_('queue_popup_outfit_load_error')}</span>
					<button
						class="outfit-picker-retry"
						onclick={() => loadOutfits(currentPage)}
						type="button"
					>
						{$_('queue_popup_outfit_retry')}
					</button>
				</div>
			{:else if outfits.length === 0 && !currentAvatar}
				<div class="outfit-picker-empty">
					<Shirt size={32} />
					<span>{$_('queue_popup_outfit_none')}</span>
				</div>
			{:else}
				<!-- Outfit grid -->
				<div class="outfit-picker-grid">
					<!-- Current Avatar (first item on page 1) -->
					{#if currentPage === 1 && currentAvatar}
						{@const canSelect = isCurrentAvatarSelected || canSelectMore}
						<button
							class="outfit-picker-item outfit-picker-item-current"
							class:outfit-picker-item-disabled={!canSelect}
							class:outfit-picker-item-selected={isCurrentAvatarSelected}
							onclick={() => toggleOutfit(currentAvatarName)}
							title={currentAvatarName}
							type="button"
						>
							<div class="outfit-thumbnail-container">
								{#if currentAvatar.thumbnailUrl}
									<img
										class="outfit-thumbnail"
										alt={currentAvatarName}
										loading="lazy"
										src={currentAvatar.thumbnailUrl}
									/>
								{:else}
									<div class="outfit-thumbnail-placeholder">
										<ImageOff size={24} />
									</div>
								{/if}
								<View3DButton
									onclick={(e: MouseEvent) =>
										open3DModal({ userId: Number(userId), name: currentAvatarName }, e)}
								/>
								{#if isCurrentAvatarSelected}
									<div class="outfit-selected-badge">
										{#if maxSelections === 1}
											<Check size={12} />
										{:else}
											<span>{getSelectionIndex(currentAvatarName)}</span>
										{/if}
									</div>
								{/if}
							</div>
							<div class="outfit-name-container">
								<span class="outfit-name">{currentAvatarName}</span>
								<span class="outfit-current-label">{$_('queue_popup_outfit_current')}</span>
							</div>
						</button>
					{/if}

					{#each outfits as outfit (outfit.id)}
						{@const selected = selectedOutfits.includes(outfit.name)}
						{@const canSelect = selected || canSelectMore}
						<button
							class="outfit-picker-item"
							class:outfit-picker-item-disabled={!canSelect}
							class:outfit-picker-item-selected={selected}
							onclick={() => toggleOutfit(outfit.name)}
							title={outfit.name}
							type="button"
						>
							<div class="outfit-thumbnail-container">
								{#if outfit.thumbnailUrl}
									<img
										class="outfit-thumbnail"
										alt={outfit.name}
										loading="lazy"
										src={outfit.thumbnailUrl}
									/>
								{:else if outfit.thumbnailState === 'pending'}
									<div class="outfit-thumbnail-pending">
										<LoadingSpinner size="small" />
									</div>
								{:else}
									<div class="outfit-thumbnail-placeholder">
										<ImageOff size={24} />
									</div>
								{/if}
								<View3DButton
									onclick={(e: MouseEvent) =>
										open3DModal({ outfitId: outfit.id, name: outfit.name }, e)}
								/>
								{#if selected}
									<div class="outfit-selected-badge">
										{#if maxSelections === 1}
											<Check size={12} />
										{:else}
											<span>{getSelectionIndex(outfit.name)}</span>
										{/if}
									</div>
								{/if}
							</div>
							<span class="outfit-name">{outfit.name}</span>
						</button>
					{/each}
				</div>

				<!-- Pagination controls -->
				{#if showPagination}
					<div class="outfit-picker-pagination">
						<button
							class="outfit-pagination-btn"
							class:outfit-pagination-btn-disabled={!canGoBack}
							aria-label={$_('queue_popup_outfit_prev_page')}
							disabled={!canGoBack || isLoading}
							onclick={() => goToPage(currentPage - 1)}
							type="button"
						>
							<ChevronLeft size={16} />
						</button>

						<span class="outfit-pagination-info">
							{$_('queue_popup_outfit_page_num', {
								values: { 0: currentPage.toString() }
							})}
						</span>

						<button
							class="outfit-pagination-btn"
							class:outfit-pagination-btn-disabled={!canGoForward}
							aria-label={$_('queue_popup_outfit_next_page')}
							disabled={!canGoForward || isLoading}
							onclick={() => goToPage(currentPage + 1)}
							type="button"
						>
							<ChevronRight size={16} />
						</button>
					</div>
				{/if}

				<!-- Selection limit hint -->
				{#if !canSelectMore && hasSelections}
					<div class="outfit-picker-limit-hint">
						{$_('queue_popup_outfit_limit_reached')}
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<!-- 3D Modal -->
{#if modal3DOutfit}
	<Outfit3DModal
		onClose={close3DModal}
		outfitId={modal3DOutfit.outfitId}
		outfitName={modal3DOutfit.name}
		userId={modal3DOutfit.userId}
		bind:isOpen={isModal3DOpen}
	/>
{/if}
