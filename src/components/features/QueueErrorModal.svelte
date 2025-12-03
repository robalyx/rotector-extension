<script lang="ts">
	import { sanitizeEntityId } from '@/lib/utils/sanitizer';
	import { _ } from 'svelte-i18n';
	import Modal from '../ui/Modal.svelte';
	import type { QueueErrorData } from '@/lib/types/api';
	import { AlertTriangle, Info } from 'lucide-svelte';

	interface Props {
		isOpen: boolean;
		userId: string | number;
		errorData: QueueErrorData;
		onClose?: () => void;
	}

	let { isOpen = $bindable(), userId, errorData, onClose }: Props = $props();

	// Computed values
	const sanitizedUserId = $derived(() => {
		const id = sanitizeEntityId(userId);
		return id ? id.toString() : '';
	});

	const errorMessage = $derived(() => {
		return errorData.error || $_('queue_error_modal_unknown_error');
	});

	const requestId = $derived(() => {
		return errorData.requestId || 'N/A';
	});

	const errorCode = $derived(() => {
		return errorData.code || 'UNKNOWN_ERROR';
	});

	// Handle close
	function handleClose() {
		if (onClose) {
			onClose();
		}
		isOpen = false;
	}
</script>

<Modal
	actionsLayout="horizontal"
	confirmText={$_('queue_error_modal_close_button')}
	confirmVariant="danger"
	icon="error"
	modalType="queue-error"
	onConfirm={handleClose}
	showCancel={false}
	title={$_('queue_error_modal_title')}
	bind:isOpen
>
	<div>
		<p class="text-text mb-4!">
			{$_('queue_error_modal_failed_message', { values: { 0: sanitizedUserId() } })}
		</p>

		<div class="modal-content-section-warning">
			<h3 class="modal-content-heading">
				<AlertTriangle class="mr-2 text-orange-500" size={18} />
				{$_('queue_error_modal_details_heading')}
			</h3>
			<div>
				<p class="text-text">
					{errorMessage()}
				</p>
				<br />
				<p class="text-text-subtle text-sm">
					<strong>{$_('queue_error_modal_error_code_label')}</strong>
					{errorCode()}
				</p>
				<p class="text-text-subtle text-sm">
					<strong>{$_('queue_error_modal_request_id_label')}</strong>
					{requestId()}
				</p>
			</div>
		</div>

		<div class="modal-content-section-info">
			<h3 class="modal-content-heading">
				<Info class="mr-2 text-blue-500" size={18} />
				{$_('queue_error_modal_next_steps_heading')}
			</h3>
			<ul class="modal-content-list">
				<li class="modal-content-list-item-info">
					{$_('queue_error_modal_step1')}
				</li>
				<li class="modal-content-list-item-info">
					{$_('queue_error_modal_step2')}
				</li>
				<li class="modal-content-list-item-info">
					{$_('queue_error_modal_step3')}
				</li>
			</ul>
		</div>
	</div>
</Modal>
