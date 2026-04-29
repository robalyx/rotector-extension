<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Check, X } from '@lucide/svelte';
	import { getAssetUrl } from '@/lib/utils/assets';
	import { themeManager } from '@/lib/utils/theme';
	import { LEGAL_URLS } from '@/lib/types/constants';
	import CloseConfirmDialog from './CloseConfirmDialog.svelte';

	const lightLogoUrl = getAssetUrl('/assets/rotector-logo-light.webp');
	const darkLogoUrl = getAssetUrl('/assets/rotector-logo-dark.webp');

	interface WelcomeModalProps {
		onContinue: () => void;
		onSkip: () => void;
		onDismiss: () => void;
	}

	let { onContinue, onSkip, onDismiss }: WelcomeModalProps = $props();

	let isOpen = $state(true);
	let isClosing = $state(false);
	let showConfirmDialog = $state(false);
	let tosAccepted = $state(false);
	let responsibleUseAccepted = $state(false);
	let accuracyAccepted = $state(false);
	const canProceed = $derived(tosAccepted && responsibleUseAccepted && accuracyAccepted);
	let overlayElement = $state<HTMLDivElement>();
	let popupElement = $state<HTMLDivElement>();
	let closeButtonEl = $state<HTMLButtonElement>();
	let previouslyFocusedElement = $state<HTMLElement | null>(null);
	let currentTheme = $state<'light' | 'dark'>('light');
	const headingId = `welcome-modal-title-${Math.random().toString(36).slice(2)}`;

	// Subscribe to theme changes for logo switching
	$effect(() => {
		const unsubscribe = themeManager.effectiveTheme.subscribe((theme) => {
			currentTheme = theme;
		});
		return unsubscribe;
	});

	// Show close confirmation dialog
	function requestClose() {
		showConfirmDialog = true;
	}

	// Animate modal close and execute callback
	function closeModal(callback: () => void) {
		isClosing = true;
		setTimeout(() => {
			isOpen = false;
			isClosing = false;
			callback();
		}, 250);
	}

	// Close modal and trigger dismiss callback
	function confirmClose() {
		showConfirmDialog = false;
		closeModal(() => {
			onDismiss();
			previouslyFocusedElement?.focus();
		});
	}

	// Hide close confirmation dialog
	function cancelClose() {
		showConfirmDialog = false;
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
					{$_('onboarding_welcome_title')}
				</h3>
				<button
					bind:this={closeButtonEl}
					class="modal-close"
					aria-label="Close dialog"
					onclick={requestClose}
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

				<p class="modal-paragraph">
					{$_('onboarding_welcome_description')}
				</p>

				<div class="queue-ack-list">
					<label class="queue-ack-item">
						<input class="queue-ack-checkbox" type="checkbox" bind:checked={tosAccepted} />
						<span class="queue-ack-checkmark" class:checked={tosAccepted}>
							{#if tosAccepted}
								<Check aria-hidden="true" size={14} strokeWidth={3} />
							{/if}
						</span>
						<span class="onboarding-agreement-text">
							{$_('onboarding_welcome_agree_tos')}
							<a href={LEGAL_URLS.terms} rel="noopener noreferrer" target="_blank">
								{$_('onboarding_welcome_terms')}
							</a>
							{$_('onboarding_welcome_and')}
							<a href={LEGAL_URLS.privacy} rel="noopener noreferrer" target="_blank">
								{$_('onboarding_welcome_privacy')}
							</a>
						</span>
					</label>

					<label class="queue-ack-item">
						<input
							class="queue-ack-checkbox"
							type="checkbox"
							bind:checked={responsibleUseAccepted}
						/>
						<span class="queue-ack-checkmark" class:checked={responsibleUseAccepted}>
							{#if responsibleUseAccepted}
								<Check aria-hidden="true" size={14} strokeWidth={3} />
							{/if}
						</span>
						<span class="onboarding-agreement-text">
							{$_('onboarding_welcome_agree_responsible_use')}
						</span>
					</label>

					<label class="queue-ack-item">
						<input class="queue-ack-checkbox" type="checkbox" bind:checked={accuracyAccepted} />
						<span class="queue-ack-checkmark" class:checked={accuracyAccepted}>
							{#if accuracyAccepted}
								<Check aria-hidden="true" size={14} strokeWidth={3} />
							{/if}
						</span>
						<span class="onboarding-agreement-text">
							{$_('onboarding_welcome_agree_accuracy')}
						</span>
					</label>
				</div>
			</div>

			<div class="modal-divider"></div>

			<div class="modal-actions">
				<button
					class="modal-button-cancel"
					disabled={!canProceed}
					onclick={() => closeModal(onSkip)}
					type="button"
				>
					{$_('onboarding_welcome_skip')}
				</button>
				<button
					class="modal-button-primary"
					disabled={!canProceed}
					onclick={() => closeModal(onContinue)}
					type="button"
				>
					{$_('onboarding_welcome_continue')}
				</button>
			</div>
		</div>
	</div>

	{#if showConfirmDialog}
		<CloseConfirmDialog onCancel={cancelClose} onConfirm={confirmClose} />
	{/if}
{/if}
