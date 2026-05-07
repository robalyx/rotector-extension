<script lang="ts">
	import { mount, onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { MountedComponentRegistry } from '@/lib/utils/dom/mounted-component-registry';
	import { _ } from 'svelte-i18n';
	import {
		getGroupRoles,
		getGroupMembers,
		getMemberThumbnails,
		getUserPresences,
		PRESENCE_TYPE,
		type SortOrder
	} from '@/lib/services/roblox/groups';
	import type { GroupMember, GroupRole, UserPresence } from '@/lib/schemas/roblox-api';
	import { apiClient } from '@/lib/services/rotector/api-client';
	import { queryMultipleUsers } from '@/lib/services/rotector/unified-query';
	import {
		COMPONENT_CLASSES,
		ENTITY_TYPES,
		PAGE_TYPES,
		STATUS_SELECTORS
	} from '@/lib/types/constants';
	import { GROUP_MEMBERS_CAROUSEL_SELECTORS } from '@/lib/controllers/selectors/groups';
	import { markUserElementForBlur, revealUserElement } from '@/lib/services/blur/service';
	import { asApiError } from '@/lib/utils/api/api-error';
	import { createAbortableBatch } from '@/lib/utils/api/abortable-batch';
	import { logger } from '@/lib/utils/logging/logger';
	import type { CombinedStatus } from '@/lib/types/custom-api';
	import type { TrackedUser, UserStatus } from '@/lib/types/api';
	import StatusIndicator from '../../status/StatusIndicator.svelte';
	import QueueModalManager from '../queue/QueueModalManager.svelte';
	import type { QueueModalManagerInstance } from '../queue/queue-modal-manager';

	type ViewTab = 'by-role' | 'tracked';

	interface Props {
		groupId: string;
		onUserProcessed?: (userId: string, status: CombinedStatus<UserStatus>) => void;
	}

	let { groupId, onUserProcessed }: Props = $props();

	const API_LIMIT = 25;
	const DISPLAY_LIMIT = 24;
	const CARRYOVER_ONLY = '__CARRYOVER_ONLY__';

	let activeTab = $state<ViewTab>('by-role');
	let userStatuses = new SvelteMap<string, CombinedStatus<UserStatus>>();
	const mountedComponents = new MountedComponentRegistry<string>();
	const batch = createAbortableBatch();

	let roles = $state<GroupRole[]>([]);
	let selectedRoleId = $state<number | null>(null);
	const selectedRole = $derived(roles.find((r) => r.id === selectedRoleId));
	let members = $state<GroupMember[]>([]);
	const memberById = $derived(new Map(members.map((m) => [String(m.userId), m])));
	let thumbnails = $state(new Map<number, string>());
	let presences = $state(new Map<number, UserPresence>());
	let trackedPresences = $state(new Map<number, UserPresence>());
	let isLoadingRoles = $state(true);
	let isLoadingMembers = $state(false);
	let errorMessage = $state<string | null>(null);
	let membersHidden = $state(false);

	// cursorCache[i] and carryoverCache[i] correspond to page i+1 (0-indexed)
	let currentPage = $state(1);
	let cursorCache = $state<(string | null)[]>([null]);
	let carryoverCache = $state<GroupMember[][]>([[]]);
	let currentSortOrder = $state<SortOrder>('Desc');
	let isFetchingCursors = $state(false);
	let showPageInput = $state(false);
	let pageInputValue = $state('');
	let pageInputElement = $state<HTMLInputElement | null>(null);

	let trackedUsers = $state<TrackedUser[]>([]);
	const trackedUserById = $derived(new Map(trackedUsers.map((u) => [String(u.id), u])));
	let trackedTotalCount = $state<number | null>(null);
	let trackedNextCursor = $state<string | null>(null);
	let trackedCurrentPage = $state(1);
	let trackedPreviousCursors = $state<(string | null)[]>([]);
	let isLoadingTracked = $state(false);
	let trackedError = $state<string | null>(null);
	let hasLoadedTracked = $state(false);
	let membersRequestId = $state(0);
	let trackedRequestId = $state(0);
	let trackedActiveFilter = $state<'' | 'true' | 'false'>('');

	let trackedCursorCache = $state<(string | null)[]>([null]);
	let isFetchingTrackedCursors = $state(false);
	let trackedShowPageInput = $state(false);
	let trackedPageInputValue = $state('');
	let trackedPageInputElement = $state<HTMLInputElement | null>(null);

	let portalTarget: HTMLDivElement | null = null;
	let contentWrapper = $state<HTMLDivElement | null>(null);
	let queueModalManager: QueueModalManagerInstance;

	onMount(() => {
		const tabContent = document.querySelector(GROUP_MEMBERS_CAROUSEL_SELECTORS.TAB_CONTENT);
		if (!tabContent) {
			logger.warn('Could not find tab content container for members carousel');
			return;
		}

		portalTarget = document.createElement('div');
		portalTarget.className = `section ${GROUP_MEMBERS_CAROUSEL_SELECTORS.SECTION.slice(1)}`;

		// Always place the members table at the top of the container
		tabContent.prepend(portalTarget);

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
		if (!contentWrapper) return;
		const byRoleReady = activeTab === 'by-role' && members.length > 0 && !isLoadingRoles;
		const trackedReady = activeTab === 'tracked' && trackedUsers.length > 0;
		if (!byRoleReady && !trackedReady) return;

		requestAnimationFrame(() => {
			applyToTiles();
		});
	});

	$effect(() => {
		if (showPageInput && pageInputElement) {
			pageInputElement.focus();
			pageInputElement.select();
		}
	});

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

			const firstRole = roles[0];
			if (firstRole) {
				selectedRoleId = firstRole.id;
				await loadMembers();
			}
		} catch (error) {
			logger.error('Failed to load group roles:', error);
			errorMessage = $_('group_members_error_roles');
		} finally {
			isLoadingRoles = false;
		}
	}

	// Treats CARRYOVER_ONLY as a synthetic page that drains leftover members past the API cursor
	async function loadMembers(cursor?: string | null, carryover: GroupMember[] = []) {
		if (selectedRoleId === null) return;
		const requestId = ++membersRequestId;

		try {
			isLoadingMembers = true;
			mountedComponents.destroyAll();

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
				if (requestId !== membersRequestId) return;
				available = [...carryover, ...response.data];
			}

			members = available.slice(0, DISPLAY_LIMIT);
			const userIds = members.map((m) => m.userId);
			void loadStatuses(userIds.map(String));

			const [fetchedThumbnails, fetchedPresences] = await Promise.all([
				getMemberThumbnails(userIds),
				getUserPresences(userIds).catch((error: unknown): Map<number, UserPresence> => {
					logger.warn('Failed to load member presences:', error);
					return new Map();
				})
			]);

			if (requestId !== membersRequestId) return;

			thumbnails = fetchedThumbnails;
			presences = fetchedPresences;
		} catch (error) {
			if (requestId !== membersRequestId) return;

			const structured = asApiError(error);

			const isHiddenMemberList =
				(structured.status === 403 && structured.robloxErrorCode === 35) ||
				(structured.status === 400 && structured.robloxErrorCode === 3);

			if (isHiddenMemberList) {
				membersHidden = true;
				return;
			}

			logger.error('Failed to load group members:', error);
			errorMessage = $_('group_members_error_members');

			currentPage = 1;
		} finally {
			if (requestId === membersRequestId) {
				isLoadingMembers = false;
			}
		}
	}

	async function loadStatuses(userIds: string[]) {
		try {
			const statuses = await queryMultipleUsers(userIds, {
				signal: batch.nextSignal(),
				onUpdate: (userId, status) => {
					userStatuses.set(userId, status);
				}
			});
			statuses.forEach((status, userId) => {
				revealTileForStatus(userId, status);
				onUserProcessed?.(userId, status);
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			logger.error('Failed to load user statuses:', error);
		}
	}

	function revealTileForStatus(userId: string, status: CombinedStatus<UserStatus>) {
		const tile = contentWrapper?.querySelector<HTMLElement>(
			`[${STATUS_SELECTORS.DATA_USER_ID}="${userId}"]`
		);
		if (tile) {
			revealUserElement(tile, status);
		}
	}

	function handleTabChange(tab: ViewTab) {
		if (tab === activeTab) return;
		mountedComponents.destroyAll();
		activeTab = tab;

		if (tab === 'tracked' && !hasLoadedTracked) {
			void loadTrackedUsers();
		}
	}

	// A newer call discards any in-flight load before it can update state
	async function loadTrackedUsers(cursor?: string | null) {
		const requestId = ++trackedRequestId;

		try {
			isLoadingTracked = true;
			trackedError = null;
			mountedComponents.destroyAll();

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
				const trackedIds = trackedUsers.map((u) => u.id);
				void loadStatuses(trackedIds.map(String));

				const fetchedPresences = await getUserPresences(trackedIds).catch(
					(error: unknown): Map<number, UserPresence> => {
						logger.warn('Failed to load tracked presences:', error);
						return new Map();
					}
				);

				if (requestId !== trackedRequestId) return;

				trackedPresences = fetchedPresences;
			}
		} catch (error) {
			if (requestId !== trackedRequestId) return;
			logger.error('Failed to load tracked users:', error);
			trackedError = $_('group_members_error_tracked');
		} finally {
			if (requestId === trackedRequestId) {
				isLoadingTracked = false;
			}
		}
	}

	function retryTrackedUsers() {
		trackedCurrentPage = 1;
		trackedPreviousCursors = [];
		trackedCursorCache = [null];
		void loadTrackedUsers();
	}

	function handleTrackedFilterChange(event: Event) {
		if (!(event.target instanceof HTMLSelectElement)) return;
		const newFilter = event.target.value as '' | 'true' | 'false';
		if (newFilter === trackedActiveFilter) return;

		trackedActiveFilter = newFilter;
		trackedCurrentPage = 1;
		trackedPreviousCursors = [];
		trackedCursorCache = [null];
		userStatuses.clear();
		trackedPresences.clear();
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
			trackedError = $_('group_members_error_cursors');
			return false;
		} finally {
			isFetchingTrackedCursors = false;
		}
	}

	function handleTrackedPageInfoClick() {
		trackedShowPageInput = true;
		trackedPageInputValue = String(trackedCurrentPage);
	}

	async function goToTrackedPage(targetPage: number) {
		if (trackedTotalCount === null) return;
		const totalPages = Math.ceil(trackedTotalCount / DISPLAY_LIMIT);
		if (targetPage < 1 || targetPage > totalPages || targetPage === trackedCurrentPage) return;

		// Check if we need to fetch more cursors
		if (trackedCursorCache.length < targetPage) {
			const requestsNeeded = targetPage - trackedCursorCache.length;
			const confirmed = confirm(
				$_('group_members_page_jump_confirm', { values: { 0: requestsNeeded, 1: targetPage } })
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

	// Mounts indicators, marks blur, and reveals statuses on tiles already rendered into the wrapper
	function applyToTiles() {
		if (!contentWrapper) return;

		const tiles = contentWrapper.querySelectorAll(GROUP_MEMBERS_CAROUSEL_SELECTORS.MEMBER_TILE);
		tiles.forEach((tile) => {
			const userId = tile.getAttribute(STATUS_SELECTORS.DATA_USER_ID);
			if (!userId || !(tile instanceof HTMLElement)) return;

			mountStatusIndicator(tile, userId);
			markUserElementForBlur(tile, userId, PAGE_TYPES.GROUP_MEMBERS_CAROUSEL);

			const status = userStatuses.get(userId);
			if (status) {
				revealUserElement(tile, status);
			}
		});
	}

	function mountStatusIndicator(tileElement: HTMLElement, userId: string) {
		// Find or create status container
		let container = tileElement.querySelector<HTMLElement>(
			`.${COMPONENT_CLASSES.STATUS_CONTAINER}`
		);
		if (!container) {
			container = document.createElement('div');
			container.className = `${COMPONENT_CLASSES.STATUS_CONTAINER} ${COMPONENT_CLASSES.STATUS_POSITIONED_ABSOLUTE}`;
			tileElement.appendChild(container);
		}

		container.innerHTML = '';
		const component = mount(StatusIndicator, {
			target: container,
			props: {
				entityId: userId,
				entityType: ENTITY_TYPES.USER,
				get entityStatus() {
					return userStatuses.get(userId) ?? null;
				},
				showText: false,
				skipAutoFetch: true,
				onQueue: handleQueueUser,
				get userUsername() {
					const member = memberById.get(userId);
					const trackedUser = trackedUserById.get(userId);
					return member?.username ?? trackedUser?.name;
				},
				get userDisplayName() {
					const member = memberById.get(userId);
					const trackedUser = trackedUserById.get(userId);
					return member?.displayName ?? trackedUser?.displayName;
				},
				get userAvatarUrl() {
					const member = memberById.get(userId);
					const trackedUser = trackedUserById.get(userId);
					return member ? thumbnails.get(member.userId) : trackedUser?.thumbnailUrl;
				}
			}
		});

		mountedComponents.set(userId, component);
	}

	function handleRoleChange(event: Event) {
		if (!(event.target instanceof HTMLSelectElement)) return;
		const roleId = parseInt(event.target.value, 10);
		if (isNaN(roleId) || roleId === selectedRoleId) return;

		selectedRoleId = roleId;
		currentPage = 1;
		cursorCache = [null];
		carryoverCache = [[]];
		currentSortOrder = 'Desc';
		showPageInput = false;
		userStatuses.clear();
		presences.clear();
		void loadMembers();
	}

	function handleSortOrderSelectChange(event: Event) {
		if (!(event.target instanceof HTMLSelectElement)) return;
		const newOrder = event.target.value as SortOrder;
		if (newOrder === currentSortOrder) return;

		currentSortOrder = newOrder;
		currentPage = 1;
		cursorCache = [null];
		carryoverCache = [[]];
		userStatuses.clear();
		presences.clear();
		void loadMembers();
	}

	// Walks the cursor cache forward emitting CARRYOVER_ONLY entries when the API exhausts but leftover members remain
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
			errorMessage = $_('group_members_error_cursors');
			return false;
		} finally {
			isFetchingCursors = false;
		}
	}

	function handlePageInfoClick() {
		showPageInput = true;
		pageInputValue = String(currentPage);
	}

	// Offers to flip sort direction when the opposite walk needs fewer requests, otherwise warms the cursor cache to targetPage
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
				$_('group_members_page_jump_switch', {
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
				userStatuses.clear();
				presences.clear();
				currentPage = oppositeRequestsNeeded;

				const success = await fetchCursorsToPage(oppositeRequestsNeeded);
				if (!success) return;

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
					$_('group_members_page_jump_confirm', {
						values: { 0: currentRequestsNeeded, 1: targetPage }
					})
				);
				if (!confirmed) return;
			}

			const success = await fetchCursorsToPage(targetPage);
			if (!success) return;
		}

		currentPage = targetPage;

		const cursor = targetPage === 1 ? null : cursorCache[targetPage - 1];
		const carryover = targetPage === 1 ? [] : (carryoverCache[targetPage - 1] ?? []);
		await loadMembers(cursor, carryover);
	}

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

	function handleQueueUser(userId: string) {
		logger.userAction('group_carousel_queue_requested', { userId });
		queueModalManager.showQueue(userId);
	}

	async function handleStatusRefresh(userId: string) {
		try {
			const statuses = await queryMultipleUsers([userId], {
				onUpdate: (updatedUserId, status) => {
					if (updatedUserId === userId) {
						userStatuses.set(userId, status);
					}
				}
			});
			const status = statuses.get(userId);
			if (status) {
				revealTileForStatus(userId, status);
			}
		} catch (error) {
			logger.error('Failed to refresh status:', error);
		}
	}

	function cleanup() {
		mountedComponents.destroyAll();
		userStatuses.clear();
		presences.clear();
		trackedPresences.clear();
	}
</script>

{#snippet presenceIcon(presence: UserPresence | undefined)}
	{#if presence}
		{@const type = presence.userPresenceType}
		{@const iconClass =
			type === PRESENCE_TYPE.ONLINE
				? 'icon-online'
				: type === PRESENCE_TYPE.IN_GAME
					? 'icon-game'
					: type === PRESENCE_TYPE.IN_STUDIO
						? 'icon-studio'
						: null}
		{#if iconClass}
			<span
				class="rotector-member-presence {iconClass}"
				data-testid="presence-icon"
				title={presence.lastLocation}
			></span>
		{/if}
	{/if}
{/snippet}

<div bind:this={contentWrapper} class="group-members-section">
	<div class="group-members-header">
		<h2 class="group-members-title">{$_('group_members_title')}</h2>
		<div class="group-members-tabs" role="tablist">
			<button
				id="tab-by-role"
				class="group-members-tab"
				class:active={activeTab === 'by-role'}
				aria-selected={activeTab === 'by-role'}
				onclick={() => handleTabChange('by-role')}
				role="tab"
				tabindex={activeTab === 'by-role' ? 0 : -1}
				type="button"
			>
				{$_('group_members_tab_by_role')}
			</button>
			<button
				id="tab-tracked"
				class="group-members-tab"
				class:active={activeTab === 'tracked'}
				aria-selected={activeTab === 'tracked'}
				onclick={() => handleTabChange('tracked')}
				role="tab"
				tabindex={activeTab === 'tracked' ? 0 : -1}
				type="button"
			>
				{$_('group_members_tab_tracked')}
			</button>
		</div>
	</div>

	<div
		class="group-members-content"
		aria-labelledby={activeTab === 'by-role' ? 'tab-by-role' : 'tab-tracked'}
		role="tabpanel"
	>
		{#if activeTab === 'by-role'}
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
				<div class="group-members-controls">
					<select
						class="group-members-dropdown group-members-dropdown-role"
						aria-label={$_('group_members_role_select_aria')}
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
						aria-label={$_('group_members_sort_select_aria')}
						disabled={isLoadingMembers || isFetchingCursors}
						onchange={handleSortOrderSelectChange}
						value={currentSortOrder}
					>
						<option value="Desc">{$_('group_members_sort_newest')}</option>
						<option value="Asc">{$_('group_members_sort_oldest')}</option>
					</select>
				</div>

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
									<div class="rotector-member-avatar-wrapper">
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
										{@render presenceIcon(presences.get(member.userId))}
									</div>
									<span class="group-member-display-name rotector-member-display-name">
										{member.displayName}
									</span>
								</a>
							{/each}
						</div>
					</div>

					<div class="group-members-nav">
						<button
							class="group-members-nav-btn"
							disabled={currentPage === 1 || isFetchingCursors || isLoadingMembers}
							onclick={() => goToPage(currentPage - 1)}
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
									aria-label={$_('group_members_page_jump_tooltip')}
									onblur={() => (showPageInput = false)}
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
							onclick={() => goToPage(currentPage + 1)}
							type="button"
						>
							{$_('group_members_next')}
						</button>
					</div>
				{/if}
			{/if}
		{:else if isLoadingTracked && !hasLoadedTracked}
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
					aria-label={$_('group_members_tracked_filter_aria')}
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
							<div class="rotector-member-avatar-wrapper">
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
								{@render presenceIcon(trackedPresences.get(user.id))}
							</div>
							<span class="group-member-display-name rotector-member-display-name">
								{user.displayName}
							</span>
						</a>
					{/each}
				</div>
			</div>

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
								aria-label={$_('group_members_page_jump_tooltip')}
								onblur={() => (trackedShowPageInput = false)}
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
	</div>
</div>

<QueueModalManager bind:this={queueModalManager} onStatusRefresh={handleStatusRefresh} />
