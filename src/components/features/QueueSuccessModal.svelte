<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Modal from '../ui/Modal.svelte';
	import type { QueueSuccessData } from '@/lib/types/api';

	interface Props {
		isOpen: boolean;
		successData: QueueSuccessData;
		onClose?: () => void;
	}

	let { isOpen = $bindable(), successData, onClose }: Props = $props();

	// Handle close
	function handleClose() {
		if (onClose) {
			onClose();
		}
		isOpen = false;
	}
</script>

<Modal
	confirmText={$_('queue_success_modal_close_button')}
	onConfirm={handleClose}
	showCancel={false}
	status="success"
	title={$_('queue_success_modal_title')}
	bind:isOpen
>
	<p class="modal-paragraph">
		{$_('queue_success_modal_success_message', { values: { 0: String(successData.queued) } })}
	</p>

	<div class="modal-section">
		<header class="modal-section-head">
			<h3 class="modal-section-title">{$_('queue_success_modal_next_steps_heading')}</h3>
		</header>
		<ul class="modal-list">
			<li class="modal-list-item">
				<span class="modal-list-bullet-success" aria-hidden="true"></span>
				{$_('queue_success_modal_step1')}
			</li>
			<li class="modal-list-item">
				<span class="modal-list-bullet-success" aria-hidden="true"></span>
				{$_('queue_success_modal_step2')}
			</li>
			<li class="modal-list-item">
				<span class="modal-list-bullet-success" aria-hidden="true"></span>
				{$_('queue_success_modal_step3')}
			</li>
		</ul>
	</div>
</Modal>
