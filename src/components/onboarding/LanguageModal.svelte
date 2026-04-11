<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { X, Globe, Languages } from '@lucide/svelte';
	import { getAvailableLocales, setLanguage } from '@/lib/stores/i18n';
	import { settings, updateSetting } from '@/lib/stores/settings';
	import { SETTINGS_KEYS } from '@/lib/types/settings';
	import { hasTranslatePermission, requestTranslatePermission } from '@/lib/utils/permissions';
	import Toggle from '@/components/ui/Toggle.svelte';

	interface LanguageModalProps {
		onContinue: () => void;
		onDismiss: () => void;
	}

	let { onContinue, onDismiss }: LanguageModalProps = $props();

	let isOpen = $state(true);
	let isClosing = $state(false);
	let overlayElement = $state<HTMLDivElement>();
	let popupElement = $state<HTMLDivElement>();
	let closeButtonEl = $state<HTMLButtonElement>();
	const headingId = `language-modal-title-${Math.random().toString(36).slice(2)}`;

	const availableLocales = getAvailableLocales();
	let translateEnabled = $state($settings[SETTINGS_KEYS.TRANSLATE_VIOLATIONS_ENABLED]);

	// Animate modal close and execute callback
	function closeModal(callback: () => void) {
		isClosing = true;
		setTimeout(() => {
			isOpen = false;
			isClosing = false;
			callback();
		}, 250);
	}

	// Handle language change
	async function handleLanguageChange(value: string) {
		await setLanguage(value);
	}

	// Request translate permission when toggle is enabled by user action
	async function ensureTranslatePermission(): Promise<void> {
		const hasPermission = await hasTranslatePermission();
		if (!hasPermission) {
			await requestTranslatePermission();
		}
	}

	// Handle translate toggle change
	function handleTranslateChange(checked: boolean) {
		translateEnabled = checked;
		void updateSetting(SETTINGS_KEYS.TRANSLATE_VIOLATIONS_ENABLED, checked);

		if (checked) {
			void ensureTranslatePermission();
		}
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
					{$_('onboarding_language_title')}
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
				<p class="modal-paragraph">{$_('onboarding_language_description')}</p>

				<div class="modal-section">
					<header class="onboarding-language-label-row">
						<Languages class="onboarding-language-icon" />
						<h4 class="modal-section-title">{$_('onboarding_language_label')}</h4>
					</header>
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
				</div>

				<div class="modal-section">
					<header class="onboarding-language-label-row">
						<Globe class="onboarding-language-icon" />
						<h4 class="modal-section-title">{$_('onboarding_translate_label')}</h4>
					</header>
					<div class="onboarding-translate-row">
						<p class="onboarding-translate-description">
							{$_('onboarding_translate_description')}
						</p>
						<Toggle checked={translateEnabled} onchange={handleTranslateChange} />
					</div>
				</div>
			</div>

			<div class="modal-divider"></div>

			<div class="modal-actions">
				<button class="modal-button-primary" onclick={() => closeModal(onContinue)} type="button">
					{$_('onboarding_language_continue')}
				</button>
			</div>
		</div>
	</div>
{/if}
