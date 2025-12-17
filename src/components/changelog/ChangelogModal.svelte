<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Portal from 'svelte-portal';
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
		}, 300);
	}

	// Initialize modal visibility on mount
	$effect(() => {
		if (isOpen && overlayElement && popupElement) {
			const overlay = overlayElement;
			const popup = popupElement;
			requestAnimationFrame(() => {
				overlay.classList.add('visible');
				popup.focus();
			});
		}
	});
</script>

{#if isOpen}
	<Portal target="body">
		<div bind:this={overlayElement} class="changelog-modal-overlay" class:closing={isClosing}>
			<div
				bind:this={popupElement}
				class="changelog-modal-popup"
				aria-labelledby={headingId}
				aria-modal="true"
				role="dialog"
				tabindex="-1"
			>
				<div class="changelog-modal-header">
					<h2 id={headingId}>{$_('changelog_modal_title')}</h2>
				</div>

				<div class="changelog-modal-content">
					<div class="changelog-modal-logo">
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

				<div class="changelog-modal-footer">
					<label class="changelog-modal-checkbox">
						<input type="checkbox" bind:checked={dontShowAgain} />
						<span>{$_('changelog_modal_disable_checkbox')}</span>
					</label>
					<button class="changelog-modal-close-button" onclick={handleClose} type="button">
						{$_('changelog_modal_close')}
					</button>
				</div>
			</div>
		</div>
	</Portal>
{/if}
