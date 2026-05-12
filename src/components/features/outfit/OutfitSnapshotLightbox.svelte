<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { ChevronLeft, ChevronRight, ImageOff } from '@lucide/svelte';
	import Modal from '../../ui/Modal.svelte';
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';
	import { apiClient } from '@/lib/services/rotector/api-client';
	import { logger } from '@/lib/utils/logging/logger';

	interface Props {
		isOpen: boolean;
		name: string;
		reason: string;
		confidence: number | null;
		primaryDataUrl: string | null;
		rawUrls: string[];
		onClose: () => void;
	}

	let { isOpen, name, reason, confidence, primaryDataUrl, rawUrls, onClose }: Props = $props();

	// undefined = awaiting lazy fetch, null = fetch failed, string = data URL ready
	let dataUrls = $state<Array<string | null | undefined>>([]);
	let currentIndex = $state(0);

	const isCarousel = $derived(rawUrls.length > 1);
	const currentDataUrl = $derived(dataUrls[currentIndex]);
	const isCurrentLoading = $derived(currentDataUrl === undefined);
	const positionLabel = $derived(
		$_('outfit_snapshot_lightbox_position', {
			values: { 0: (currentIndex + 1).toString(), 1: rawUrls.length.toString() }
		})
	);

	// Seed dataUrls with the primary image and lazy-fetch the rest on open
	$effect(() => {
		if (!isOpen) return;

		dataUrls = rawUrls.map((_, i) => (i === 0 ? primaryDataUrl : undefined));
		currentIndex = 0;

		const remaining = rawUrls.slice(1);
		if (remaining.length === 0) return;

		void apiClient
			.fetchOutfitImages(remaining)
			.then((results) => {
				dataUrls = [primaryDataUrl, ...results];
			})
			.catch((error: unknown) => {
				logger.error('Failed to lazy-load additional outfit snapshots', { error });
				dataUrls = dataUrls.map((slot) => (slot === undefined ? null : slot));
			});
	});

	// Keyboard navigation for carousel
	$effect(() => {
		if (!isOpen || !isCarousel) return;

		function handleKeydown(event: KeyboardEvent) {
			if (event.key === 'ArrowLeft') {
				event.preventDefault();
				goPrev();
			} else if (event.key === 'ArrowRight') {
				event.preventDefault();
				goNext();
			}
		}

		document.addEventListener('keydown', handleKeydown);
		return () => document.removeEventListener('keydown', handleKeydown);
	});

	function goPrev() {
		currentIndex = (currentIndex - 1 + rawUrls.length) % rawUrls.length;
	}

	function goNext() {
		currentIndex = (currentIndex + 1) % rawUrls.length;
	}
</script>

<Modal
	{isOpen}
	{onClose}
	showCancel={false}
	showConfirm={false}
	showStatusChip={false}
	size="normal"
	title={name}
>
	{#snippet headerContent()}
		{#if isCarousel}
			<span class="outfit-snapshot-lightbox-position">{positionLabel}</span>
		{/if}
	{/snippet}

	<div class="outfit-snapshot-lightbox-body">
		<div class="outfit-snapshot-lightbox-stage">
			{#if isCarousel}
				<button
					class="outfit-snapshot-lightbox-nav outfit-snapshot-lightbox-nav-prev"
					aria-label={$_('outfit_snapshot_lightbox_prev')}
					onclick={goPrev}
					type="button"
				>
					<ChevronLeft size={22} />
				</button>
			{/if}

			<div class="outfit-snapshot-lightbox-image-frame">
				{#if currentDataUrl}
					<img
						class="outfit-snapshot-lightbox-image"
						alt={name}
						decoding="async"
						loading="lazy"
						src={currentDataUrl}
					/>
				{:else if isCurrentLoading}
					<div class="outfit-snapshot-lightbox-loading">
						<LoadingSpinner size="medium" />
					</div>
				{:else}
					<div class="outfit-snapshot-lightbox-failed">
						<ImageOff size={28} />
					</div>
				{/if}
			</div>

			{#if isCarousel}
				<button
					class="outfit-snapshot-lightbox-nav outfit-snapshot-lightbox-nav-next"
					aria-label={$_('outfit_snapshot_lightbox_next')}
					onclick={goNext}
					type="button"
				>
					<ChevronRight size={22} />
				</button>
			{/if}
		</div>

		{#if isCarousel}
			<div class="outfit-snapshot-lightbox-dots" role="tablist">
				{#each rawUrls as _url, index (index)}
					<button
						class="outfit-snapshot-lightbox-dot"
						class:outfit-snapshot-lightbox-dot-active={index === currentIndex}
						aria-label={String(index + 1)}
						aria-selected={index === currentIndex}
						onclick={() => (currentIndex = index)}
						role="tab"
						type="button"
					></button>
				{/each}
			</div>
		{/if}

		<div class="outfit-meta-stack max-w-[420px]">
			<div class="outfit-meta">
				<span class="outfit-meta-label">
					{$_('outfit_snapshot_lightbox_caveat_label')}
				</span>
				<p class="outfit-meta-content">
					{$_('outfit_snapshot_lightbox_caveat')}
				</p>
			</div>

			{#if reason}
				<div class="outfit-meta">
					<div class="outfit-meta-label-row">
						<span class="outfit-meta-label">
							{$_('outfit_snapshot_lightbox_reason_label')}
						</span>
						{#if confidence !== null}
							<span class="outfit-meta-confidence">{confidence}%</span>
						{/if}
					</div>
					<p class="outfit-meta-content">{reason}</p>
				</div>
			{/if}
		</div>
	</div>
</Modal>
