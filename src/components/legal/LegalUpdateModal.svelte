<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { ExternalLink } from '@lucide/svelte';
	import AckCheckbox from '@/components/ui/AckCheckbox.svelte';
	import AppLogo from '@/components/ui/AppLogo.svelte';
	import ConfirmDialog from '@/components/ui/ConfirmDialog.svelte';
	import Modal from '@/components/ui/Modal.svelte';
	import { acceptLegal, declineLegal, shouldShowLegalModal } from '@/lib/stores/legal';
	import { LEGAL_URLS } from '@/lib/types/constants';

	let isOpen = $state(true);
	let accepted = $state(false);
	let showDeclineConfirm = $state(false);

	// Cross-tab sync to close modal when another tab closes it
	$effect(() => {
		if (!$shouldShowLegalModal && isOpen) {
			isOpen = false;
		}
	});

	async function handleAccept() {
		await acceptLegal();
		isOpen = false;
	}

	function requestDecline() {
		showDeclineConfirm = true;
	}

	function cancelDecline() {
		showDeclineConfirm = false;
	}

	async function confirmDecline() {
		showDeclineConfirm = false;
		await declineLegal();
		isOpen = false;
	}
</script>

<Modal
	showCancel={false}
	showClose={false}
	showConfirm={false}
	showStatusChip={false}
	title={$_('legal_modal_title')}
	bind:isOpen
>
	<div class="onboarding-hero-logo">
		<AppLogo />
	</div>

	<p class="modal-paragraph">{$_('legal_modal_intro')}</p>

	<h3 class="legal-modal-section-heading">{$_('legal_modal_summary_heading')}</h3>
	<ul class="legal-modal-summary">
		<li>{$_('legal_modal_summary_1')}</li>
		<li>{$_('legal_modal_summary_2')}</li>
		<li>{$_('legal_modal_summary_3')}</li>
	</ul>

	<p class="legal-modal-section-heading">{$_('legal_modal_links_heading')}</p>
	<p class="legal-modal-link-row">
		<a href={LEGAL_URLS.terms} rel="noopener noreferrer" target="_blank">
			{$_('legal_modal_link_terms')}
			<ExternalLink aria-hidden="true" size={12} />
		</a>
		<span>·</span>
		<a href={LEGAL_URLS.privacy} rel="noopener noreferrer" target="_blank">
			{$_('legal_modal_link_privacy')}
			<ExternalLink aria-hidden="true" size={12} />
		</a>
	</p>

	<div class="mt-4">
		<AckCheckbox textClass="onboarding-agreement-text" bind:checked={accepted}>
			{#snippet label()}
				{$_('legal_modal_acknowledge')}
			{/snippet}
		</AckCheckbox>
	</div>

	{#snippet actions()}
		<button class="modal-button-cancel" onclick={requestDecline} type="button">
			{$_('legal_modal_decline')}
		</button>
		<button class="modal-button-primary" disabled={!accepted} onclick={handleAccept} type="button">
			{$_('legal_modal_accept')}
		</button>
	{/snippet}
</Modal>

{#if showDeclineConfirm}
	<ConfirmDialog
		cancelKey="legal_decline_confirm_cancel"
		confirmKey="legal_decline_confirm_confirm"
		messageKey="legal_decline_confirm_body"
		onCancel={cancelDecline}
		onConfirm={confirmDecline}
		titleKey="legal_decline_confirm_title"
	/>
{/if}
