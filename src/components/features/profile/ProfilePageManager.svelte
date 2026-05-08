<script lang="ts">
	import { get } from 'svelte/store';
	import { mount, unmount } from 'svelte';
	import { settings } from '@/lib/stores/settings';
	import { logger } from '@/lib/utils/logging/logger';
	import { waitForElement } from '@/lib/utils/dom/element-waiter';
	import type { ProfileQuerySubscription } from '@/lib/services/rotector/profile-query';
	import {
		COMPONENT_CLASSES,
		ENTITY_TYPES,
		PAGE_TYPES,
		REASON_KEYS,
		USER_ACTIONS
	} from '@/lib/types/constants';
	import { BLUR_SELECTORS } from '@/lib/services/blur/selectors';
	import {
		consumeSkipWarning,
		proceedFriendClick
	} from '@/lib/services/friends/friend-button-intercept';
	import { FRIENDS_CAROUSEL_SELECTORS } from '@/lib/controllers/selectors/friends';
	import {
		BTROBLOX_GROUPS_SELECTORS,
		PROFILE_GROUPS_SHOWCASE_SELECTORS,
		PROFILE_SELECTORS
	} from '@/lib/controllers/selectors/profile';
	import { SETTINGS_KEYS } from '@/lib/types/settings';
	import type { GroupStatus, UserStatus } from '@/lib/types/api';
	import type { CombinedStatus } from '@/lib/types/custom-api';
	import { blockUser } from '@/lib/services/roblox/actions';
	import {
		markProfileElementsForBlur,
		revealProfileElements,
		setProfileBlurState,
		observeProfileBlur
	} from '@/lib/services/blur/profile';
	import { isFlagged } from '@/lib/utils/status/status-utils';
	import { detectEncoding } from '@/lib/services/cipher/encoding-detector';
	import { getLoggedInUserId } from '@/lib/utils/client-id';
	import { restrictedAccessStore } from '@/lib/stores/restricted-access';
	import StatusIndicator from '../../status/StatusIndicator.svelte';
	import MembershipPill from '@/components/ui/membership/MembershipPill.svelte';
	import { tierNameOf, tierOf } from '@/lib/utils/membership-designs';
	import FriendWarning from '../friends/FriendWarning.svelte';
	import QueueModalManager from '../queue/QueueModalManager.svelte';
	import type { QueueModalManagerInstance } from '../queue/queue-modal-manager';
	import UserListManager from '../lists/UserListManager.svelte';
	import GroupListManager from '../groups/GroupListManager.svelte';
	import FriendsScanBar from '../friends/FriendsScanBar.svelte';
	import GroupsScanBar from '../groups/GroupsScanBar.svelte';
	import CipherIndicator from '../cipher/CipherIndicator.svelte';
	import { ROTECTOR_API_ID } from '@/lib/stores/custom-apis';

	interface Props {
		userId: string;
		querySubscription: ProfileQuerySubscription;
	}

	let { userId, querySubscription }: Props = $props();

	let userStatus = $state<CombinedStatus<UserStatus> | null>(null);

	let userDisplayName = $state<string | undefined>(undefined);
	let userUsername = $state<string | undefined>(undefined);
	let userAvatarUrl = $state<string | undefined>(undefined);

	const userIsFlagged = $derived(isFlagged(userStatus));

	let friendWarningOpen = $state(false);
	let showCarousel = $state(false);
	let showGroupsShowcase = $state(false);
	let profileElementsReady = $state(false);

	let queueModalManager: QueueModalManagerInstance | undefined;
	let statusContainer = $state<HTMLElement | null>(null);
	let membershipPillContainer: HTMLElement | null = null;
	let membershipPillSignature: string | null = null;
	let friendButtonHandler: ((event: Event) => void) | null = null;
	let headerReinjectObserver: MutationObserver | null = null;
	let isReinjecting = false;
	let statusComponent: Record<string, unknown> | null = null;
	let pillComponent: Record<string, unknown> | null = null;
	let cipherComponent: Record<string, unknown> | null = null;
	let blurObserverCleanup: (() => void) | null = null;
	let nameObserverCleanup: (() => void) | null = null;
	let cipherContainer: HTMLElement | null = null;
	let friendsScanBarCleanup: (() => void) | null = null;
	let groupsScanBarCleanup: (() => void) | null = null;

	function shouldBlurOutfit(status: CombinedStatus<UserStatus>): boolean {
		for (const result of status.values()) {
			if (result.loading) return true;
			if (result.data?.reasons && REASON_KEYS.AVATAR_OUTFIT in result.data.reasons) return true;
		}
		return false;
	}

	function applyStatus(status: CombinedStatus<UserStatus>) {
		userStatus = status;
		setProfileBlurState(shouldBlurOutfit(status) ? 'flagged' : 'safe');
		revealProfileElements(status);
	}

	$effect(() => {
		return querySubscription.subscribe(applyStatus);
	});

	$effect(() => {
		if (!profileElementsReady) return;
		markProfileElementsForBlur(userId);

		blurObserverCleanup = observeProfileBlur(userId);
		return () => {
			blurObserverCleanup?.();
		};
	});

	$effect(() => {
		void initialize();

		return cleanup;
	});

	async function initialize() {
		await setupStatusIndicator();
		setupHeaderCheck();

		// Mark ready before async setup so blur marking and observers don't wait for initialize() to finish
		profileElementsReady = true;

		await Promise.all([
			setupFriendWarning(),
			setupCarousel().then(setupFriendsScanBar),
			setupGroupsShowcase().then(setupGroupsScanBar),
			setupCipherIndicator()
		]);
	}

	function readProfileUserInfo(header: Element) {
		if (!userDisplayName) {
			const el = header.querySelector(PROFILE_SELECTORS.HEADER_TITLE);
			const text = el?.textContent.trim();
			if (text) userDisplayName = text;
		}

		if (!userUsername) {
			const el = header.querySelector(PROFILE_SELECTORS.USERNAME);
			const raw = el?.textContent.trim();
			if (raw) userUsername = raw.startsWith('@') ? raw.slice(1) : raw;
		}

		if (!userAvatarUrl) {
			const el = header.querySelector(PROFILE_SELECTORS.AVATAR_IMG);
			if (el instanceof HTMLImageElement && el.src) {
				userAvatarUrl = el.src;
			}
		}
	}

	// Watches the header for late-filled name, username, and avatar fields and disconnects once all three resolve
	function observeProfileUserInfo(header: Element) {
		nameObserverCleanup?.();

		if (userDisplayName && userUsername && userAvatarUrl) return;

		const observer = new MutationObserver(() => {
			readProfileUserInfo(header);
			if (userDisplayName && userUsername && userAvatarUrl) {
				observer.disconnect();
			}
		});

		observer.observe(header, {
			childList: true,
			characterData: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['src']
		});

		nameObserverCleanup = () => observer.disconnect();
	}

	// Waits for the header title, seeds tooltip identity props, and mounts the indicator in a rotector-owned container next to the title
	async function setupStatusIndicator() {
		try {
			const titleResult = await waitForElement(PROFILE_SELECTORS.HEADER_TITLE);

			if (!titleResult.success) {
				logger.warn('Could not find profile header title container');
				return;
			}

			// Seed tooltip identity props and observe the header if fields aren't filled yet
			const header = document.querySelector(PROFILE_SELECTORS.HEADER);
			if (header) {
				readProfileUserInfo(header);
				observeProfileUserInfo(header);
			}

			const titleContainer = titleResult.element.parentElement;

			if (!titleContainer) {
				logger.warn('Could not find parent container for profile title');
				return;
			}

			let container = titleContainer.querySelector<HTMLElement>(
				`.${COMPONENT_CLASSES.PROFILE_STATUS}`
			);
			if (!container) {
				container = document.createElement('div');
				container.className = COMPONENT_CLASSES.PROFILE_STATUS;
				container.dataset['rotectorOwned'] = 'true';

				titleContainer.appendChild(container);
			}

			statusContainer = container;
			mountStatusIndicator();
		} catch (error) {
			logger.error('Failed to setup status indicator:', error);
		}
	}

	function mountStatusIndicator() {
		if (!statusContainer || !userId) return;

		try {
			if (statusComponent) void unmount(statusComponent);

			statusContainer.innerHTML = '';

			statusComponent = mount(StatusIndicator, {
				target: statusContainer,
				props: {
					entityId: userId,
					entityType: ENTITY_TYPES.USER,
					get entityStatus() {
						return userStatus;
					},
					get userDisplayName() {
						return userDisplayName;
					},
					get userUsername() {
						return userUsername;
					},
					get userAvatarUrl() {
						return userAvatarUrl;
					},
					skipAutoFetch: true,
					suppressMembershipBadge: true,
					onClick: handleStatusClick,
					onQueue: handleQueueUser
				}
			});
		} catch (error) {
			logger.error('Failed to mount StatusIndicator:', error);
		}
	}

	// Skips remount when the design signature is unchanged so resubscribing to userStatus does not flicker the pill
	function mountMembershipPill(badge: NonNullable<typeof rotectorMembershipBadge>) {
		if (!statusContainer) return;

		// Skip remount when design hasn't changed
		const signature = `${String(badge.tier)}:${String(badge.badgeDesign)}:${String(badge.iconDesign)}:${String(badge.textDesign)}`;
		if (
			membershipPillSignature === signature &&
			pillComponent &&
			membershipPillContainer?.isConnected
		) {
			return;
		}

		// Anchor to the text column so the pill sits below the name rows
		const textColumn = statusContainer.parentElement?.parentElement;
		if (!textColumn) return;

		const tier = tierOf(badge.tier);
		const tierName = tierNameOf(badge.tier);

		try {
			if (pillComponent) void unmount(pillComponent);

			if (!membershipPillContainer || !membershipPillContainer.isConnected) {
				const container = document.createElement('div');
				container.className = COMPONENT_CLASSES.MEMBERSHIP_BADGE_PILL;
				container.dataset['rotectorOwned'] = 'true';
				textColumn.appendChild(container);
				membershipPillContainer = container;
			}

			pillComponent = mount(MembershipPill, {
				target: membershipPillContainer,
				props: {
					tier,
					tierName,
					badgeDesign: badge.badgeDesign,
					iconDesign: badge.iconDesign,
					textDesign: badge.textDesign
				}
			});
			membershipPillSignature = signature;
		} catch (error) {
			logger.error('Failed to mount MembershipPill:', error);
		}
	}

	function unmountMembershipPill() {
		if (pillComponent) {
			void unmount(pillComponent);
			pillComponent = null;
		}
		if (membershipPillContainer) {
			membershipPillContainer.remove();
			membershipPillContainer = null;
		}
		membershipPillSignature = null;
	}

	// Read the Rotector entry directly so the pill tracks the canonical badge even
	// when a non-Rotector custom-API tab is active in the tooltip
	const rotectorMembershipBadge = $derived(
		userStatus?.get(ROTECTOR_API_ID)?.data?.membershipBadge ?? null
	);

	// Mount the pill once the profile status container is in the DOM and unmount when
	// the badge disappears (sign-out, downgrade) so stale DOM doesn't linger
	$effect(() => {
		if (!statusContainer) return;
		if (rotectorMembershipBadge) {
			mountMembershipPill(rotectorMembershipBadge);
		} else {
			unmountMembershipPill();
		}
	});

	async function setupFriendWarning() {
		try {
			const { element: friendButton } = await waitForElement(
				PROFILE_SELECTORS.HEADER_FRIEND_BUTTON
			);
			if (!friendButton) return;

			friendButtonHandler = (event: Event) => {
				// Status may not be loaded at setup time so gate on the flag per click
				if (!userIsFlagged) return;
				if (consumeSkipWarning(friendButton)) return;

				event.preventDefault();
				event.stopPropagation();
				friendWarningOpen = true;
			};

			// Capture phase to intercept before other handlers
			friendButton.addEventListener('click', friendButtonHandler, true);
		} catch (error) {
			logger.error('Failed to setup friend warning:', error);
		}
	}

	async function setupCarousel() {
		try {
			const containerSelector = FRIENDS_CAROUSEL_SELECTORS.CONTAINER;

			const result = await waitForElement(containerSelector);

			if (result.success) {
				showCarousel = true;
				logger.debug('Profile carousel detected and will be managed');
			} else {
				logger.debug('No friends carousel found on profile page');
			}
		} catch (error) {
			logger.error('Failed to setup carousel:', error);
		}
	}

	async function setupGroupsShowcase() {
		try {
			// Check if groups checks are enabled
			const currentSettings = get(settings);
			if (!currentSettings[SETTINGS_KEYS.GROUPS_CHECK_ENABLED]) {
				logger.debug('Groups checks disabled, skipping groups showcase setup');
				return;
			}

			// Check for BTRoblox groups container
			const btrContainer = document.querySelector(BTROBLOX_GROUPS_SELECTORS.CONTAINER);
			if (btrContainer) {
				showGroupsShowcase = true;
				logger.debug('BTRoblox groups showcase detected and will be managed');
				return;
			}

			// Wait for default Roblox groups section
			const result = await waitForElement(
				`${PROFILE_GROUPS_SHOWCASE_SELECTORS.SECTION} ${PROFILE_GROUPS_SHOWCASE_SELECTORS.ITEM}`
			);

			if (result.success) {
				showGroupsShowcase = true;
				logger.debug('Profile groups showcase detected and will be managed');
			} else {
				logger.debug('No groups showcase found on profile page');
			}
		} catch (error) {
			logger.error('Failed to setup groups showcase:', error);
		}
	}

	async function setupFriendsScanBar() {
		if (!showCarousel) return;
		if (!get(settings)[SETTINGS_KEYS.FRIENDS_CHECK_ENABLED]) return;
		const isOwnProfile = userId === getLoggedInUserId();
		if (get(restrictedAccessStore).isRestricted && !isOwnProfile) return;

		try {
			const result = await waitForElement(FRIENDS_CAROUSEL_SELECTORS.HEADER);
			if (!result.success) return;

			const heading = result.element.querySelector('h2');
			if (!heading) return;

			const container = document.createElement('span');
			container.className = COMPONENT_CLASSES.SCAN_HOST;
			heading.insertAdjacentElement('afterend', container);

			const component = mount(FriendsScanBar, {
				target: container,
				props: { userId, isOwnFriends: userId === getLoggedInUserId() }
			});

			friendsScanBarCleanup = () => {
				void unmount(component);
				container.remove();
			};
		} catch (error) {
			logger.error('Failed to setup friends scan bar:', error);
		}
	}

	async function setupGroupsScanBar() {
		if (!showGroupsShowcase) return;
		if (!get(settings)[SETTINGS_KEYS.GROUPS_CHECK_ENABLED]) return;
		const isOwnProfile = userId === getLoggedInUserId();
		if (get(restrictedAccessStore).isRestricted && !isOwnProfile) return;

		try {
			const result = await waitForElement(PROFILE_GROUPS_SHOWCASE_SELECTORS.HEADER_TITLE);
			if (!result.success) return;

			// Roblox's communities-carousel parent stacks children vertically, so a sibling span lands on the next row
			// Append inside the h2 (Roblox's own .friends-count pattern) to stay inline with the heading
			const container = document.createElement('span');
			container.className = COMPONENT_CLASSES.SCAN_HOST;
			result.element.appendChild(container);

			const component = mount(GroupsScanBar, {
				target: container,
				props: { userId }
			});

			groupsScanBarCleanup = () => {
				void unmount(component);
				container.remove();
			};
		} catch (error) {
			logger.error('Failed to setup groups scan bar:', error);
		}
	}

	async function setupCipherIndicator() {
		const currentSettings = get(settings);
		if (!currentSettings[SETTINGS_KEYS.CIPHER_DECODING_ENABLED]) {
			logger.debug('Cipher decoding disabled, skipping indicator setup');
			return;
		}

		const { element: descEl } = await waitForElement(BLUR_SELECTORS.PROFILE_DESCRIPTION);

		if (!descEl) {
			logger.debug('No profile description found for cipher detection');
			return;
		}

		const result = detectEncoding(descEl.textContent);
		if (!result) return;

		if (cipherComponent) void unmount(cipherComponent);

		const container = document.createElement('div');
		container.className = COMPONENT_CLASSES.CIPHER_INDICATOR;
		container.dataset['rotectorOwned'] = 'true';
		descEl.insertAdjacentElement('afterend', container);
		cipherContainer = container;

		cipherComponent = mount(CipherIndicator, {
			target: container,
			props: {
				descEl,
				encoding: result
			}
		});
	}

	function getActiveHeader(): HTMLElement | null {
		const header = document.querySelector(PROFILE_SELECTORS.HEADER);
		if (header instanceof HTMLElement && header.offsetParent !== null) {
			return header;
		}
		return null;
	}

	// Re-injects the indicator only if the active visible header lacks one, guarded by isReinjecting to avoid concurrent rebuilds
	async function checkAndReinject(): Promise<boolean> {
		if (isReinjecting) return false;

		const activeHeader = getActiveHeader();
		if (!activeHeader) return false;

		const containerInActiveHeader = activeHeader.querySelector(
			`.${COMPONENT_CLASSES.PROFILE_STATUS}`
		);

		if (!containerInActiveHeader) {
			logger.debug('Status indicator needs re-injection - not in active header');

			isReinjecting = true;
			try {
				await setupStatusIndicator();
			} finally {
				isReinjecting = false;
			}
			return true;
		}
		return false;
	}

	// Roblox may re-render the profile header shortly after page load, removing our
	// injected elements. Coalesce mutation bursts via rAF and re-inject when the
	// indicator is missing from the active header.
	function setupHeaderCheck() {
		let frameScheduled = false;
		headerReinjectObserver = new MutationObserver(() => {
			if (frameScheduled) return;
			frameScheduled = true;
			requestAnimationFrame(() => {
				frameScheduled = false;
				void checkAndReinject();
			});
		});
		headerReinjectObserver.observe(document.body, {
			childList: true,
			subtree: true
		});
	}

	function handleStatusClick(clickedUserId: string) {
		logger.userAction(USER_ACTIONS.STATUS_CLICKED, { userId: clickedUserId });
	}

	function handleQueueUser(
		clickedUserId: string,
		isReprocess = false,
		status?: UserStatus | GroupStatus | null
	) {
		logger.userAction(USER_ACTIONS.QUEUE_REQUESTED, { userId: clickedUserId, isReprocess });
		queueModalManager?.showQueue(clickedUserId, isReprocess, status as UserStatus | null);
	}

	function handleStatusRefresh() {
		querySubscription.refresh();
	}

	function handleFriendProceed() {
		logger.userAction(USER_ACTIONS.FRIEND_PROCEED, { userId });

		// Find the active friend button and simulate click to proceed with friend request
		const friendButton = document.querySelector<HTMLElement>(
			PROFILE_SELECTORS.HEADER_FRIEND_BUTTON
		);

		if (friendButton) {
			proceedFriendClick(friendButton);
		} else {
			logger.warn('Could not find friend button to proceed with friend request');
		}

		friendWarningOpen = false;
	}

	function handleFriendCancel() {
		logger.userAction(USER_ACTIONS.FRIEND_CANCEL, { userId });
		friendWarningOpen = false;
	}

	async function handleFriendBlock() {
		logger.userAction(USER_ACTIONS.FRIEND_BLOCK, { userId });
		friendWarningOpen = false;

		try {
			await blockUser(userId);
			window.location.reload();
		} catch (error) {
			logger.error('Failed to block user:', error);
		}
	}

	function cleanup() {
		setProfileBlurState(null);

		const friendButton = document.querySelector<HTMLElement>(
			PROFILE_SELECTORS.HEADER_FRIEND_BUTTON
		);
		if (friendButton && friendButtonHandler) {
			friendButton.removeEventListener('click', friendButtonHandler, true);
		}

		headerReinjectObserver?.disconnect();
		nameObserverCleanup?.();

		if (statusComponent) void unmount(statusComponent);
		if (cipherComponent) void unmount(cipherComponent);
		unmountMembershipPill();

		friendsScanBarCleanup?.();
		friendsScanBarCleanup = null;
		groupsScanBarCleanup?.();
		groupsScanBarCleanup = null;

		if (statusContainer) {
			if (statusContainer.dataset['rotectorOwned'] === 'true') {
				statusContainer.remove();
			} else {
				statusContainer.innerHTML = '';
			}
		}

		if (cipherContainer) cipherContainer.remove();
	}
</script>

{#if userIsFlagged}
	<FriendWarning
		isOpen={friendWarningOpen}
		onBlock={handleFriendBlock}
		onCancel={handleFriendCancel}
		onProceed={handleFriendProceed}
		{userId}
		{userStatus}
	/>
{/if}

<QueueModalManager bind:this={queueModalManager} onStatusRefresh={handleStatusRefresh} />

{#if showCarousel}
	<UserListManager pageType={PAGE_TYPES.FRIENDS_CAROUSEL} profileOwnerId={userId} />
{/if}

{#if showGroupsShowcase}
	<GroupListManager profileOwnerId={userId} />
{/if}
