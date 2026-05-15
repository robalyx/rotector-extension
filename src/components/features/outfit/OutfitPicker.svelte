<script lang="ts">
	import { _ } from 'svelte-i18n';
	import {
		getCurrentAvatarInfo,
		getUserOutfits,
		THUMBNAIL_RETRY_DELAY
	} from '@/lib/services/roblox/api';
	import { retryPendingOutfitThumbnails } from '@/lib/services/roblox/outfit-thumbnail-retry';
	import { logger } from '@/lib/utils/logging/logger';
	import { ChevronDown, ChevronUp, CircleAlert, Shirt, Check, ImageOff } from '@lucide/svelte';
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';
	import View3DButton from './View3DButton.svelte';
	import Modal from '../../ui/Modal.svelte';
	import Outfit3DViewer from './Outfit3DViewer.svelte';
	import OutfitPaginator from './OutfitPaginator.svelte';
	import type { OutfitWithThumbnail, CurrentAvatarInfo, SelectedOutfit } from '@/lib/types/api';

	interface Props {
		userId: string | number;
		maxSelections: number;
		selectedOutfits?: SelectedOutfit[];
		onSelectionChange: (selections: SelectedOutfit[]) => void;
		disabled?: boolean;
	}

	let {
		userId,
		maxSelections,
		selectedOutfits = $bindable<SelectedOutfit[]>([]),
		onSelectionChange,
		disabled = false
	}: Props = $props();

	let isExpanded = $state(false);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let outfits = $state<OutfitWithThumbnail[]>([]);
	let currentAvatar = $state<CurrentAvatarInfo | null>(null);

	let modal3DOutfit = $state<{ outfitId?: number; userId?: number; name: string } | null>(null);

	let currentPage = $state(1);
	let hasNextPage = $state(false);

	const selectionCount = $derived(selectedOutfits.length);
	const canSelectMore = $derived(selectionCount < maxSelections);
	const hasSelections = $derived(selectionCount > 0);

	const canGoBack = $derived(currentPage > 1);
	const canGoForward = $derived(hasNextPage);
	const showPagination = $derived(currentPage > 1 || hasNextPage);

	const currentAvatarName = $derived(currentAvatar?.username ?? 'Current');

	const isCurrentAvatarSelected = $derived(selectedOutfits.some((s) => s.kind === 'current'));

	function isSavedSelected(id: number): boolean {
		return selectedOutfits.some((s) => s.kind === 'saved' && s.id === id);
	}

	function toggleSavedOutfit(outfit: OutfitWithThumbnail): void {
		if (disabled) return;

		if (isSavedSelected(outfit.id)) {
			selectedOutfits = selectedOutfits.filter((s) => !(s.kind === 'saved' && s.id === outfit.id));
		} else if (canSelectMore) {
			selectedOutfits = [...selectedOutfits, { kind: 'saved', id: outfit.id, name: outfit.name }];
		}
		onSelectionChange(selectedOutfits);
	}

	function toggleCurrentAvatar(): void {
		if (disabled) return;

		if (isCurrentAvatarSelected) {
			selectedOutfits = selectedOutfits.filter((s) => s.kind !== 'current');
		} else if (canSelectMore) {
			selectedOutfits = [...selectedOutfits, { kind: 'current', name: currentAvatarName }];
		}
		onSelectionChange(selectedOutfits);
	}

	function getSavedSelectionIndex(id: number): number {
		return selectedOutfits.findIndex((s) => s.kind === 'saved' && s.id === id) + 1;
	}

	function getCurrentAvatarSelectionIndex(): number {
		return selectedOutfits.findIndex((s) => s.kind === 'current') + 1;
	}

	function open3DModal(
		data: { outfitId?: number; userId?: number; name: string },
		event: MouseEvent
	): void {
		event.stopPropagation();
		modal3DOutfit = data;
	}

	function close3DModal(): void {
		modal3DOutfit = null;
	}

	async function toggleExpanded() {
		if (disabled && !isExpanded) return;

		isExpanded = !isExpanded;

		if (isExpanded && outfits.length === 0 && !isLoading && !error) {
			await loadOutfits(1);
		}
	}

	async function loadOutfits(page: number) {
		isLoading = true;
		error = null;

		try {
			const [avatarInfo, result] = await Promise.all([
				page === 1 && !currentAvatar ? getCurrentAvatarInfo(userId) : Promise.resolve(null),
				getUserOutfits(userId, page)
			]);
			if (avatarInfo) currentAvatar = avatarInfo;
			outfits = result.outfits;
			currentPage = result.currentPage;
			hasNextPage = result.hasNextPage;
			logger.debug('Loaded outfits', { page, count: outfits.length, hasNextPage });
		} catch (error_) {
			error = 'Failed to load outfits';
			logger.error('Failed to load outfits:', error_);
		} finally {
			isLoading = false;
		}
	}

	async function goToPage(page: number) {
		if (page < 1 || isLoading) return;
		await loadOutfits(page);
	}

	$effect(() => {
		if (!isExpanded) return;
		if (!outfits.some((o) => o.thumbnailState === 'pending')) return;
		const id = setTimeout(() => {
			void (async () => {
				const snapshot = outfits;
				const updated = await retryPendingOutfitThumbnails(snapshot, userId);
				if (outfits === snapshot) outfits = updated;
			})();
		}, THUMBNAIL_RETRY_DELAY);
		return () => clearTimeout(id);
	});
</script>

<div
	class="outfit-picker-card"
	class:outfit-picker-disabled={disabled}
	class:outfit-picker-has-selections={hasSelections}
>
	<button
		class="outfit-picker-header"
		aria-expanded={isExpanded}
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

	{#if isExpanded}
		<div class="outfit-picker-content">
			{#if isLoading}
				<div class="outfit-picker-loading">
					<LoadingSpinner size="small" />
					<span>{$_('queue_popup_outfit_loading')}</span>
				</div>
			{:else if error}
				<div class="outfit-picker-error">
					<CircleAlert size={20} />
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
				<div class="outfit-picker-grid">
					{#if currentPage === 1 && currentAvatar}
						{@const canSelect = isCurrentAvatarSelected || canSelectMore}
						<button
							class="outfit-picker-item outfit-picker-item-current"
							class:outfit-picker-item-disabled={!canSelect}
							class:outfit-picker-item-selected={isCurrentAvatarSelected}
							onclick={toggleCurrentAvatar}
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
											<span>{getCurrentAvatarSelectionIndex()}</span>
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
						{@const selected = isSavedSelected(outfit.id)}
						{@const canSelect = selected || canSelectMore}
						<button
							class="outfit-picker-item"
							class:outfit-picker-item-disabled={!canSelect}
							class:outfit-picker-item-selected={selected}
							onclick={() => toggleSavedOutfit(outfit)}
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
											<span>{getSavedSelectionIndex(outfit.id)}</span>
										{/if}
									</div>
								{/if}
							</div>
							<span class="outfit-name">{outfit.name}</span>
						</button>
					{/each}
				</div>

				{#if showPagination}
					<div class="outfit-picker-pagination">
						<OutfitPaginator
							{canGoBack}
							{canGoForward}
							{currentPage}
							disabled={isLoading}
							nextLabelKey="queue_popup_outfit_next_page"
							onChange={goToPage}
							pageInfoKey="queue_popup_outfit_page_num"
							prevLabelKey="queue_popup_outfit_prev_page"
						/>
					</div>
				{/if}

				{#if !canSelectMore && hasSelections}
					<div class="outfit-picker-limit-hint">
						{$_('queue_popup_outfit_limit_reached')}
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>

{#if modal3DOutfit}
	<Modal
		isOpen={true}
		onClose={close3DModal}
		showCancel={false}
		showConfirm={false}
		showStatusChip={false}
		title={modal3DOutfit.name}
	>
		<div class="outfit-3d-modal-content">
			<Outfit3DViewer
				height={400}
				outfitId={modal3DOutfit.outfitId}
				userId={modal3DOutfit.userId}
				width={400}
			/>
			<p class="outfit-3d-modal-hint">{$_('outfit_3d_drag_hint')}</p>
		</div>
	</Modal>
{/if}
