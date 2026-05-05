<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Info, EyeOff, Eye } from '@lucide/svelte';
	import { applyAgePreset } from '@/lib/stores/settings';
	import { AGE_PRESETS } from '@/lib/types/settings';
	import Modal from '@/components/ui/Modal.svelte';
	import PresetCard from '@/components/ui/PresetCard.svelte';

	interface PresetModalProps {
		onContinue: () => void;
		onDismiss: () => void;
	}

	let { onContinue, onDismiss }: PresetModalProps = $props();

	let isOpen = $state(true);
	let selectedPreset = $state<typeof AGE_PRESETS.MINOR | typeof AGE_PRESETS.ADULT | null>(null);

	function selectPreset(preset: typeof AGE_PRESETS.MINOR | typeof AGE_PRESETS.ADULT) {
		selectedPreset = preset;
	}

	async function handleContinue() {
		if (!selectedPreset) return;
		await applyAgePreset(selectedPreset);
		isOpen = false;
		onContinue();
	}
</script>

<Modal
	onCancel={onDismiss}
	showCancel={false}
	showConfirm={false}
	showStatusChip={false}
	title={$_('onboarding_preset_title')}
	bind:isOpen
>
	<p class="modal-paragraph">{$_('onboarding_preset_description')}</p>

	<div class="onboarding-preset-cards">
		<PresetCard
			active={selectedPreset === AGE_PRESETS.MINOR}
			description={$_('onboarding_preset_minor_description')}
			label={$_('onboarding_preset_minor_title')}
			onclick={() => selectPreset(AGE_PRESETS.MINOR)}
		>
			{#snippet icon()}<EyeOff size={20} />{/snippet}
		</PresetCard>

		<PresetCard
			active={selectedPreset === AGE_PRESETS.ADULT}
			description={$_('onboarding_preset_adult_description')}
			label={$_('onboarding_preset_adult_title')}
			onclick={() => selectPreset(AGE_PRESETS.ADULT)}
		>
			{#snippet icon()}<Eye size={20} />{/snippet}
		</PresetCard>
	</div>

	<div class="onboarding-preset-notice">
		<Info size={12} />
		<span>{$_('onboarding_preset_notice')}</span>
	</div>

	{#snippet actions()}
		<button
			class="modal-button-primary"
			disabled={!selectedPreset}
			onclick={handleContinue}
			type="button"
		>
			{$_('onboarding_preset_continue')}
		</button>
	{/snippet}
</Modal>
