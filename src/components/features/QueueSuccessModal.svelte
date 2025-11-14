<script lang="ts">
	import { t } from '@/lib/stores/i18n';
	import Modal from '../ui/Modal.svelte';
	import type { QueueSuccessData } from '@/lib/types/api';
	import { Check } from 'lucide-svelte';

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
	actionsLayout="horizontal"
	confirmText={t('queue_success_modal_close_button')}
	confirmVariant="primary"
	icon="success"
	modalType="queue-success"
	onConfirm={handleClose}
	showCancel={false}
	title={t('queue_success_modal_title')}
	bind:isOpen
>
	<div>
		<p style:color="var(--color-text)" class="mb-4!">
			{t('queue_success_modal_success_message', [String(successData.queued)])}
		</p>

		<div class="modal-content-section">
			<h3 class="modal-content-heading">
				<Check class="mr-2 text-blue-500" size={18} />
				{t('queue_success_modal_next_steps_heading')}
			</h3>
			<ul class="modal-content-list">
				<li class="modal-content-list-item-info">
					{t('queue_success_modal_step1')}
				</li>
				<li class="modal-content-list-item-info">
					{t('queue_success_modal_step2')}
				</li>
				<li class="modal-content-list-item-info">
					{t('queue_success_modal_step3')}
				</li>
			</ul>
		</div>
	</div>
</Modal>
