<script lang="ts">
	import { _ } from 'svelte-i18n';

	interface LegalDeclineConfirmProps {
		onCancel: () => void;
		onConfirm: () => void;
	}

	let { onCancel, onConfirm }: LegalDeclineConfirmProps = $props();
</script>

<div class="onboarding-confirm-overlay visible">
	<div class="onboarding-confirm-popup" aria-modal="true" role="alertdialog">
		<h4 class="onboarding-confirm-title">{$_('legal_decline_confirm_title')}</h4>
		<p class="onboarding-confirm-message">{$_('legal_decline_confirm_body')}</p>
		<div class="onboarding-confirm-actions">
			<button class="modal-button-cancel" onclick={onCancel} type="button">
				{$_('legal_decline_confirm_cancel')}
			</button>
			<button class="modal-button-danger" onclick={onConfirm} type="button">
				{$_('legal_decline_confirm_confirm')}
			</button>
		</div>
	</div>
</div>
