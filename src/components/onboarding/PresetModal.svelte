<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { X, Info, EyeOff, Eye } from '@lucide/svelte';
	import { applyAgePreset } from '@/lib/stores/settings';
	import { AGE_PRESETS } from '@/lib/types/settings';

	interface PresetModalProps {
		onContinue: () => void;
		onDismiss: () => void;
	}

	let { onContinue, onDismiss }: PresetModalProps = $props();

	let isOpen = $state(true);
	let isClosing = $state(false);
	let overlayElement = $state<HTMLDivElement>();
	let popupElement = $state<HTMLDivElement>();
	let closeButtonEl = $state<HTMLButtonElement>();
	let selectedPreset = $state<typeof AGE_PRESETS.MINOR | typeof AGE_PRESETS.ADULT | null>(null);
	const headingId = `preset-modal-title-${Math.random().toString(36).slice(2)}`;

	// Animate modal close and execute callback
	function closeModal(callback: () => void) {
		isClosing = true;
		setTimeout(() => {
			isOpen = false;
			isClosing = false;
			callback();
		}, 250);
	}

	// Select a preset
	function selectPreset(preset: typeof AGE_PRESETS.MINOR | typeof AGE_PRESETS.ADULT) {
		selectedPreset = preset;
	}

	// Apply selected preset and proceed to next step
	async function handleContinue() {
		if (!selectedPreset) return;
		await applyAgePreset(selectedPreset);
		closeModal(onContinue);
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
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={overlayElement}
		class="modal-overlay"
		class:closing={isClosing}
		onclick={handleOverlayClick}
	>
		<div
			bind:this={popupElement}
			class="modal-popup"
			aria-labelledby={headingId}
			aria-modal="true"
			role="dialog"
			tabindex="-1"
		>
			<div class="modal-header">
				<h3 id={headingId} class="modal-title">
					{$_('onboarding_preset_title')}
				</h3>
				<button
					bind:this={closeButtonEl}
					class="modal-close"
					aria-label="Close dialog"
					onclick={() => closeModal(onDismiss)}
					type="button"
				>
					<X aria-hidden="true" size={16} />
				</button>
			</div>

			<div class="modal-divider"></div>

			<div class="modal-content">
				<p class="modal-paragraph">{$_('onboarding_preset_description')}</p>

				<div class="onboarding-preset-cards">
					<button
						class="preset-card"
						class:active={selectedPreset === AGE_PRESETS.MINOR}
						aria-pressed={selectedPreset === AGE_PRESETS.MINOR}
						onclick={() => selectPreset(AGE_PRESETS.MINOR)}
						type="button"
					>
						<div class="onboarding-preset-icon">
							<EyeOff size={20} />
						</div>
						<span class="preset-card-label">{$_('onboarding_preset_minor_title')}</span>
						<span class="preset-card-description">
							{$_('onboarding_preset_minor_description')}
						</span>
					</button>

					<button
						class="preset-card"
						class:active={selectedPreset === AGE_PRESETS.ADULT}
						aria-pressed={selectedPreset === AGE_PRESETS.ADULT}
						onclick={() => selectPreset(AGE_PRESETS.ADULT)}
						type="button"
					>
						<div class="onboarding-preset-icon">
							<Eye size={20} />
						</div>
						<span class="preset-card-label">{$_('onboarding_preset_adult_title')}</span>
						<span class="preset-card-description">
							{$_('onboarding_preset_adult_description')}
						</span>
					</button>
				</div>

				<div class="onboarding-preset-notice">
					<Info size={12} />
					<span>{$_('onboarding_preset_notice')}</span>
				</div>
			</div>

			<div class="modal-divider"></div>

			<div class="modal-actions">
				<button
					class="modal-button-primary"
					disabled={!selectedPreset}
					onclick={handleContinue}
					type="button"
				>
					{$_('onboarding_preset_continue')}
				</button>
			</div>
		</div>
	</div>
{/if}
