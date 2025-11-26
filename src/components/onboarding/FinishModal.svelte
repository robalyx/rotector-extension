<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Portal from 'svelte-portal';
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
		}, 300);
	}

	// Initialize modal visibility on mount
	$effect(() => {
		if (isOpen) {
			requestAnimationFrame(() => {
				if (overlayElement) {
					overlayElement.classList.add('visible');
				}
				if (popupElement) {
					popupElement.focus();
				}
			});
		}
		return () => {};
	});
</script>

{#if isOpen}
	<Portal target="body">
		<div bind:this={overlayElement} class="onboarding-overlay" class:closing={isClosing}>
			<div
				bind:this={popupElement}
				class="onboarding-popup"
				aria-labelledby={headingId}
				aria-modal="true"
				role="dialog"
				tabindex="-1"
			>
				<div class="onboarding-content">
					<div class="onboarding-welcome-logo">
						{#if currentTheme === 'dark'}
							<img alt="Rotector" src={darkLogoUrl} />
						{:else}
							<img alt="Rotector" src={lightLogoUrl} />
						{/if}
					</div>

					<div class="onboarding-welcome-content">
						<h3 id={headingId} class="onboarding-finish-title">
							{$_('onboarding_finish_title')}
						</h3>

						<p class="onboarding-welcome-description">
							{$_('onboarding_finish_protection')}
						</p>

						<div class="onboarding-welcome-tos">
							<p>
								{$_('onboarding_finish_feedback')}
								<a
									class="onboarding-welcome-link"
									href="https://discord.gg/2Cn7kXqqhY"
									rel="noopener noreferrer"
									target="_blank"
								>
									{$_('onboarding_finish_discord')}
								</a>.
							</p>
						</div>
					</div>
				</div>

				<div class="onboarding-actions">
					<button class="onboarding-button-primary" onclick={handleFinish} type="button">
						{$_('onboarding_finish_button')}
					</button>
				</div>
			</div>
		</div>
	</Portal>
{/if}
