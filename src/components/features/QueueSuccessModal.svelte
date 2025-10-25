<script lang="ts">
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
	confirmText="Close"
	confirmVariant="primary"
	modalType="queue-success"
	onConfirm={handleClose}
	showCancel={false}
	title="Success"
	bind:isOpen
>
	<div>
		<p style:color="var(--color-text)" class="mb-4!">
			User ID {successData.queued} has been successfully queued for review.
		</p>

		<div class="modal-content-section">
			<h3 class="modal-content-heading">
				<Check class="mr-2 text-blue-500" size={18} />
				What happens next
			</h3>
			<ul class="modal-content-list">
				<li class="modal-content-list-item-info">
					Our AI will analyze this account for patterns of concern
				</li>
				<li class="modal-content-list-item-info">
					If flagged, the user's status will be confirmed within a few minutes
				</li>
				<li class="modal-content-list-item-info">
					Full system sync and confirmation will take 24-48 hours
				</li>
			</ul>
		</div>
	</div>
</Modal>
