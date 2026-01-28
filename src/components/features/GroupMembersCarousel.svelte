<script lang="ts">
	import { mount, onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import {
		getGroupRoles,
		getGroupMembers,
		getMemberThumbnails,
		type GroupRole,
		type GroupMember
	} from '@/lib/services/roblox-groups-api';
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
	import StatusIndicator from '../status/StatusIndicator.svelte';
	import QueueModalManager from './QueueModalManager.svelte';
	import type { QueueModalManagerInstance } from '@/lib/types/components';

	interface Props {
		groupId: string;
		onError?: (error: string) => void;
		onUserProcessed?: (userId: string, status: CombinedStatus) => void;
	}

	let { groupId, onError, onUserProcessed }: Props = $props();

	const API_LIMIT = 25;
	const DISPLAY_LIMIT = 24;

	// State
	let roles = $state<GroupRole[]>([]);
	let selectedRoleId = $state<number | null>(null);
	let members = $state<GroupMember[]>([]);
	let thumbnails = $state(new Map<number, string>());
	let userStatuses = new SvelteMap<string, CombinedStatus>();
	let mountedComponents = new SvelteMap<string, { unmount?: () => void }>();

	let isLoadingRoles = $state(true);
	let isLoadingMembers = $state(false);
	let errorMessage = $state<string | null>(null);

	// Pagination
	let nextCursor = $state<string | null>(null);
	let previousCursors = $state<(string | null)[]>([]);
	let currentPage = $state(1);

	// Carryover logic cuz the 25th member doesn't fit in the 24-member grid
	let pendingCarryover = $state<GroupMember | null>(null);
	let carryoverHistory = $state<(GroupMember | null)[]>([]);

	// Page navigation
	// NOTE:
	// cursorCache[i] = cursor to use for page i+1 (index 0 = null for page 1)
	// carryoverCache[i] = carryover member to use for page i+1 (index 0 = null for page 1)
	let cursorCache = $state<(string | null)[]>([null]);
	let carryoverCache = $state<(GroupMember | null)[]>([null]);
	let isFetchingCursors = $state(false);
	let showPageInput = $state(false);
	let pageInputValue = $state('');
	let pageInputElement = $state<HTMLInputElement | null>(null);

	// DOM references
	let portalTarget: HTMLDivElement | null = null;
	let contentWrapper: HTMLDivElement | null = null;

	// Queue modal
	let queueModalManager: QueueModalManagerInstance;

	// Inject section into Roblox page and portal content
	onMount(() => {
		const tabContent = document.querySelector(GROUP_MEMBERS_CAROUSEL_SELECTORS.TAB_CONTENT);
		if (!tabContent) {
			logger.warn('Could not find tab content container for members carousel');
			return;
		}

		// Create section wrapper in the Roblox DOM
		portalTarget = document.createElement('div');
		portalTarget.className = `section ${GROUP_MEMBERS_CAROUSEL_SELECTORS.SECTION.slice(1)}`;

		// Find insertion point
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
		if (members.length === 0 || isLoadingMembers) return;

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
			errorMessage = 'Failed to load group roles';
			onError?.('Failed to load group roles');
		} finally {
			isLoadingRoles = false;
		}
	}

	// Load members for selected role
	async function loadMembers(cursor?: string | null, carryover: GroupMember | null = null) {
		if (selectedRoleId === null) return;

		try {
			isLoadingMembers = true;
			cleanupMountedComponents();

			const response = await getGroupMembers(groupId, selectedRoleId, cursor, API_LIMIT);

			// Build display array
			const displayMembers: GroupMember[] = [];
			if (carryover) {
				displayMembers.push(carryover);
			}

			// Calculate how many we need from the fetch
			const needed = DISPLAY_LIMIT - displayMembers.length;
			displayMembers.push(...response.data.slice(0, needed));

			// Store leftover as pending carryover for next page
			pendingCarryover = response.data.length > needed ? response.data[needed] : null;

			members = displayMembers;
			nextCursor = response.nextPageCursor;

			// Load thumbnails
			const userIds = members.map((m) => m.userId);
			const fetchedThumbnails = await getMemberThumbnails(userIds);
			thumbnails = fetchedThumbnails;

			// Load Rotector statuses
			await loadStatuses(userIds.map(String));
		} catch (error) {
			logger.error('Failed to load group members:', error);
			errorMessage = 'Failed to load members';
			onError?.('Failed to load group members');

			currentPage = 1;
			previousCursors = [];
			carryoverHistory = [];
			pendingCarryover = null;
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
		const member = members.find((m) => String(m.userId) === userId);

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
				userUsername: member?.username,
				userDisplayName: member?.displayName,
				userAvatarUrl: member ? thumbnails.get(member.userId) : undefined
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
		pendingCarryover = null;
		currentPage = 1;
		cursorCache = [null];
		carryoverCache = [null];
		showPageInput = false;
		userStatuses.clear();
		void loadMembers();
	}

	// Handle pagination with carryover tracking
	async function goToNextPage() {
		if (!nextCursor && !pendingCarryover) return;

		carryoverHistory = [...carryoverHistory, pendingCarryover];
		previousCursors = [...previousCursors, nextCursor];
		currentPage++;

		if (!nextCursor && pendingCarryover) {
			isLoadingMembers = true;
			cleanupMountedComponents();

			try {
				const carryoverMember = pendingCarryover;
				pendingCarryover = null;
				nextCursor = null;
				members = [carryoverMember];

				const userIds = [carryoverMember.userId];
				const fetchedThumbnails = await getMemberThumbnails(userIds);
				thumbnails = fetchedThumbnails;
				await loadStatuses(userIds.map(String));
			} catch (error) {
				logger.error('Failed to load carryover member:', error);
				errorMessage = 'Failed to load members';
				onError?.('Failed to load group members');
			} finally {
				isLoadingMembers = false;
			}
			return;
		}

		void loadMembers(nextCursor, pendingCarryover);
	}

	function goToPreviousPage() {
		if (previousCursors.length === 0 || currentPage === 1) return;

		// Pop from history stacks
		const historyClone = [...carryoverHistory];
		historyClone.pop();
		carryoverHistory = historyClone;

		const cursorsClone = [...previousCursors];
		cursorsClone.pop();
		previousCursors = cursorsClone;
		currentPage--;

		// Determine which cursor and carryover to use
		if (currentPage === 1) {
			void loadMembers(null, null);
		} else {
			const prevCarryover = historyClone.length > 0 ? historyClone[historyClone.length - 1] : null;
			void loadMembers(cursorsClone[cursorsClone.length - 1] ?? null, prevCarryover);
		}
	}

	// Fetch cursors and carryovers up to a target page
	async function fetchCursorsToPage(targetPage: number): Promise<boolean> {
		if (selectedRoleId === null) return false;

		isFetchingCursors = true;

		try {
			// Start from the last cached cursor
			let cursor: string | null = cursorCache[cursorCache.length - 1] ?? null;

			// Fetch cursors and carryovers until we have enough to reach targetPage
			while (cursorCache.length < targetPage) {
				const response = await getGroupMembers(groupId, selectedRoleId, cursor, API_LIMIT);

				// Calculate carryover index based on whether this is the first fetch
				// NOTE:
				// First page shows DISPLAY_LIMIT member
				// Subsequent pages show DISPLAY_LIMIT - 1 new members + 1 carryover
				const isFirstFetch = cursorCache.length === 1;
				const carryoverIndex = isFirstFetch ? DISPLAY_LIMIT : DISPLAY_LIMIT - 1;
				const nextCarryover =
					response.data.length > carryoverIndex ? response.data[carryoverIndex] : null;

				cursorCache = [...cursorCache, response.nextPageCursor];
				carryoverCache = [...carryoverCache, nextCarryover];

				if (!response.nextPageCursor) break;
				cursor = response.nextPageCursor;
				await new Promise((r) => setTimeout(r, 100)); // Rate limit
			}
			return true;
		} catch (error) {
			logger.error('Failed to fetch cursors:', error);
			errorMessage = 'Failed to load page cursors';
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

	// Navigate to a specific page
	async function goToPage(targetPage: number) {
		const totalPages = selectedRole ? Math.ceil(selectedRole.memberCount / DISPLAY_LIMIT) : 1;
		if (targetPage < 1 || targetPage > totalPages || targetPage === currentPage) return;

		// Check if we need to fetch more cursors
		if (cursorCache.length < targetPage) {
			const requestsNeeded = targetPage - cursorCache.length;
			const confirmed = confirm(
				`This will make ${requestsNeeded} request${requestsNeeded > 1 ? 's' : ''} to reach page ${targetPage}. Continue?`
			);
			if (!confirmed) return;

			const success = await fetchCursorsToPage(targetPage);
			if (!success) return;
		}

		// Reset navigation state
		previousCursors = [];
		carryoverHistory = [];
		pendingCarryover = null;
		currentPage = targetPage;

		// Rebuild history stacks for backward navigation
		for (let i = 1; i < targetPage; i++) {
			previousCursors = [...previousCursors, cursorCache[i] ?? null];
			carryoverHistory = [...carryoverHistory, carryoverCache[i] ?? null];
		}

		// Load the target page
		const cursor = targetPage === 1 ? null : cursorCache[targetPage - 1];
		const carryover = targetPage === 1 ? null : carryoverCache[targetPage - 1];
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
		<h2 class="group-members-title">Members</h2>
	</div>

	<!-- Content -->
	<div class="group-members-content">
		{#if isLoadingRoles}
			<div class="group-members-loading">
				<div class="group-members-spinner"></div>
			</div>
		{:else if errorMessage}
			<div class="group-members-error">
				<span>{errorMessage}</span>
				<button class="group-members-nav-btn" onclick={() => loadRoles()} type="button"
					>Retry</button
				>
			</div>
		{:else if roles.length === 0}
			<div class="group-members-empty">
				<span>No members found</span>
			</div>
		{:else}
			<!-- Role Dropdown -->
			<div class="group-members-role-selector">
				<select
					class="group-members-dropdown"
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
			</div>

			<!-- Member Grid -->
			{#if members.length === 0 && !isLoadingMembers}
				<div class="group-members-empty">
					<span>No members in this role</span>
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
						Previous
					</button>
					{#if isFetchingCursors}
						<span class="group-members-page-info group-members-page-loading">
							<span class="group-members-page-spinner"></span>
							Loading...
						</span>
					{:else if showPageInput}
						<span class="group-members-page-info">
							Page
							<input
								bind:this={pageInputElement}
								class="group-members-page-input"
								onblur={handlePageInputBlur}
								onkeydown={handlePageInputKeydown}
								type="text"
								bind:value={pageInputValue}
							/>
							{#if selectedRole}
								of {Math.ceil(selectedRole.memberCount / DISPLAY_LIMIT)}
							{/if}
						</span>
					{:else}
						<button
							class="group-members-page-info group-members-page-btn"
							onclick={handlePageInfoClick}
							title="Click to jump to page"
							type="button"
						>
							Page {currentPage}
							{#if selectedRole}
								of {Math.ceil(selectedRole.memberCount / DISPLAY_LIMIT)}
							{/if}
						</button>
					{/if}
					<button
						class="group-members-nav-btn"
						disabled={(!nextCursor && !pendingCarryover) || isFetchingCursors || isLoadingMembers}
						onclick={goToNextPage}
						type="button"
					>
						Next
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- Queue Modal Manager -->
<QueueModalManager bind:this={queueModalManager} onStatusRefresh={handleStatusRefresh} />
