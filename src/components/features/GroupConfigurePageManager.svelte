<script lang="ts">
	import { logger } from '@/lib/utils/logger';
	import { waitForElement } from '@/lib/utils/element-waiter';
	import { GROUP_CONFIGURE_SELECTORS, PAGE_TYPES } from '@/lib/types/constants';
	import type { CombinedStatus } from '@/lib/types/custom-api';
	import UserListManager from './UserListManager.svelte';

	let showMembersList = $state(false);

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
			logger.debug('GroupConfigurePageManager initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize GroupConfigurePageManager:', error);
		}
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
