<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Check, X } from '@lucide/svelte';
	import ChangelogContent from '@/components/popup/stats/ChangelogContent.svelte';
	import {
		unreadChangelogs,
		shouldShowChangelogModal,
		markChangelogsSeen,
		disableChangelogModal
	} from '@/lib/stores/changelog';
	import { getAssetUrl } from '@/lib/utils/assets';
	import { themeManager } from '@/lib/utils/theme';

	interface ChangelogModalProps {
		onClose: () => void;
	}

	let { onClose }: ChangelogModalProps = $props();

	let isOpen = $state(true);
	let isClosing = $state(false);
	let dontShowAgain = $state(false);
	let overlayElement = $state<HTMLDivElement>();
	let popupElement = $state<HTMLDivElement>();
	let closeButtonEl = $state<HTMLButtonElement>();
	const headingId = `changelog-modal-title-${Math.random().toString(36).slice(2)}`;

	const lightLogoUrl = getAssetUrl('/assets/rotector-logo-light.webp');
	const darkLogoUrl = getAssetUrl('/assets/rotector-logo-dark.webp');
	let currentTheme = $state<'light' | 'dark'>('light');

	$effect(() => {
		const unsubscribe = themeManager.effectiveTheme.subscribe((theme) => {
			currentTheme = theme;
		});
		return unsubscribe;
	});

	// Cross-tab sync to close modal when another tab closes it
	$effect(() => {
		const unsubscribe = shouldShowChangelogModal.subscribe((shouldShow) => {
			if (!shouldShow && isOpen && !isClosing) {
				isOpen = false;
				onClose();
			}
		});
		return unsubscribe;
	});

	async function handleClose() {
		isClosing = true;
		await markChangelogsSeen();
		if (dontShowAgain) {
			await disableChangelogModal();
		}
		setTimeout(() => {
			isOpen = false;
			isClosing = false;
			onClose();
		}, 250);
	}

	// Initialize modal visibility on mount
	$effect(() => {
		if (isOpen && overlayElement && popupElement) {
			const overlay = overlayElement;
			const closeButton = closeButtonEl;
			requestAnimationFrame(() => {
				overlay.classList.add('visible');
				closeButton?.focus();
			});
		}
	});
</script>

{#if isOpen}
	<div bind:this={overlayElement} class="modal-overlay" class:closing={isClosing}>
		<div
			bind:this={popupElement}
			class="modal-popup"
			aria-labelledby={headingId}
			aria-modal="true"
			role="dialog"
			tabindex="-1"
		>
			<div class="modal-header">
				<h2 id={headingId} class="modal-title">{$_('changelog_modal_title')}</h2>
				<button
					bind:this={closeButtonEl}
					class="modal-close"
					aria-label="Close dialog"
					onclick={handleClose}
					type="button"
				>
					<X aria-hidden="true" size={16} />
				</button>
			</div>

			<div class="modal-divider"></div>

			<div class="modal-content">
				<div class="onboarding-hero-logo">
					{#if currentTheme === 'dark'}
						<img alt="Rotector" src={darkLogoUrl} />
					{:else}
						<img alt="Rotector" src={lightLogoUrl} />
					{/if}
				</div>
				{#each $unreadChangelogs as changelog (changelog.id)}
					<div class="changelog-modal-item">
						<ChangelogContent {changelog} />
					</div>
				{/each}
			</div>

			<div class="modal-divider"></div>

			<div class="modal-actions">
				<label class="changelog-modal-disable">
					<input class="queue-ack-checkbox" type="checkbox" bind:checked={dontShowAgain} />
					<span class="queue-ack-checkmark" class:checked={dontShowAgain}>
						{#if dontShowAgain}
							<Check aria-hidden="true" size={14} strokeWidth={3} />
						{/if}
					</span>
					<span>{$_('changelog_modal_disable_checkbox')}</span>
				</label>
				<button class="modal-button-primary" onclick={handleClose} type="button">
					{$_('changelog_modal_close')}
				</button>
			</div>
		</div>
	</div>
{/if}
