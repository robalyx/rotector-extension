<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Portal from 'svelte-portal';
	import { X } from 'lucide-svelte';
	import { getAssetUrl } from '@/lib/utils/assets';
	import { themeManager } from '@/lib/utils/theme';
	import GuideStepStatus from './steps/GuideStepStatus.svelte';
	import GuideStepBadges from './steps/GuideStepBadges.svelte';
	import GuideStepFeatures from './steps/GuideStepFeatures.svelte';
	import GuideStepScope from './steps/GuideStepScope.svelte';

	const lightLogoUrl = getAssetUrl('/assets/rotector-logo-light.webp');
	const darkLogoUrl = getAssetUrl('/assets/rotector-logo-dark.webp');

	let currentTheme = $state<'light' | 'dark'>('light');

	// Subscribe to theme changes for logo switching
	$effect(() => {
		const unsubscribe = themeManager.effectiveTheme.subscribe((theme) => {
			currentTheme = theme;
		});
		return unsubscribe;
	});

	interface GuideModalProps {
		onDismiss: () => void;
		onFinish: () => void;
	}

	let { onDismiss, onFinish }: GuideModalProps = $props();

	const TOTAL_STEPS = 4;
	let currentStepIndex = $state(0);
	let isOpen = $state(true);
	let isClosing = $state(false);
	let overlayElement = $state<HTMLDivElement>();
	let popupElement = $state<HTMLDivElement>();
	let closeButtonEl = $state<HTMLButtonElement>();
	const headingId = `guide-modal-title-${Math.random().toString(36).slice(2)}`;

	// Animate modal close and execute callback
	function closeModal(callback: () => void) {
		isClosing = true;
		setTimeout(() => {
			isOpen = false;
			isClosing = false;
			callback();
		}, 300);
	}

	// Handle escape key to close
	function handleEscape(e: KeyboardEvent) {
		if (e.key === 'Escape' && isOpen) {
			closeModal(onDismiss);
		}
	}

	// Handle clicks on overlay to trigger close
	function handleOverlayClick(e: MouseEvent) {
		if (e.target === overlayElement) {
			closeModal(onDismiss);
		}
	}

	// Navigate to previous step
	function handleBack() {
		if (currentStepIndex > 0) {
			currentStepIndex--;
		}
	}

	// Navigate to next step or finish guide
	function handleNext() {
		if (currentStepIndex < TOTAL_STEPS - 1) {
			currentStepIndex++;
		} else {
			closeModal(onFinish);
		}
	}

	// Initialize modal and set up keyboard listeners
	$effect(() => {
		if (isOpen) {
			document.addEventListener('keydown', handleEscape);
			requestAnimationFrame(() => {
				if (overlayElement) {
					overlayElement.classList.add('visible');
				}
				if (closeButtonEl) {
					closeButtonEl.focus();
				} else if (popupElement) {
					popupElement.focus();
				}
			});
			return () => document.removeEventListener('keydown', handleEscape);
		}
		return () => {};
	});
</script>

{#if isOpen}
	<Portal target="body">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={overlayElement}
			class="onboarding-overlay"
			class:closing={isClosing}
			onclick={handleOverlayClick}
		>
			<div
				bind:this={popupElement}
				class="onboarding-popup"
				aria-labelledby={headingId}
				aria-modal="true"
				role="dialog"
				tabindex="-1"
			>
				<div class="onboarding-header">
					<div class="onboarding-header-logo">
						{#if currentTheme === 'dark'}
							<img alt="Rotector" src={darkLogoUrl} />
						{:else}
							<img alt="Rotector" src={lightLogoUrl} />
						{/if}
					</div>
					<h3 id={headingId} class="onboarding-title">
						{$_('onboarding_guide_title')}
					</h3>
					<div class="onboarding-progress">
						{#each Array.from({ length: TOTAL_STEPS }, (_, i) => i) as stepIndex (stepIndex)}
							<div
								class="onboarding-progress-dot"
								class:active={stepIndex === currentStepIndex}
								class:completed={stepIndex < currentStepIndex}
							></div>
						{/each}
					</div>
					<button
						bind:this={closeButtonEl}
						class="onboarding-close"
						aria-label="Close dialog"
						onclick={() => closeModal(onDismiss)}
						type="button"
					>
						<X aria-hidden="true" color="var(--color-error)" size={24} />
					</button>
				</div>

				<div class="onboarding-content">
					{#if currentStepIndex === 0}
						<GuideStepStatus />
					{:else if currentStepIndex === 1}
						<GuideStepBadges />
					{:else if currentStepIndex === 2}
						<GuideStepFeatures />
					{:else if currentStepIndex === 3}
						<GuideStepScope />
					{/if}
				</div>

				<div class="onboarding-actions">
					{#if currentStepIndex > 0}
						<button class="onboarding-button-secondary" onclick={handleBack} type="button">
							{$_('onboarding_guide_back')}
						</button>
					{/if}
					<button class="onboarding-button-primary" onclick={handleNext} type="button">
						{#if currentStepIndex === TOTAL_STEPS - 1}
							{$_('onboarding_guide_finish')}
						{:else}
							{$_('onboarding_guide_next')}
						{/if}
					</button>
				</div>
			</div>
		</div>
	</Portal>
{/if}
