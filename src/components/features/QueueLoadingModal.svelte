<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Modal from '../ui/Modal.svelte';
	import LoadingSpinner from '../ui/LoadingSpinner.svelte';

	interface Props {
		isOpen: boolean;
	}

	let { isOpen = $bindable() }: Props = $props();
</script>

<Modal
	showCancel={false}
	showClose={false}
	showConfirm={false}
	status="info"
	title={$_('queue_loading_modal_title')}
	bind:isOpen
>
	<div class="queue-loading-body">
		<LoadingSpinner size="large" />
	</div>
</Modal>
