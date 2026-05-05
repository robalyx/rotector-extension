<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { LEGAL_URLS } from '@/lib/types/constants';
	import AckCheckbox from '@/components/ui/AckCheckbox.svelte';
	import AppLogo from '@/components/ui/AppLogo.svelte';
	import Modal from '@/components/ui/Modal.svelte';

	interface WelcomeModalProps {
		onContinue: () => void;
		onSkip: () => void;
		onDismiss: () => void;
	}

	let { onContinue, onSkip, onDismiss }: WelcomeModalProps = $props();

	let isOpen = $state(true);
	let tosAccepted = $state(false);
	let responsibleUseAccepted = $state(false);
	let accuracyAccepted = $state(false);
	const canProceed = $derived(tosAccepted && responsibleUseAccepted && accuracyAccepted);
</script>

<Modal
	onCancel={onDismiss}
	showCancel={false}
	showConfirm={false}
	showStatusChip={false}
	title={$_('onboarding_welcome_title')}
	bind:isOpen
>
	<div class="onboarding-hero-logo">
		<AppLogo />
	</div>

	<p class="modal-paragraph">
		{$_('onboarding_welcome_description')}
	</p>

	<div class="queue-ack-list">
		<AckCheckbox textClass="onboarding-agreement-text" bind:checked={tosAccepted}>
			{#snippet label()}
				{$_('onboarding_welcome_agree_tos')}
				<a href={LEGAL_URLS.terms} rel="noopener noreferrer" target="_blank">
					{$_('onboarding_welcome_terms')}
				</a>
				{$_('onboarding_welcome_and')}
				<a href={LEGAL_URLS.privacy} rel="noopener noreferrer" target="_blank">
					{$_('onboarding_welcome_privacy')}
				</a>
			{/snippet}
		</AckCheckbox>

		<AckCheckbox textClass="onboarding-agreement-text" bind:checked={responsibleUseAccepted}>
			{#snippet label()}
				{$_('onboarding_welcome_agree_responsible_use')}
			{/snippet}
		</AckCheckbox>

		<AckCheckbox textClass="onboarding-agreement-text" bind:checked={accuracyAccepted}>
			{#snippet label()}
				{$_('onboarding_welcome_agree_accuracy')}
			{/snippet}
		</AckCheckbox>
	</div>

	{#snippet actions()}
		<button
			class="modal-button-cancel"
			disabled={!canProceed}
			onclick={() => {
				isOpen = false;
				onSkip();
			}}
			type="button"
		>
			{$_('onboarding_welcome_skip')}
		</button>
		<button
			class="modal-button-primary"
			disabled={!canProceed}
			onclick={() => {
				isOpen = false;
				onContinue();
			}}
			type="button"
		>
			{$_('onboarding_welcome_continue')}
		</button>
	{/snippet}
</Modal>
