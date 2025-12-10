<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Portal from 'svelte-portal';
	import { X, Info, EyeOff, Eye } from 'lucide-svelte';
	import { applyAgePreset } from '@/lib/stores/settings';
	import { AGE_PRESETS } from '@/lib/types/settings';
	import CloseConfirmDialog from './CloseConfirmDialog.svelte';

	interface PresetModalProps {
		onContinue: () => void;
		onDismiss: () => void;
	}

	let { onContinue, onDismiss }: PresetModalProps = $props();

	let isOpen = $state(true);
	let isClosing = $state(false);
	let showConfirmDialog = $state(false);
	let overlayElement = $state<HTMLDivElement>();
	let popupElement = $state<HTMLDivElement>();
	let closeButtonEl = $state<HTMLButtonElement>();
	let previouslyFocusedElement = $state<HTMLElement | null>(null);
	let selectedPreset = $state<typeof AGE_PRESETS.MINOR | typeof AGE_PRESETS.ADULT | null>(null);
	const headingId = `preset-modal-title-${Math.random().toString(36).slice(2)}`;

	// Show close confirmation dialog
	function requestClose() {
		showConfirmDialog = true;
	}

	// Close modal and trigger dismiss callback
	function confirmClose() {
		showConfirmDialog = false;
		isClosing = true;
		setTimeout(() => {
			isOpen = false;
			isClosing = false;
			onDismiss();
			previouslyFocusedElement?.focus();
		}, 300);
	}

	// Hide close confirmation dialog
	function cancelClose() {
		showConfirmDialog = false;
	}

	// Select a preset
	function selectPreset(preset: typeof AGE_PRESETS.MINOR | typeof AGE_PRESETS.ADULT) {
		selectedPreset = preset;
	}

	// Close modal and proceed to next step
	async function handleContinue() {
		if (!selectedPreset) return;

		await applyAgePreset(selectedPreset);

		isClosing = true;
		setTimeout(() => {
			isOpen = false;
			isClosing = false;
			onContinue();
		}, 300);
	}

	// Handle escape key to close or cancel confirmation
	function handleEscape(e: KeyboardEvent) {
		if (e.key === 'Escape' && isOpen) {
			if (showConfirmDialog) {
				cancelClose();
			} else {
				requestClose();
			}
		}
	}

	// Handle clicks on overlay to trigger close
	function handleOverlayClick(e: MouseEvent) {
		if (e.target === overlayElement) {
			requestClose();
		}
	}

	// Initialize modal and set up keyboard listeners
	$effect(() => {
		if (isOpen) {
			previouslyFocusedElement = document.activeElement as HTMLElement | null;
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
					<h3 id={headingId} class="onboarding-title">
						{$_('onboarding_preset_title')}
					</h3>
					<button
						bind:this={closeButtonEl}
						class="onboarding-close"
						aria-label="Close dialog"
						onclick={requestClose}
						type="button"
					>
						<X aria-hidden="true" color="var(--color-error)" size={24} />
					</button>
				</div>

				<div class="onboarding-content">
					<div class="onboarding-preset-intro">
						<p>{$_('onboarding_preset_description')}</p>
					</div>

					<div class="onboarding-preset-cards">
						<button
							class="onboarding-preset-card"
							class:selected={selectedPreset === AGE_PRESETS.MINOR}
							onclick={() => selectPreset(AGE_PRESETS.MINOR)}
							type="button"
						>
							<div class="onboarding-preset-icon">
								<EyeOff size={28} />
							</div>
							<div class="onboarding-preset-title">
								{$_('onboarding_preset_minor_title')}
							</div>
							<div class="onboarding-preset-description">
								{$_('onboarding_preset_minor_description')}
							</div>
						</button>

						<button
							class="onboarding-preset-card"
							class:selected={selectedPreset === AGE_PRESETS.ADULT}
							onclick={() => selectPreset(AGE_PRESETS.ADULT)}
							type="button"
						>
							<div class="onboarding-preset-icon">
								<Eye size={28} />
							</div>
							<div class="onboarding-preset-title">
								{$_('onboarding_preset_adult_title')}
							</div>
							<div class="onboarding-preset-description">
								{$_('onboarding_preset_adult_description')}
							</div>
						</button>
					</div>

					<div class="onboarding-preset-notice">
						<Info size={14} />
						<span>{$_('onboarding_preset_notice')}</span>
					</div>
				</div>

				<div class="onboarding-actions">
					<button
						class="onboarding-button-primary"
						disabled={!selectedPreset}
						onclick={handleContinue}
						type="button"
					>
						{$_('onboarding_preset_continue')}
					</button>
				</div>
			</div>
		</div>

		{#if showConfirmDialog}
			<CloseConfirmDialog onCancel={cancelClose} onConfirm={confirmClose} />
		{/if}
	</Portal>
{/if}
