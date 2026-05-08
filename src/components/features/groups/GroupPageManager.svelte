<script lang="ts">
	import { mount, unmount } from 'svelte';
	import { logger } from '@/lib/utils/logging/logger';
	import { waitForElement } from '@/lib/utils/dom/element-waiter';
	import type { GroupQuerySubscription } from '@/lib/services/rotector/group-query';
	import { COMPONENT_CLASSES, ENTITY_TYPES } from '@/lib/types/constants';
	import { GROUP_HEADER_SELECTORS } from '@/lib/controllers/selectors/groups';
	import type { GroupStatus, PageType } from '@/lib/types/api';
	import type { CombinedStatus } from '@/lib/types/custom-api';
	import StatusIndicator from '../../status/StatusIndicator.svelte';
	import UserListManager from '../lists/UserListManager.svelte';
	import GroupMembersCarousel from './GroupMembersCarousel.svelte';

	interface Props {
		groupId: string | null;
		pageType: PageType;
		querySubscription?: GroupQuerySubscription | null;
	}

	let { groupId, pageType, querySubscription = null }: Props = $props();

	function checkIsAboutTab(): boolean {
		const tab = window.location.hash.match(/^#!?\/?([^/#?&]*)/)?.[1] ?? '';
		return tab === '' || tab === 'about';
	}

	let isAboutTab = $state(checkIsAboutTab());

	$effect(() => {
		const handler = () => {
			isAboutTab = checkIsAboutTab();
		};
		window.addEventListener('hashchange', handler);
		return () => window.removeEventListener('hashchange', handler);
	});

	let groupStatus = $state<CombinedStatus<GroupStatus> | null>(null);

	let ownerComponent: Record<string, unknown> | null = null;

	$effect(() => {
		if (!querySubscription) return;
		return querySubscription.subscribe((status) => {
			groupStatus = status;
		});
	});

	$effect(() => {
		void setupStatusIndicator();
		return cleanup;
	});

	async function setupStatusIndicator() {
		if (!groupId) return;

		try {
			const ownerResult = await waitForElement(GROUP_HEADER_SELECTORS.OWNER_NAME);

			if (!ownerResult.success) {
				logger.warn('Could not find group owner element for status indicator');
				return;
			}

			insertStatusIndicator(ownerResult.element, groupId);
		} catch (error) {
			logger.error('Failed to setup group status indicator:', error);
		}
	}

	function insertStatusIndicator(ownerElement: Element, groupId: string) {
		if (ownerComponent) void unmount(ownerComponent);

		const existingContainer = ownerElement.parentNode?.querySelector(
			`.${COMPONENT_CLASSES.GROUP_STATUS_CONTAINER}`
		);
		if (existingContainer) existingContainer.remove();

		const container = document.createElement('span');
		container.className = COMPONENT_CLASSES.GROUP_STATUS_CONTAINER;
		ownerElement.parentNode?.insertBefore(container, ownerElement.nextSibling);

		ownerComponent = mount(StatusIndicator, {
			target: container,
			props: {
				entityId: groupId,
				entityType: ENTITY_TYPES.GROUP,
				get entityStatus() {
					return groupStatus;
				},
				skipAutoFetch: true,
				showText: true
			}
		});
	}

	function cleanup() {
		if (ownerComponent) void unmount(ownerComponent);
	}
</script>

<UserListManager {pageType} />

{#if groupId && isAboutTab}
	<GroupMembersCarousel {groupId} />
{/if}
