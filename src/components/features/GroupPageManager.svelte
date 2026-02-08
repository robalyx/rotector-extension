<script lang="ts">
	import { mount } from 'svelte';
	import { logger } from '@/lib/utils/logger';
	import { waitForElement } from '@/lib/utils/element-waiter';
	import type { GroupQuerySubscription } from '@/lib/utils/group-query';
	import { COMPONENT_CLASSES, ENTITY_TYPES, GROUP_HEADER_SELECTORS } from '@/lib/types/constants';
	import type { PageType } from '@/lib/types/api';
	import type { CombinedStatus } from '@/lib/types/custom-api';
	import StatusIndicator from '../status/StatusIndicator.svelte';
	import UserListManager from './UserListManager.svelte';
	import GroupMembersCarousel from './GroupMembersCarousel.svelte';

	interface Props {
		groupId: string | null;
		pageType: PageType;
		querySubscription?: GroupQuerySubscription | null;
	}

	let { groupId, pageType, querySubscription = null }: Props = $props();

	// Check if on the about tab
	const isAboutTab = (() => {
		const hash = window.location.hash;
		return !hash || hash === '#' || hash === '#!' || hash === '#!/' || hash === '#!/about';
	})();

	// Status state owned by this component
	let groupStatus = $state<CombinedStatus | null>(null);

	let mountedComponents = $state(new Map<string, { unmount?: () => void }>());

	// Subscribe to status updates from pre-fetched query
	$effect(() => {
		if (!querySubscription) return;
		return querySubscription.subscribe((status) => {
			groupStatus = status;
		});
	});

	// Initialize components when mounted
	$effect(() => {
		void setupStatusIndicator();
		return cleanup;
	});

	// Setup status indicator for group owner
	async function setupStatusIndicator() {
		if (!groupId) return;

		try {
			// Wait for group owner name element
			const ownerResult = await waitForElement(GROUP_HEADER_SELECTORS.OWNER_NAME);

			if (!ownerResult.success || !ownerResult.element) {
				logger.warn('Could not find group owner element for status indicator');
				return;
			}

			insertStatusIndicator(ownerResult.element);
			logger.debug('Group status indicator mounted successfully');
		} catch (error) {
			logger.error('Failed to setup group status indicator:', error);
		}
	}

	// Insert and mount status indicator component
	function insertStatusIndicator(ownerElement: Element) {
		// Check and unmount existing component
		const existingComponent = mountedComponents.get('group-owner');
		if (existingComponent) {
			existingComponent.unmount?.();
			mountedComponents.delete('group-owner');
		}

		// Remove any existing container from DOM
		const existingContainer = ownerElement.parentNode?.querySelector(
			`.${COMPONENT_CLASSES.GROUP_STATUS_CONTAINER}`
		);
		if (existingContainer) {
			existingContainer.remove();
		}

		// Create new container
		const container = document.createElement('span');
		container.className = COMPONENT_CLASSES.GROUP_STATUS_CONTAINER;
		ownerElement.parentNode?.insertBefore(container, ownerElement.nextSibling);

		// Mount new component
		const component = mount(StatusIndicator, {
			target: container,
			props: {
				entityId: groupId!,
				entityType: ENTITY_TYPES.GROUP,
				get entityStatus() {
					return groupStatus;
				},
				skipAutoFetch: true,
				showText: true
			}
		});

		// Track the component
		mountedComponents.set('group-owner', component);
	}

	// Handle user processing completion from UserListManager
	function handleUserProcessed(processedUserId: string, status: CombinedStatus) {
		logger.debug('Groups page user processed', {
			userId: processedUserId,
			hasStatus: !!status
		});
	}

	// Handle errors from UserListManager
	function handleError(error: string) {
		logger.error('Groups page UserListManager error:', error);
	}

	// Clean up mounted components and resources
	function cleanup() {
		mountedComponents.forEach((component) => component.unmount?.());
		mountedComponents.clear();
		logger.debug('GroupPageManager cleanup completed');
	}
</script>

<UserListManager onError={handleError} onUserProcessed={handleUserProcessed} {pageType} />

<!-- Group Members Carousel -->
{#if groupId && isAboutTab}
	<GroupMembersCarousel {groupId} onError={handleError} onUserProcessed={handleUserProcessed} />
{/if}
