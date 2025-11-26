<script lang="ts">
	import { _ } from 'svelte-i18n';

	interface CloseConfirmDialogProps {
		onCancel: () => void;
		onConfirm: () => void;
	}

	let { onCancel, onConfirm }: CloseConfirmDialogProps = $props();
</script>

<div class="onboarding-confirm-overlay visible">
	<div class="onboarding-confirm-popup" aria-modal="true" role="alertdialog">
		<h4 class="onboarding-confirm-title">{$_('onboarding_close_confirm_title')}</h4>
		<p class="onboarding-confirm-message">{$_('onboarding_close_confirm_message')}</p>
		<div class="onboarding-confirm-actions">
			<button class="onboarding-button-secondary" onclick={onCancel} type="button">
				{$_('onboarding_close_confirm_continue')}
			</button>
			<button class="onboarding-button-primary" onclick={onConfirm} type="button">
				{$_('onboarding_close_confirm_exit')}
			</button>
		</div>
	</div>
</div>
