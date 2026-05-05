<script lang="ts">
	import { sanitizeEntityId } from '@/lib/utils/dom/sanitizer';
	import { _ } from 'svelte-i18n';
	import Modal from '../../ui/Modal.svelte';
	import type { QueueErrorData } from '@/lib/types/api';

	interface Props {
		isOpen: boolean;
		userId: string | number;
		errorData: QueueErrorData;
		onClose?: () => void;
	}

	let { isOpen = $bindable(), userId, errorData, onClose }: Props = $props();

	const sanitizedUserId = $derived(sanitizeEntityId(userId) ?? '');

	function handleClose() {
		onClose?.();
		isOpen = false;
	}
</script>

<Modal
	confirmDanger
	confirmText={$_('queue_error_modal_close_button')}
	onConfirm={handleClose}
	showCancel={false}
	status="error"
	title={$_('queue_error_modal_title')}
	bind:isOpen
>
	<p class="modal-paragraph">
		{$_('queue_error_modal_failed_message', { values: { 0: sanitizedUserId } })}
	</p>

	<div class="modal-section">
		<header class="modal-section-head">
			<h3 class="modal-section-title">{$_('queue_error_modal_details_heading')}</h3>
		</header>
		<p class="modal-paragraph">{errorData.error}</p>
		<dl class="queue-error-meta">
			<div class="queue-error-meta-row">
				<dt>{$_('queue_error_modal_error_code_label')}</dt>
				<dd>{errorData.code}</dd>
			</div>
			<div class="queue-error-meta-row">
				<dt>{$_('queue_error_modal_request_id_label')}</dt>
				<dd>{errorData.requestId}</dd>
			</div>
		</dl>
	</div>

	<div class="modal-section">
		<header class="modal-section-head">
			<h3 class="modal-section-title">{$_('queue_error_modal_next_steps_heading')}</h3>
		</header>
		<ul class="modal-list">
			<li class="modal-list-item">
				<span class="modal-list-bullet" aria-hidden="true"></span>
				{$_('queue_error_modal_step1')}
			</li>
			<li class="modal-list-item">
				<span class="modal-list-bullet" aria-hidden="true"></span>
				{$_('queue_error_modal_step2')}
			</li>
			<li class="modal-list-item">
				<span class="modal-list-bullet" aria-hidden="true"></span>
				{$_('queue_error_modal_step3')}
			</li>
		</ul>
	</div>
</Modal>
