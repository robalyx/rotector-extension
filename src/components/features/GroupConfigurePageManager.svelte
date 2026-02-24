<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { logger } from '@/lib/utils/logger';
	import { waitForElement } from '@/lib/utils/element-waiter';
	import { getAssetUrl } from '@/lib/utils/assets';
	import { COMPONENT_CLASSES, GROUP_CONFIGURE_SELECTORS, PAGE_TYPES } from '@/lib/types/constants';
	import type { CombinedStatus } from '@/lib/types/custom-api';
	import UserListManager from './UserListManager.svelte';
	import ExportModal from './ExportModal.svelte';

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
		try {
			const result = await waitForElement(GROUP_CONFIGURE_SELECTORS.CONTAINER);
			if (!result.success) {
				logger.warn('Group configure members container not found');
				return;
			}
			showMembersList = true;

			if (groupId) {
				await injectExportButton();
			}

			logger.debug('GroupConfigurePageManager initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize GroupConfigurePageManager:', error);
		}
	}

	async function injectExportButton() {
		const headerResult = await waitForElement(GROUP_CONFIGURE_SELECTORS.HEADER);
		if (!headerResult.success || !headerResult.element) {
			logger.warn('Group configure header not found for export button');
			return;
		}

		const header = headerResult.element;
		const h2 = header.querySelector('h2');
		if (!h2) return;

		const iconUrl = getAssetUrl('/icon/16.png');

		const btn = document.createElement('button');
		btn.className = COMPONENT_CLASSES.EXPORT_BUTTON;
		btn.type = 'button';
		btn.title = $_('export_tracked_button_tooltip');
		btn.innerHTML = `<img src="${iconUrl}" width="16" height="16" alt="" /><span>${$_('export_modal_button_export')}</span>`;
		btn.addEventListener('click', () => {
			showExportModal = true;
		});

		h2.appendChild(btn);
		exportButton = btn;
	}

	function handleUserProcessed(processedUserId: string, status: CombinedStatus) {
		logger.debug('Group configure member processed', {
			userId: processedUserId,
			hasStatus: !!status
		});
	}

	function handleError(error: string) {
		logger.error('GroupConfigurePageManager UserListManager error:', error);
	}

	function cleanup() {
		showMembersList = false;
		if (exportButton) {
			exportButton.remove();
			exportButton = null;
		}
		logger.debug('GroupConfigurePageManager cleanup completed');
	}
</script>

{#if showMembersList}
	<UserListManager
		onError={handleError}
		onUserProcessed={handleUserProcessed}
		pageType={PAGE_TYPES.GROUP_CONFIGURE_MEMBERS}
	/>
{/if}

{#if groupId}
	<ExportModal {groupId} bind:isOpen={showExportModal} />
{/if}
