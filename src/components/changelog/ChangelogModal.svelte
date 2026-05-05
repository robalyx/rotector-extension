<script lang="ts">
	import { _ } from 'svelte-i18n';
	import ChangelogContent from './ChangelogContent.svelte';
	import {
		unreadChangelogs,
		shouldShowChangelogModal,
		markChangelogsSeen,
		disableChangelogModal
	} from '@/lib/stores/changelog';
	import AckCheckbox from '@/components/ui/AckCheckbox.svelte';
	import AppLogo from '@/components/ui/AppLogo.svelte';
	import Modal from '@/components/ui/Modal.svelte';

	interface ChangelogModalProps {
		onClose: () => void;
	}

	let { onClose }: ChangelogModalProps = $props();

	let isOpen = $state(true);
	let dontShowAgain = $state(false);

	// Cross-tab sync to close modal when another tab closes it
	$effect(() => {
		if (!$shouldShowChangelogModal && isOpen) {
			isOpen = false;
			onClose();
		}
	});

	async function handleClose() {
		await markChangelogsSeen();
		if (dontShowAgain) {
			await disableChangelogModal();
		}
		isOpen = false;
		onClose();
	}
</script>

<Modal
	onClose={handleClose}
	showCancel={false}
	showConfirm={false}
	showStatusChip={false}
	title={$_('changelog_modal_title')}
	bind:isOpen
>
	<div class="onboarding-hero-logo">
		<AppLogo />
	</div>
	{#each $unreadChangelogs as changelog (changelog.id)}
		<div class="changelog-modal-item">
			<ChangelogContent {changelog} />
		</div>
	{/each}

	{#snippet actions()}
		<AckCheckbox textClass="" variant="changelog-disable" bind:checked={dontShowAgain}>
			{#snippet label()}{$_('changelog_modal_disable_checkbox')}{/snippet}
		</AckCheckbox>
		<button class="modal-button-primary" onclick={handleClose} type="button">
			{$_('changelog_modal_close')}
		</button>
	{/snippet}
</Modal>
