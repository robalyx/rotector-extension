<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Modal from '../ui/Modal.svelte';
	import Outfit3DViewer from '../ui/Outfit3DViewer.svelte';

	interface Props {
		isOpen: boolean;
		outfitId?: number;
		userId?: number;
		outfitName: string;
		onClose: () => void;
	}

	let { isOpen = $bindable(), outfitId, userId, outfitName, onClose }: Props = $props();
</script>

<Modal
	actionsLayout="horizontal"
	{onClose}
	showCancel={false}
	showConfirm={false}
	size="normal"
	title={outfitName}
	bind:isOpen
>
	<div class="outfit-3d-modal-content">
		{#if isOpen}
			<Outfit3DViewer height={400} {outfitId} {userId} width={400} />
		{/if}
		<p class="outfit-3d-modal-hint">{$_('outfit_3d_drag_hint')}</p>
	</div>
</Modal>
