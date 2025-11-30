<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Portal from 'svelte-portal';
	import { X, Globe, Languages, ChevronDown } from 'lucide-svelte';
	import { getAvailableLocales, setLanguage } from '@/lib/stores/i18n';
	import { settings, updateSetting } from '@/lib/stores/settings';
	import { SETTINGS_KEYS } from '@/lib/types/settings';
	import { hasTranslatePermission, requestTranslatePermission } from '@/lib/utils/permissions';
	import CloseConfirmDialog from './CloseConfirmDialog.svelte';

	interface LanguageModalProps {
		onContinue: () => void;
		onDismiss: () => void;
	}

	let { onContinue, onDismiss }: LanguageModalProps = $props();

	let isOpen = $state(true);
	let isClosing = $state(false);
	let showConfirmDialog = $state(false);
	let overlayElement = $state<HTMLDivElement>();
	let popupElement = $state<HTMLDivElement>();
	let closeButtonEl = $state<HTMLButtonElement>();
	let previouslyFocusedElement = $state<HTMLElement | null>(null);
	const headingId = `language-modal-title-${Math.random().toString(36).slice(2)}`;

	const availableLocales = getAvailableLocales();
	let translateEnabled = $state($settings[SETTINGS_KEYS.TRANSLATE_VIOLATIONS_ENABLED]);

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

	// Close modal and proceed to next step
	function handleContinue() {
		isClosing = true;
		setTimeout(() => {
			isOpen = false;
			isClosing = false;
			onContinue();
		}, 300);
	}

	// Handle language change
	async function handleLanguageChange(value: string) {
		await setLanguage(value);
	}

	// Handle translate toggle change
	function handleTranslateChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const newValue = target.checked;

		// Update UI and save setting
		translateEnabled = newValue;
		void updateSetting(SETTINGS_KEYS.TRANSLATE_VIOLATIONS_ENABLED, newValue);

		// Request permission when enabling
		if (newValue) {
			void (async () => {
				const alreadyHasPermission = await hasTranslatePermission();
				if (!alreadyHasPermission) {
					await requestTranslatePermission();
				}
			})();
		}
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
						{$_('onboarding_language_title')}
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
					<div class="onboarding-language-intro">
						<p>{$_('onboarding_language_description')}</p>
					</div>

					<div class="onboarding-language-sections">
						<div class="onboarding-language-section">
							<div class="onboarding-language-section-header">
								<div class="onboarding-language-icon">
									<Languages size={20} />
								</div>
								<label class="onboarding-language-label" for="language-select">
									{$_('onboarding_language_label')}
								</label>
							</div>
							<div class="onboarding-select-wrapper">
								<select
									id="language-select"
									class="onboarding-language-select"
									onchange={(e) => handleLanguageChange(e.currentTarget.value)}
									value={$settings[SETTINGS_KEYS.LANGUAGE_OVERRIDE]}
								>
									<option value="auto">{$_('onboarding_language_auto')}</option>
									{#each availableLocales as locale (locale.code)}
										<option value={locale.code}>{locale.name}</option>
									{/each}
								</select>
								<ChevronDown class="onboarding-select-chevron" size={16} />
							</div>
						</div>

						<div class="onboarding-language-section">
							<div class="onboarding-language-section-header">
								<div class="onboarding-language-icon">
									<Globe size={20} />
								</div>
								<label class="onboarding-language-label" for="translate-toggle">
									{$_('onboarding_translate_label')}
								</label>
							</div>
							<p class="onboarding-translate-description">
								{$_('onboarding_translate_description')}
							</p>
							<label class="onboarding-toggle-wrapper">
								<input
									id="translate-toggle"
									class="onboarding-toggle-input"
									checked={translateEnabled}
									onchange={handleTranslateChange}
									type="checkbox"
								/>
								<span class="onboarding-toggle-slider"></span>
								<span class="onboarding-toggle-label">
									{translateEnabled
										? $_('onboarding_translate_enabled')
										: $_('onboarding_translate_disabled')}
								</span>
							</label>
						</div>
					</div>
				</div>

				<div class="onboarding-actions">
					<button class="onboarding-button-primary" onclick={handleContinue} type="button">
						{$_('onboarding_language_continue')}
					</button>
				</div>
			</div>
		</div>

		{#if showConfirmDialog}
			<CloseConfirmDialog onCancel={cancelClose} onConfirm={confirmClose} />
		{/if}
	</Portal>
{/if}
