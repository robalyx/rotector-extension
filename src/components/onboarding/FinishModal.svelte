<script lang="ts">
	import { _ } from 'svelte-i18n';
	import AppLogo from '@/components/ui/AppLogo.svelte';
	import Modal from '@/components/ui/Modal.svelte';

	interface FinishModalProps {
		onFinish: () => void;
	}

	let { onFinish }: FinishModalProps = $props();

	let isOpen = $state(true);
</script>

<Modal
	ariaLabel={$_('onboarding_finish_title')}
	confirmText={$_('onboarding_finish_button')}
	onConfirm={onFinish}
	showCancel={false}
	showClose={false}
	showStatusChip={false}
	size="small"
	title=""
	bind:isOpen
>
	<div class="onboarding-hero-logo">
		<AppLogo />
	</div>

	<h3 class="onboarding-finish-title">
		{$_('onboarding_finish_title')}
	</h3>

	<p class="modal-paragraph">{$_('onboarding_finish_protection')}</p>

	<p class="onboarding-agreement-text">
		{$_('onboarding_finish_feedback')}
		<a href="https://discord.gg/2Cn7kXqqhY" rel="noopener noreferrer" target="_blank">
			{$_('onboarding_finish_discord')}
		</a>.
	</p>
</Modal>
