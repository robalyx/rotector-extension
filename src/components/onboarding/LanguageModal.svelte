<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Globe, Languages } from '@lucide/svelte';
	import { getAvailableLocales, setLanguage } from '@/lib/stores/i18n';
	import { settings, updateSetting } from '@/lib/stores/settings';
	import { SETTINGS_KEYS } from '@/lib/types/settings';
	import { hasTranslatePermission, requestTranslatePermission } from '@/lib/utils/permissions';
	import Toggle from '@/components/ui/Toggle.svelte';
	import Modal from '@/components/ui/Modal.svelte';

	interface LanguageModalProps {
		onContinue: () => void;
		onDismiss: () => void;
	}

	let { onContinue, onDismiss }: LanguageModalProps = $props();

	let isOpen = $state(true);
	const availableLocales = getAvailableLocales();
	let translateEnabled = $state($settings[SETTINGS_KEYS.TRANSLATE_VIOLATIONS_ENABLED]);

	async function handleLanguageChange(value: string) {
		await setLanguage(value);
	}

	async function ensureTranslatePermission(): Promise<void> {
		const hasPermission = await hasTranslatePermission();
		if (!hasPermission) {
			await requestTranslatePermission();
		}
	}

	function handleTranslateChange(checked: boolean) {
		translateEnabled = checked;
		void updateSetting(SETTINGS_KEYS.TRANSLATE_VIOLATIONS_ENABLED, checked);

		if (checked) {
			void ensureTranslatePermission();
		}
	}
</script>

<Modal
	confirmText={$_('onboarding_language_continue')}
	onCancel={onDismiss}
	onConfirm={onContinue}
	showCancel={false}
	showStatusChip={false}
	title={$_('onboarding_language_title')}
	bind:isOpen
>
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
</Modal>
