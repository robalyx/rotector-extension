<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Modal from './Modal.svelte';

	interface Props {
		titleKey: string;
		messageKey: string;
		cancelKey: string;
		confirmKey: string;
		onCancel: () => void;
		onConfirm: () => void;
	}

	let { titleKey, messageKey, cancelKey, confirmKey, onCancel, onConfirm }: Props = $props();

	let isOpen = $state(true);
</script>

<Modal
	cancelText={$_(cancelKey)}
	confirmDanger
	confirmText={$_(confirmKey)}
	{onCancel}
	{onConfirm}
	showClose={false}
	showStatusChip={false}
	size="small"
	title={$_(titleKey)}
	bind:isOpen
>
	<p class="modal-paragraph">{$_(messageKey)}</p>
</Modal>
