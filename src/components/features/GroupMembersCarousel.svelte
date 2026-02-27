<script lang="ts">
	import { mount, onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import {
		getGroupRoles,
		getGroupMembers,
		getMemberThumbnails,
		type GroupRole,
		type GroupMember,
		type SortOrder
	} from '@/lib/services/roblox-groups-api';
	import { apiClient } from '@/lib/services/api-client';
	import { queryMultipleUsers } from '@/lib/services/unified-query-service';
	import {
		COMPONENT_CLASSES,
		ENTITY_TYPES,
		GROUP_MEMBERS_CAROUSEL_SELECTORS,
		PAGE_TYPES,
		STATUS_SELECTORS
	} from '@/lib/types/constants';
	import { markUserElementForBlur, revealUserElement } from '@/lib/services/blur-service';
	import { logger } from '@/lib/utils/logger';
	import type { CombinedStatus } from '@/lib/types/custom-api';
	import type { TrackedUser } from '@/lib/types/api';
	import StatusIndicator from '../status/StatusIndicator.svelte';
	import QueueModalManager from './QueueModalManager.svelte';
	import type { QueueModalManagerInstance } from '@/lib/types/components';

	type ViewTab = 'by-role' | 'tracked';

	interface Props {
		groupId: string;
		onError?: (error: string) => void;
		onUserProcessed?: (userId: string, status: CombinedStatus) => void;
	}

	let { groupId, onError, onUserProcessed }: Props = $props();

	const API_LIMIT = 25;
	const DISPLAY_LIMIT = 24;
	const CARRYOVER_ONLY = '__CARRYOVER_ONLY__';

	// Shared state
	let activeTab = $state<ViewTab>('by-role');
	let userStatuses = new SvelteMap<string, CombinedStatus>();
	let mountedComponents = new SvelteMap<string, { unmount?: () => void }>();

	// By-role view state
	let roles = $state<GroupRole[]>([]);
	let selectedRoleId = $state<number | null>(null);
	let members = $state<GroupMember[]>([]);
	let thumbnails = $state(new Map<number, string>());
	let isLoadingRoles = $state(true);
	let isLoadingMembers = $state(false);
	let errorMessage = $state<string | null>(null);
	let membersHidden = $state(false);

	// By-role pagination
	// cursorCache[i] and carryoverCache[i] correspond to page i+1 (0-indexed)
	let previousCursors = $state<(string | null)[]>([]);
	let currentPage = $state(1);
	let carryoverHistory = $state<GroupMember[][]>([]);
	let cursorCache = $state<(string | null)[]>([null]);
	let carryoverCache = $state<GroupMember[][]>([[]]);
	let currentSortOrder = $state<SortOrder>('Desc');
	let isFetchingCursors = $state(false);
	let showPageInput = $state(false);
	let pageInputValue = $state('');
	let pageInputElement = $state<HTMLInputElement | null>(null);

	// Tracked users view state
	let trackedUsers = $state<TrackedUser[]>([]);
	let trackedTotalCount = $state<number | null>(null);
	let trackedNextCursor = $state<string | null>(null);
	let trackedCurrentPage = $state(1);
	let trackedPreviousCursors = $state<(string | null)[]>([]);
	let isLoadingTracked = $state(false);
	let trackedError = $state<string | null>(null);
	let hasLoadedTracked = $state(false);
	let trackedRequestId = $state(0);
	let trackedActiveFilter = $state<'' | 'true' | 'false'>('');

	// Tracked users pagination
	let trackedCursorCache = $state<(string | null)[]>([null]);
	let isFetchingTrackedCursors = $state(false);
	let trackedShowPageInput = $state(false);
	let trackedPageInputValue = $state('');
	let trackedPageInputElement = $state<HTMLInputElement | null>(null);

	// DOM references
	let portalTarget: HTMLDivElement | null = null;
	let contentWrapper: HTMLDivElement | null = null;
	let queueModalManager: QueueModalManagerInstance;

	// Inject section into Roblox page and portal content
	onMount(() => {
		const tabContent = document.querySelector(GROUP_MEMBERS_CAROUSEL_SELECTORS.TAB_CONTENT);
		if (!tabContent) {
			logger.warn('Could not find tab content container for members carousel');
			return;
		}

		portalTarget = document.createElement('div');
		portalTarget.className = `section ${GROUP_MEMBERS_CAROUSEL_SELECTORS.SECTION.slice(1)}`;

		const referenceSection = tabContent.querySelector('.group-shout, .group-announcements');
		if (referenceSection?.parentElement) {
			referenceSection.parentElement.insertBefore(portalTarget, referenceSection.nextSibling);
		} else {
			tabContent.prepend(portalTarget);
		}

		void loadRoles();

		return () => {
			cleanup();
			portalTarget?.remove();
		};
	});

	$effect(() => {
		if (portalTarget && contentWrapper) {
			if (!portalTarget.contains(contentWrapper)) {
				portalTarget.appendChild(contentWrapper);
			}
		}
	});

	$effect(() => {
		if (activeTab !== 'by-role') return;
		if (members.length === 0 || isLoadingMembers) return;

		requestAnimationFrame(() => {
			mountAllStatusIndicators();
			markAllElementsForBlur();
		});
	});

	$effect(() => {
		if (activeTab !== 'tracked') return;
		if (trackedUsers.length === 0 || isLoadingTracked) return;

		requestAnimationFrame(() => {
			mountAllStatusIndicators();
			markAllElementsForBlur();
		});
	});

	// Focus page input when shown
	$effect(() => {
		if (showPageInput && pageInputElement) {
			pageInputElement.focus();
			pageInputElement.select();
		}
	});

	// Focus tracked page input when shown
	$effect(() => {
		if (trackedShowPageInput && trackedPageInputElement) {
			trackedPageInputElement.focus();
			trackedPageInputElement.select();
		}
	});

	async function loadRoles() {
		try {
			isLoadingRoles = true;
			errorMessage = null;

			const fetchedRoles = await getGroupRoles(groupId);
			roles = fetchedRoles.filter((r) => r.memberCount > 0 && r.rank > 0);

			if (roles.length > 0) {
				selectedRoleId = roles[0].id;
				await loadMembers();
			}
		} catch (error) {
			logger.error('Failed to load group roles:', error);
			errorMessage = get(_)('group_members_error_roles');
			onError?.(get(_)('group_members_error_roles'));
		} finally {
			isLoadingRoles = false;
		}
	}

	// Load members for selected role
	async function loadMembers(cursor?: string | null, carryover: GroupMember[] = []) {
		if (selectedRoleId === null) return;

		try {
			isLoadingMembers = true;
			cleanupMountedComponents();

			// Display remaining members for carryover-only page
			let available: GroupMember[];
			if (cursor === CARRYOVER_ONLY) {
				available = carryover;
			} else {
				const response = await getGroupMembers(
					groupId,
					selectedRoleId,
					cursor,
					API_LIMIT,
					currentSortOrder
				);
				available = [...carryover, ...response.data];
			}

			members = available.slice(0, DISPLAY_LIMIT);
			const userIds = members.map((m) => m.userId);

			// Load thumbnails
			const fetchedThumbnails = await getMemberThumbnails(userIds);
			thumbnails = fetchedThumbnails;

			// Load Rotector statuses
			await loadStatuses(userIds.map(String));
		} catch (error) {
			const structured = error as Error & { status?: number; robloxErrorCode?: number };

			if (structured.status === 400 && structured.robloxErrorCode === 3) {
				membersHidden = true;
				return;
			}

			logger.error('Failed to load group members:', error);
			errorMessage = get(_)('group_members_error_members');
			onError?.(get(_)('group_members_error_members'));

			currentPage = 1;
			previousCursors = [];
			carryoverHistory = [];
		} finally {
			isLoadingMembers = false;
		}
	}

	// Load Rotector statuses for members
	async function loadStatuses(userIds: string[]) {
		try {
			const statuses = await queryMultipleUsers(userIds);
			statuses.forEach((status, userId) => {
				userStatuses.set(userId, status);
				onUserProcessed?.(userId, status);
			});
		} catch (error) {
			logger.error('Failed to load user statuses:', error);
		}
	}

	// Handle tab change
	function handleTabChange(tab: ViewTab) {
		if (tab === activeTab) return;
		cleanupMountedComponents();
		activeTab = tab;

		if (tab === 'tracked' && !hasLoadedTracked) {
			void loadTrackedUsers();
		}
	}

	// Load tracked users from API
	async function loadTrackedUsers(cursor?: string | null) {
		const requestId = ++trackedRequestId;

		try {
			isLoadingTracked = true;
			trackedError = null;
			cleanupMountedComponents();

			const response = await apiClient.getGroupTrackedUsers(
				groupId,
				cursor ?? undefined,
				DISPLAY_LIMIT,
				trackedActiveFilter || undefined
			);

			if (requestId !== trackedRequestId) return;

			trackedUsers = response.users;
			trackedTotalCount = response.totalCount;
			trackedNextCursor = response.nextCursor;
			hasLoadedTracked = true;

			if (trackedUsers.length > 0) {
				await loadStatuses(trackedUsers.map((u) => String(u.id)));
			}
		} catch (error) {
			if (requestId !== trackedRequestId) return;
			logger.error('Failed to load tracked users:', error);
			trackedError = get(_)('group_members_error_tracked');
		} finally {
			if (requestId === trackedRequestId) {
				isLoadingTracked = false;
			}
		}
	}

	// Retry loading tracked users from page 1
	function retryTrackedUsers() {
		trackedCurrentPage = 1;
		trackedPreviousCursors = [];
		trackedCursorCache = [null];
		void loadTrackedUsers();
	}

	function handleTrackedFilterChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		const newFilter = select.value as '' | 'true' | 'false';
		if (newFilter === trackedActiveFilter) return;

		trackedActiveFilter = newFilter;
		trackedCurrentPage = 1;
		trackedPreviousCursors = [];
		trackedCursorCache = [null];
		userStatuses.clear();
		void loadTrackedUsers();
	}

	function goToNextTrackedPage() {
		if (!trackedNextCursor) return;

		trackedPreviousCursors = [...trackedPreviousCursors, trackedNextCursor];
		trackedCurrentPage++;
		void loadTrackedUsers(trackedNextCursor);
	}

	function goToPreviousTrackedPage() {
		if (trackedCurrentPage === 1) return;

		const cursorsClone = [...trackedPreviousCursors];
		cursorsClone.pop();
		trackedPreviousCursors = cursorsClone;
		trackedCurrentPage--;

		const cursor = trackedCurrentPage === 1 ? null : cursorsClone[cursorsClone.length - 1];
		void loadTrackedUsers(cursor);
	}

	// Fetch tracked cursors up to a target page
	async function fetchTrackedCursorsToPage(targetPage: number): Promise<boolean> {
		isFetchingTrackedCursors = true;

		try {
			let cursor: string | null = trackedCursorCache[trackedCursorCache.length - 1] ?? null;

			while (trackedCursorCache.length < targetPage) {
				const response = await apiClient.getGroupTrackedUsers(
					groupId,
					cursor ?? undefined,
					DISPLAY_LIMIT,
					trackedActiveFilter || undefined
				);

				trackedCursorCache = [...trackedCursorCache, response.nextCursor];

				if (!response.nextCursor) break;
				cursor = response.nextCursor;
				await new Promise((r) => setTimeout(r, 100));
			}
			return true;
		} catch (error) {
			logger.error('Failed to fetch tracked cursors:', error);
			trackedError = get(_)('group_members_error_cursors');
			return false;
		} finally {
			isFetchingTrackedCursors = false;
		}
	}

	// Handle click on tracked page info to show input
	function handleTrackedPageInfoClick() {
		trackedShowPageInput = true;
		trackedPageInputValue = String(trackedCurrentPage);
	}

	// Navigate to a specific tracked page
	async function goToTrackedPage(targetPage: number) {
		if (trackedTotalCount === null) return;
		const totalPages = Math.ceil(trackedTotalCount / DISPLAY_LIMIT);
		if (targetPage < 1 || targetPage > totalPages || targetPage === trackedCurrentPage) return;

		// Check if we need to fetch more cursors
		if (trackedCursorCache.length < targetPage) {
			const requestsNeeded = targetPage - trackedCursorCache.length;
			const confirmed = confirm(
				get(_)('group_members_page_jump_confirm', { values: { 0: requestsNeeded, 1: targetPage } })
			);
			if (!confirmed) return;

			const success = await fetchTrackedCursorsToPage(targetPage);
			if (!success) return;
		}

		// Reset navigation state
		trackedPreviousCursors = [];
		trackedCurrentPage = targetPage;

		// Rebuild history for backward navigation
		for (let i = 1; i < targetPage; i++) {
			trackedPreviousCursors = [...trackedPreviousCursors, trackedCursorCache[i] ?? null];
		}

		// Load the target page
		const cursor = targetPage === 1 ? null : trackedCursorCache[targetPage - 1];
		await loadTrackedUsers(cursor);
	}

	// Handle tracked page input keydown
	function handleTrackedPageInputKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			const targetPage = parseInt(trackedPageInputValue, 10);
			if (trackedTotalCount === null) return;
			const totalPages = Math.ceil(trackedTotalCount / DISPLAY_LIMIT);
			if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
				trackedShowPageInput = false;
				void goToTrackedPage(targetPage);
			}
		} else if (event.key === 'Escape') {
			trackedShowPageInput = false;
		}
	}

	// Handle tracked page input blur
	function handleTrackedPageInputBlur() {
		trackedShowPageInput = false;
	}

	// Mount all status indicators
	function mountAllStatusIndicators() {
		if (!contentWrapper) return;

		const tiles = contentWrapper.querySelectorAll(GROUP_MEMBERS_CAROUSEL_SELECTORS.MEMBER_TILE);
		tiles.forEach((tile) => {
			const userId = tile.getAttribute(STATUS_SELECTORS.DATA_USER_ID);
			if (userId && tile instanceof HTMLElement) {
				mountStatusIndicator(tile, userId);
			}
		});
	}

	// Mark all member tiles for blur
	function markAllElementsForBlur() {
		if (!contentWrapper) return;

		const tiles = contentWrapper.querySelectorAll(GROUP_MEMBERS_CAROUSEL_SELECTORS.MEMBER_TILE);
		tiles.forEach((tile) => {
			const userId = tile.getAttribute(STATUS_SELECTORS.DATA_USER_ID);
			if (userId && tile instanceof HTMLElement) {
				markUserElementForBlur(tile, userId, PAGE_TYPES.GROUP_MEMBERS_CAROUSEL);

				// If status already loaded, reveal based on it
				const status = userStatuses.get(userId);
				if (status) {
					revealUserElement(tile, status);
				}
			}
		});
	}

	// Mount status indicator for a member tile
	function mountStatusIndicator(tileElement: HTMLElement, userId: string) {
		const status = userStatuses.get(userId);

		// Find user info from either by-role members or tracked users
		const member = members.find((m) => String(m.userId) === userId);
		const trackedUser = trackedUsers.find((u) => String(u.id) === userId);

		// Cleanup existing
		const existing = mountedComponents.get(userId);
		if (existing) {
			existing.unmount?.();
			mountedComponents.delete(userId);
		}

		// Find or create status container
		let container = tileElement.querySelector(
			`.${COMPONENT_CLASSES.STATUS_CONTAINER}`
		) as HTMLElement;
		if (!container) {
			container = document.createElement('div');
			container.className = `${COMPONENT_CLASSES.STATUS_CONTAINER} group-member-status`;
			tileElement.appendChild(container);
		}

		container.innerHTML = '';
		const component = mount(StatusIndicator, {
			target: container,
			props: {
				entityId: userId,
				entityType: ENTITY_TYPES.USER,
				entityStatus: status ?? null,
				showText: false,
				skipAutoFetch: true,
				onQueue: handleQueueUser,
				userUsername: member?.username ?? trackedUser?.name,
				userDisplayName: member?.displayName ?? trackedUser?.displayName,
				userAvatarUrl: member ? thumbnails.get(member.userId) : trackedUser?.thumbnailUrl
			}
		});

		mountedComponents.set(userId, component);
	}

	// Handle role selection change
	function handleRoleChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		const roleId = parseInt(select.value, 10);
		if (isNaN(roleId) || roleId === selectedRoleId) return;

		selectedRoleId = roleId;
		previousCursors = [];
		carryoverHistory = [];
		currentPage = 1;
		cursorCache = [null];
		carryoverCache = [[]];
		currentSortOrder = 'Desc';
		showPageInput = false;
		userStatuses.clear();
		void loadMembers();
	}

	// Handle sort order dropdown change
	function handleSortOrderSelectChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		const newOrder = select.value as SortOrder;
		if (newOrder === currentSortOrder) return;

		currentSortOrder = newOrder;
		currentPage = 1;
		cursorCache = [null];
		carryoverCache = [[]];
		previousCursors = [];
		carryoverHistory = [];
		userStatuses.clear();
		void loadMembers();
	}

	async function goToNextPage() {
		const totalPages = selectedRole ? Math.ceil(selectedRole.memberCount / DISPLAY_LIMIT) : 1;
		if (currentPage >= totalPages) return;
		await goToPage(currentPage + 1);
	}

	async function goToPreviousPage() {
		if (currentPage <= 1) return;
		await goToPage(currentPage - 1);
	}

	// Fetch cursors and carryovers up to a target page
	async function fetchCursorsToPage(targetPage: number): Promise<boolean> {
		if (selectedRoleId === null) return false;

		isFetchingCursors = true;

		try {
			// Start from the last cached cursor and carryover
			let lastCursor = cursorCache[cursorCache.length - 1];
			let cursor: string | null = lastCursor === CARRYOVER_ONLY ? null : (lastCursor ?? null);
			let currentCarryover: GroupMember[] = carryoverCache[carryoverCache.length - 1] ?? [];

			while (cursorCache.length < targetPage) {
				// Handle carryover-only page
				if (cursor === null && currentCarryover.length > 0 && cursorCache.length > 1) {
					cursorCache = [...cursorCache, CARRYOVER_ONLY];
					carryoverCache = [...carryoverCache, currentCarryover];
					currentCarryover = [];
					continue;
				}

				if (cursor === null && cursorCache.length > 1) break;

				const response = await getGroupMembers(
					groupId,
					selectedRoleId,
					cursor,
					API_LIMIT,
					currentSortOrder
				);

				const available = [...currentCarryover, ...response.data];
				const nextCarryover = available.slice(DISPLAY_LIMIT);

				// Mark as carryover-only page if API exhausted but carryover remains
				const nextCursor =
					!response.nextPageCursor && nextCarryover.length > 0
						? CARRYOVER_ONLY
						: response.nextPageCursor;

				cursorCache = [...cursorCache, nextCursor];
				carryoverCache = [...carryoverCache, nextCarryover];

				if (!response.nextPageCursor && nextCarryover.length === 0) break;
				cursor = response.nextPageCursor;
				currentCarryover = nextCarryover;
				await new Promise((r) => setTimeout(r, 100));
			}

			return true;
		} catch (error) {
			logger.error('Failed to fetch cursors:', error);
			errorMessage = get(_)('group_members_error_cursors');
			return false;
		} finally {
			isFetchingCursors = false;
		}
	}

	// Handle click on page info to show input
	function handlePageInfoClick() {
		showPageInput = true;
		pageInputValue = String(currentPage);
	}

	async function goToPage(targetPage: number) {
		const totalPages = selectedRole ? Math.ceil(selectedRole.memberCount / DISPLAY_LIMIT) : 1;
		if (targetPage < 1 || targetPage > totalPages || targetPage === currentPage) return;

		// Calculate requests needed for current vs opposite direction
		const currentRequestsNeeded = Math.max(0, targetPage - cursorCache.length);
		const oppositeRequestsNeeded = totalPages - targetPage + 1;
		const oppositeOrder: SortOrder = currentSortOrder === 'Desc' ? 'Asc' : 'Desc';
		const oppositeLabel = oppositeOrder === 'Asc' ? 'Oldest' : 'Newest';

		// Check if switching direction would be more efficient
		if (currentRequestsNeeded > 1 && oppositeRequestsNeeded < currentRequestsNeeded) {
			const switchConfirmed = confirm(
				get(_)('group_members_page_jump_switch', {
					values: {
						0: oppositeLabel,
						1: oppositeRequestsNeeded,
						2: currentRequestsNeeded
					}
				})
			);

			if (switchConfirmed) {
				// Switch direction and jump to the equivalent page in the new direction
				currentSortOrder = oppositeOrder;
				cursorCache = [null];
				carryoverCache = [[]];
				previousCursors = [];
				carryoverHistory = [];
				userStatuses.clear();
				currentPage = oppositeRequestsNeeded;

				const success = await fetchCursorsToPage(oppositeRequestsNeeded);
				if (!success) return;

				for (let i = 1; i < oppositeRequestsNeeded; i++) {
					previousCursors = [...previousCursors, cursorCache[i] ?? null];
					carryoverHistory = [...carryoverHistory, carryoverCache[i] ?? []];
				}

				const cursor =
					oppositeRequestsNeeded === 1 ? null : cursorCache[oppositeRequestsNeeded - 1];
				const carryover =
					oppositeRequestsNeeded === 1 ? [] : (carryoverCache[oppositeRequestsNeeded - 1] ?? []);
				await loadMembers(cursor, carryover);
				return;
			}
		}

		// For standard path, check if we need to fetch more cursors
		if (cursorCache.length < targetPage) {
			if (currentRequestsNeeded > 1) {
				const confirmed = confirm(
					get(_)('group_members_page_jump_confirm', {
						values: { 0: currentRequestsNeeded, 1: targetPage }
					})
				);
				if (!confirmed) return;
			}

			const success = await fetchCursorsToPage(targetPage);
			if (!success) return;
		}

		// Reset navigation state and rebuild history
		previousCursors = [];
		carryoverHistory = [];
		currentPage = targetPage;

		for (let i = 1; i < targetPage; i++) {
			previousCursors = [...previousCursors, cursorCache[i] ?? null];
			carryoverHistory = [...carryoverHistory, carryoverCache[i] ?? []];
		}

		const cursor = targetPage === 1 ? null : cursorCache[targetPage - 1];
		const carryover = targetPage === 1 ? [] : (carryoverCache[targetPage - 1] ?? []);
		await loadMembers(cursor, carryover);
	}

	// Handle page input submission
	function handlePageInputKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			const targetPage = parseInt(pageInputValue, 10);
			const totalPages = selectedRole ? Math.ceil(selectedRole.memberCount / DISPLAY_LIMIT) : 1;
			if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
				showPageInput = false;
				void goToPage(targetPage);
			}
		} else if (event.key === 'Escape') {
			showPageInput = false;
		}
	}

	// Handle page input blur
	function handlePageInputBlur() {
		showPageInput = false;
	}

	// Handle queue action
	function handleQueueUser(userId: string) {
		logger.userAction('group_carousel_queue_requested', { userId });
		queueModalManager?.showQueue(userId);
	}

	// Handle status refresh after queue
	async function handleStatusRefresh(userId: string) {
		try {
			const statuses = await queryMultipleUsers([userId]);
			const status = statuses.get(userId);
			if (status) {
				userStatuses.set(userId, status);
				// Re-mount status indicator
				if (contentWrapper) {
					const tile = contentWrapper.querySelector(
						`[${STATUS_SELECTORS.DATA_USER_ID}="${userId}"]`
					) as HTMLElement;
					if (tile) {
						mountStatusIndicator(tile, userId);
					}
				}
			}
		} catch (error) {
			logger.error('Failed to refresh status:', error);
		}
	}

	// Cleanup mounted components
	function cleanupMountedComponents() {
		for (const component of mountedComponents.values()) {
			try {
				component.unmount?.();
			} catch (error) {
				logger.error('Failed to unmount component:', error);
			}
		}
		mountedComponents.clear();
	}

	// Full cleanup
	function cleanup() {
		cleanupMountedComponents();
		userStatuses.clear();
	}

	// Get selected role info
	const selectedRole = $derived(roles.find((r) => r.id === selectedRoleId));
</script>

<!-- content that will be portaled -->
<div bind:this={contentWrapper} class="group-members-section">
	<!-- Header -->
	<div class="group-members-header">
		<h2 class="group-members-title">{$_('group_members_title')}</h2>
		<div class="group-members-tabs" role="tablist">
			<button
				class="group-members-tab"
				class:active={activeTab === 'by-role'}
				aria-selected={activeTab === 'by-role'}
				onclick={() => handleTabChange('by-role')}
				role="tab"
				type="button"
			>
				{$_('group_members_tab_by_role')}
			</button>
			<button
				class="group-members-tab"
				class:active={activeTab === 'tracked'}
				aria-selected={activeTab === 'tracked'}
				onclick={() => handleTabChange('tracked')}
				role="tab"
				type="button"
			>
				{$_('group_members_tab_tracked')}
			</button>
		</div>
	</div>

	<!-- Content -->
	<div class="group-members-content">
		{#if activeTab === 'by-role'}
			<!-- By Role View -->
			{#if isLoadingRoles}
				<div class="group-members-loading">
					<div class="group-members-spinner"></div>
				</div>
			{:else if membersHidden}
				<div class="group-members-empty">
					<span>{$_('group_members_hidden')}</span>
				</div>
			{:else if errorMessage}
				<div class="group-members-error">
					<span>{errorMessage}</span>
					<button class="group-members-nav-btn" onclick={() => loadRoles()} type="button"
						>{$_('group_members_retry')}</button
					>
				</div>
			{:else if roles.length === 0}
				<div class="group-members-empty">
					<span>{$_('group_members_empty_no_members')}</span>
				</div>
			{:else}
				<!-- Role Dropdown and Sort Order -->
				<div class="group-members-controls">
					<select
						class="group-members-dropdown group-members-dropdown-role"
						disabled={isFetchingCursors}
						onchange={handleRoleChange}
						value={selectedRoleId}
					>
						{#each roles as role (role.id)}
							<option value={role.id}>
								{role.name} ({role.memberCount})
							</option>
						{/each}
					</select>
					<select
						class="group-members-dropdown group-members-dropdown-sort"
						disabled={isLoadingMembers || isFetchingCursors}
						onchange={handleSortOrderSelectChange}
						value={currentSortOrder}
					>
						<option value="Desc">{$_('group_members_sort_newest')}</option>
						<option value="Asc">{$_('group_members_sort_oldest')}</option>
					</select>
				</div>

				<!-- Member Grid -->
				{#if members.length === 0 && !isLoadingMembers}
					<div class="group-members-empty">
						<span>{$_('group_members_empty_no_role_members')}</span>
					</div>
				{:else}
					<div class="group-members-grid-container">
						{#if isLoadingMembers}
							<div class="group-members-loading-overlay">
								<div class="group-members-spinner"></div>
							</div>
						{/if}
						<div class="group-members-grid">
							{#each members as member (member.userId)}
								<a
									class="group-member-tile rotector-member-tile"
									data-rotector-user-id={member.userId}
									href="https://www.roblox.com/users/{member.userId}/profile"
								>
									<div class="group-member-avatar rotector-member-avatar">
										{#if thumbnails.get(member.userId)}
											<img
												alt={member.displayName}
												loading="lazy"
												src={thumbnails.get(member.userId)}
											/>
										{:else}
											<div class="group-member-avatar-placeholder"></div>
										{/if}
									</div>
									<span class="group-member-display-name rotector-member-display-name">
										{member.displayName}
									</span>
								</a>
							{/each}
						</div>
					</div>

					<!-- Pagination -->
					<div class="group-members-nav">
						<button
							class="group-members-nav-btn"
							disabled={currentPage === 1 || isFetchingCursors || isLoadingMembers}
							onclick={goToPreviousPage}
							type="button"
						>
							{$_('group_members_previous')}
						</button>
						{#if isFetchingCursors}
							<span class="group-members-page-info group-members-page-loading">
								<span class="group-members-page-spinner"></span>
								{$_('group_members_loading')}
							</span>
						{:else if showPageInput}
							<span class="group-members-page-info">
								{$_('group_members_page')}
								<input
									bind:this={pageInputElement}
									class="group-members-page-input"
									onblur={handlePageInputBlur}
									onkeydown={handlePageInputKeydown}
									type="text"
									bind:value={pageInputValue}
								/>
								{#if selectedRole}
									{$_('group_members_page_of')}
									{Math.ceil(selectedRole.memberCount / DISPLAY_LIMIT)}
								{/if}
							</span>
						{:else}
							<button
								class="group-members-page-info group-members-page-btn"
								onclick={handlePageInfoClick}
								title={$_('group_members_page_jump_tooltip')}
								type="button"
							>
								{$_('group_members_page')}
								{currentPage}
								{#if selectedRole}
									{$_('group_members_page_of')}
									{Math.ceil(selectedRole.memberCount / DISPLAY_LIMIT)}
								{/if}
							</button>
						{/if}
						<button
							class="group-members-nav-btn"
							disabled={currentPage >=
								Math.ceil((selectedRole?.memberCount ?? 0) / DISPLAY_LIMIT) ||
								isFetchingCursors ||
								isLoadingMembers}
							onclick={goToNextPage}
							type="button"
						>
							{$_('group_members_next')}
						</button>
					</div>
				{/if}
			{/if}
		{:else}
			<!-- Tracked Users View -->
			{#if isLoadingTracked && !hasLoadedTracked}
				<div class="group-members-loading">
					<div class="group-members-spinner"></div>
				</div>
			{:else if trackedError}
				<div class="group-members-error">
					<span>{trackedError}</span>
					<button class="group-members-nav-btn" onclick={retryTrackedUsers} type="button"
						>{$_('group_members_retry')}</button
					>
				</div>
			{:else if trackedUsers.length === 0 && hasLoadedTracked}
				<div class="group-members-empty">
					<span>{$_('group_members_empty_no_tracked')}</span>
				</div>
			{:else}
				<div class="group-members-tracked-header">
					<span class="group-members-tracked-desc">
						{$_('group_members_tracked_description')}
					</span>
					{#if trackedTotalCount !== null}
						<span class="group-members-tracked-count"
							>{$_('group_members_tracked_count', { values: { 0: trackedTotalCount } })}</span
						>
					{/if}
					<select
						class="group-members-tracked-filter"
						disabled={isLoadingTracked}
						onchange={handleTrackedFilterChange}
						value={trackedActiveFilter}
					>
						<option value="">{$_('group_members_tracked_filter_all')}</option>
						<option value="true">{$_('group_members_tracked_filter_active')}</option>
						<option value="false">{$_('group_members_tracked_filter_left')}</option>
					</select>
				</div>
				<div class="group-members-grid-container">
					{#if isLoadingTracked}
						<div class="group-members-loading-overlay">
							<div class="group-members-spinner"></div>
						</div>
					{/if}
					<div class="group-members-grid">
						{#each trackedUsers as user (user.id)}
							<a
								class="group-member-tile rotector-member-tile"
								class:group-member-tile-inactive={!user.isActive}
								data-rotector-user-id={user.id}
								href="https://www.roblox.com/users/{user.id}/profile"
							>
								<div
									class="group-member-avatar rotector-member-avatar"
									class:group-member-avatar-inactive={!user.isActive}
								>
									{#if user.thumbnailUrl}
										<img alt={user.displayName} loading="lazy" src={user.thumbnailUrl} />
									{:else}
										<div class="group-member-avatar-placeholder"></div>
									{/if}
								</div>
								<span class="group-member-display-name rotector-member-display-name">
									{user.displayName}
								</span>
							</a>
						{/each}
					</div>
				</div>

				<!-- Tracked Users Pagination -->
				{#if trackedTotalCount !== null && trackedTotalCount > DISPLAY_LIMIT}
					<div class="group-members-nav">
						<button
							class="group-members-nav-btn"
							disabled={trackedCurrentPage === 1 || isFetchingTrackedCursors || isLoadingTracked}
							onclick={goToPreviousTrackedPage}
							type="button"
						>
							{$_('group_members_previous')}
						</button>
						{#if isFetchingTrackedCursors}
							<span class="group-members-page-info group-members-page-loading">
								<span class="group-members-page-spinner"></span>
								{$_('group_members_loading')}
							</span>
						{:else if trackedShowPageInput}
							<span class="group-members-page-info">
								{$_('group_members_page')}
								<input
									bind:this={trackedPageInputElement}
									class="group-members-page-input"
									onblur={handleTrackedPageInputBlur}
									onkeydown={handleTrackedPageInputKeydown}
									type="text"
									bind:value={trackedPageInputValue}
								/>
								{$_('group_members_page_of')}
								{Math.ceil(trackedTotalCount / DISPLAY_LIMIT)}
							</span>
						{:else}
							<button
								class="group-members-page-info group-members-page-btn"
								onclick={handleTrackedPageInfoClick}
								title={$_('group_members_page_jump_tooltip')}
								type="button"
							>
								{$_('group_members_page')}
								{trackedCurrentPage}
								{$_('group_members_page_of')}
								{Math.ceil(trackedTotalCount / DISPLAY_LIMIT)}
							</button>
						{/if}
						<button
							class="group-members-nav-btn"
							disabled={!trackedNextCursor || isFetchingTrackedCursors || isLoadingTracked}
							onclick={goToNextTrackedPage}
							type="button"
						>
							{$_('group_members_next')}
						</button>
					</div>
				{/if}
			{/if}
		{/if}
	</div>
</div>

<!-- Queue Modal Manager -->
<QueueModalManager bind:this={queueModalManager} onStatusRefresh={handleStatusRefresh} />
