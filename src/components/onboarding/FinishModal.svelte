<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { getAssetUrl } from '@/lib/utils/assets';
	import { themeManager } from '@/lib/utils/theme';

	const lightLogoUrl = getAssetUrl('/assets/rotector-logo-light.webp');
	const darkLogoUrl = getAssetUrl('/assets/rotector-logo-dark.webp');

	interface FinishModalProps {
		onFinish: () => void;
	}

	let { onFinish }: FinishModalProps = $props();

	let isOpen = $state(true);
	let isClosing = $state(false);
	let overlayElement = $state<HTMLDivElement>();
	let popupElement = $state<HTMLDivElement>();
	let currentTheme = $state<'light' | 'dark'>('light');
	const headingId = `finish-modal-title-${Math.random().toString(36).slice(2)}`;

	// Subscribe to theme changes for logo switching
	$effect(() => {
		const unsubscribe = themeManager.effectiveTheme.subscribe((theme) => {
			currentTheme = theme;
		});
		return unsubscribe;
	});

	// Close modal and trigger finish callback
	function handleFinish() {
		isClosing = true;
		setTimeout(() => {
			isOpen = false;
			isClosing = false;
			onFinish();
		}, 250);
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
	<div bind:this={overlayElement} class="modal-overlay" class:closing={isClosing}>
		<div
			bind:this={popupElement}
			class="modal-popup-small"
			aria-labelledby={headingId}
			aria-modal="true"
			role="dialog"
			tabindex="-1"
		>
			<div class="modal-content">
				<div class="onboarding-hero-logo">
					{#if currentTheme === 'dark'}
						<img alt="Rotector" src={darkLogoUrl} />
					{:else}
						<img alt="Rotector" src={lightLogoUrl} />
					{/if}
				</div>

				<h3 id={headingId} class="onboarding-finish-title">
					{$_('onboarding_finish_title')}
				</h3>

				<p class="modal-paragraph">{$_('onboarding_finish_protection')}</p>

				<p class="onboarding-agreement-text">
					{$_('onboarding_finish_feedback')}
					<a href="https://discord.gg/2Cn7kXqqhY" rel="noopener noreferrer" target="_blank">
						{$_('onboarding_finish_discord')}
					</a>.
				</p>
			</div>

			<div class="modal-divider"></div>

			<div class="modal-actions">
				<button class="modal-button-primary" onclick={handleFinish} type="button">
					{$_('onboarding_finish_button')}
				</button>
			</div>
		</div>
	</div>
{/if}
