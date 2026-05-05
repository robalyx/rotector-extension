<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { logger } from '@/lib/utils/logging/logger';
	import { waitForElement } from '@/lib/utils/dom/element-waiter';
	import { getAssetUrl } from '@/lib/utils/assets';
	import { COMPONENT_CLASSES, PAGE_TYPES } from '@/lib/types/constants';
	import { GROUP_CONFIGURE_SELECTORS } from '@/lib/controllers/selectors/groups';
	import UserListManager from '../lists/UserListManager.svelte';
	import ExportModal from '../lists/ExportModal.svelte';

	interface Props {
		groupId: string | null;
	}

	let { groupId = null }: Props = $props();

	let showMembersList = $state(false);
	let showExportModal = $state(false);
	let exportButton: HTMLButtonElement | null = $state(null);

	$effect(() => {
		void initialize();
		return cleanup;
	});

	async function initialize() {
		const result = await waitForElement(GROUP_CONFIGURE_SELECTORS.CONTAINER);
		if (!result.success) {
			logger.warn('Group configure members container not found');
			return;
		}
		showMembersList = true;

		if (groupId) {
			await injectExportButton();
		}
	}

	async function injectExportButton() {
		const headerResult = await waitForElement(GROUP_CONFIGURE_SELECTORS.HEADER);
		if (!headerResult.success || !headerResult.element) {
			logger.warn('Group configure header not found for export button');
			return;
		}

		const row = headerResult.element;

		const icon = document.createElement('img');
		icon.src = getAssetUrl('/icon/16.png');
		icon.width = 16;
		icon.height = 16;
		icon.alt = '';

		const label = document.createElement('span');
		label.textContent = $_('export_modal_button_export');

		const btn = document.createElement('button');
		btn.className = COMPONENT_CLASSES.EXPORT_BUTTON;
		btn.type = 'button';
		btn.title = $_('export_tracked_button_tooltip');
		btn.append(icon, label);
		btn.onclick = () => (showExportModal = true);

		row.appendChild(btn);
		exportButton = btn;
	}

	function cleanup() {
		showMembersList = false;
		if (exportButton) exportButton.remove();
	}
</script>

{#if showMembersList}
	<UserListManager pageType={PAGE_TYPES.GROUP_CONFIGURE_MEMBERS} />
{/if}

{#if groupId}
	<ExportModal {groupId} bind:isOpen={showExportModal} />
{/if}
