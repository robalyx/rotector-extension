<script lang="ts">
	import { get } from 'svelte/store';
	import { mount } from 'svelte';
	import { settings } from '@/lib/stores/settings';
	import { logger } from '@/lib/utils/logger';
	import { waitForElement } from '@/lib/utils/element-waiter';
	import type { ProfileQuerySubscription } from '@/lib/utils/profile-query';
	import {
		BTROBLOX_GROUPS_SELECTORS,
		COMPONENT_CLASSES,
		ENTITY_TYPES,
		FRIENDS_CAROUSEL_SELECTORS,
		PAGE_TYPES,
		PROFILE_GROUPS_SHOWCASE_SELECTORS,
		PROFILE_SELECTORS,
		USER_ACTIONS
	} from '@/lib/types/constants';
	import { SETTINGS_KEYS } from '@/lib/types/settings';
	import type { UserStatus } from '@/lib/types/api';
	import type { CombinedStatus } from '@/lib/types/custom-api';
	import { queryUserProgressive, ROTECTOR_API_ID } from '@/lib/services/unified-query-service';
	import {
		markProfileElementsForBlur,
		revealProfileElements,
		setProfileBlurState,
		clearProfileBlurState,
		observeProfileOutfitSwitch,
		observeProfileDescriptions,
		observeProfileHeader
	} from '@/lib/services/blur-service';
	import { isFlagged } from '@/lib/utils/status-utils';
	import {
		extractFlaggedOutfitNames,
		type FlaggedOutfitInfo
	} from '@/lib/utils/violation-formatter';
	import StatusIndicator from '../status/StatusIndicator.svelte';
	import FriendWarning from './FriendWarning.svelte';
	import QueueModalManager from './QueueModalManager.svelte';
	import OutfitViewerModal from './OutfitViewerModal.svelte';
	import type { QueueModalManagerInstance } from '@/lib/types/components';
	import UserListManager from './UserListManager.svelte';
	import GroupListManager from './GroupListManager.svelte';

	interface Props {
		userId: string;
		querySubscription: ProfileQuerySubscription;
	}

	let { userId, querySubscription }: Props = $props();

	// Status state owned by this component
	let userStatus = $state<CombinedStatus | null>(null);

	// Check if user is flagged by any API
	const userIsFlagged = $derived(isFlagged(userStatus));

	// Component state
	let friendWarningOpen = $state(false);
	let outfitViewerOpen = $state(false);
	let showCarousel = $state(false);
	let showGroupsShowcase = $state(false);
	let profileElementsReady = $state(false);

	// Component references
	let queueModalManager: QueueModalManagerInstance | undefined;
	let statusContainer: HTMLElement | null = null;
	let friendButtonHandler: ((event: Event) => void) | null = null;
	let headerCheckInterval: ReturnType<typeof setInterval> | null = null;
	let isReinjecting = false;
	let mountedComponents = $state(new Map<string, { unmount?: () => void }>());
	let refreshCancelQuery: (() => void) | null = null;
	let outfitObserverCleanup: (() => void) | null = null;
	let descriptionObserverCleanup: (() => void) | null = null;
	let headerObserverCleanup: (() => void) | null = null;

	// Extract flagged outfit names from user status
	const flaggedOutfits = $derived.by(() => {
		if (!userStatus) return new Map<string, FlaggedOutfitInfo>();

		const rotectorStatus = userStatus.customApis.get(ROTECTOR_API_ID)?.data;
		if (!rotectorStatus?.reasons?.['Avatar Outfit']?.evidence) {
			return new Map<string, FlaggedOutfitInfo>();
		}

		return extractFlaggedOutfitNames(rotectorStatus.reasons['Avatar Outfit'].evidence);
	});

	// Returns true if outfit should be blurred
	function shouldBlurOutfit(status: CombinedStatus): boolean {
		for (const result of status.customApis.values()) {
			if (result.loading) return true;
			if (result.data?.reasons && 'Avatar Outfit' in result.data.reasons) return true;
		}
		return false;
	}

	// Subscribe to status updates from pre-fetched query
	$effect(() => {
		return querySubscription.subscribe((status) => {
			userStatus = status;
			const shouldBlur = shouldBlurOutfit(status);
			setProfileBlurState(shouldBlur ? 'flagged' : 'safe');
			revealProfileElements(status);
		});
	});

	// Mark profile elements for blur tracking
	$effect(() => {
		if (!profileElementsReady) return;
		markProfileElementsForBlur(userId);

		// Set up observers for dynamic elements
		outfitObserverCleanup = observeProfileOutfitSwitch(userId);
		descriptionObserverCleanup = observeProfileDescriptions(userId);
		headerObserverCleanup = observeProfileHeader(userId);

		return () => {
			outfitObserverCleanup?.();
			descriptionObserverCleanup?.();
			headerObserverCleanup?.();
		};
	});

	// Initialize components when mounted
	$effect(() => {
		void initialize();

		return cleanup;
	});

	// Initialize profile components
	async function initialize() {
		try {
			await setupStatusIndicator();
			setupHeaderCheck();

			// NOTE: We mark profile elements ready early so blur marking and observers start immediately
			profileElementsReady = true;

			await Promise.all([setupFriendWarning(), setupCarousel(), setupGroupsShowcase()]);

			logger.debug('ProfilePageManager initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize ProfilePageManager:', error);
		}
	}

	// Set up status indicator in profile header
	async function setupStatusIndicator() {
		try {
			// Wait for profile header title
			const titleResult = await waitForElement(PROFILE_SELECTORS.HEADER_TITLE);

			if (!titleResult.success || !titleResult.element) {
				logger.warn('Could not find profile header title container');
				return;
			}

			// Inject status indicator after the title span
			const titleContainer = titleResult.element.parentElement;

			if (!titleContainer) {
				logger.warn('Could not find parent container for profile title');
				return;
			}

			// Check if container already exists to reuse it
			let container = titleContainer.querySelector(
				`.${COMPONENT_CLASSES.PROFILE_STATUS}`
			) as HTMLElement;
			if (!container) {
				// Create container for status indicator
				container = document.createElement('div');
				container.className = COMPONENT_CLASSES.PROFILE_STATUS;
				container.dataset.rotectorOwned = 'true';

				// Append directly to title container
				titleContainer.appendChild(container);
			}

			statusContainer = container;

			// Mount StatusIndicator component to the container
			mountStatusIndicator();

			logger.debug('Status indicator container set up and component mounted');
		} catch (error) {
			logger.error('Failed to setup status indicator:', error);
		}
	}

	// Mount StatusIndicator component
	function mountStatusIndicator() {
		if (!statusContainer || !userId) return;

		try {
			// Check and unmount existing component
			const existingComponent = mountedComponents.get('profile-status');
			if (existingComponent) {
				existingComponent.unmount?.();
				mountedComponents.delete('profile-status');
			}

			// Clear container content
			statusContainer.innerHTML = '';

			// Mount new StatusIndicator
			const component = mount(StatusIndicator, {
				target: statusContainer,
				props: {
					entityId: userId,
					entityType: ENTITY_TYPES.USER,
					get entityStatus() {
						return userStatus;
					},
					skipAutoFetch: true,
					onClick: handleStatusClick,
					onQueue: handleQueueUser,
					onViewOutfits: handleViewOutfits
				}
			});

			// Track the component
			mountedComponents.set('profile-status', component);

			logger.debug('StatusIndicator component mounted');
		} catch (error) {
			logger.error('Failed to mount StatusIndicator:', error);
		}
	}

	// Set up friend warning if applicable
	async function setupFriendWarning() {
		try {
			if (!userIsFlagged) return;

			// Get the active friend button based on header version
			const friendButton = await getActiveFriendButton();

			if (!friendButton) {
				logger.debug('No friend button found for warning setup');
				return;
			}

			// Set up click interception
			friendButtonHandler = (event: Event) => {
				// Check if user specifically wants to skip the warning
				if (friendButton.dataset.skipWarning) {
					delete friendButton.dataset.skipWarning;
					return;
				}

				// Only intercept if this is an "Add Connection" or "Add" button
				const buttonText = friendButton.textContent?.trim().toLowerCase() || '';
				if (!buttonText.includes('add connection') && !buttonText.includes('add')) {
					return;
				}

				// Prevent the default friend request behavior
				event.preventDefault();
				event.stopPropagation();

				// Show the friend warning modal
				friendWarningOpen = true;
			};

			// Add click listener with capture to intercept before other handlers
			friendButton.addEventListener('click', friendButtonHandler, true);

			logger.debug('Friend warning setup completed');
		} catch (error) {
			logger.error('Failed to setup friend warning:', error);
		}
	}

	// Set up carousel manager if carousel exists
	async function setupCarousel() {
		try {
			const containerSelector = FRIENDS_CAROUSEL_SELECTORS.CONTAINER;

			// Wait for carousel container
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

	// Set up groups showcase manager if groups showcase exists
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

	// Get the currently visible header element
	function getActiveHeader(): HTMLElement | null {
		const header = document.querySelector(PROFILE_SELECTORS.HEADER);
		if (header instanceof HTMLElement && header.offsetParent !== null) {
			return header;
		}
		return null;
	}

	// Check if status indicator needs re-injection
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

	// NOTE: This is temporary.
	// Roblox may re-render the profile header shortly after page load, removing our injected elements.
	// Poll to detect when this happens and re-inject the status indicator.
	function setupHeaderCheck() {
		if (headerCheckInterval) {
			clearInterval(headerCheckInterval);
		}

		headerCheckInterval = setInterval(() => void checkAndReinject(), 500);

		logger.debug('Header check interval set up');
	}

	// Handle status indicator click
	function handleStatusClick(clickedUserId: string) {
		logger.userAction(USER_ACTIONS.STATUS_CLICKED, { userId: clickedUserId });
	}

	// Handle queue user request
	function handleQueueUser(clickedUserId: string, isReprocess = false, status?: UserStatus | null) {
		logger.userAction(USER_ACTIONS.QUEUE_REQUESTED, { userId: clickedUserId, isReprocess });
		queueModalManager?.showQueue(clickedUserId, isReprocess, status);
	}

	// Handle view outfits request
	function handleViewOutfits() {
		outfitViewerOpen = true;
	}

	// Refresh status after queue completion
	function handleStatusRefresh() {
		refreshCancelQuery?.();
		refreshCancelQuery = queryUserProgressive(userId, (status) => {
			userStatus = status;
			const shouldBlur = shouldBlurOutfit(status);
			setProfileBlurState(shouldBlur ? 'flagged' : 'safe');
			revealProfileElements(status);
		});
	}

	// Handle friend request proceed
	function handleFriendProceed() {
		logger.userAction(USER_ACTIONS.FRIEND_PROCEED, { userId });

		// Find the active friend button and simulate click to proceed with friend request
		const friendButton = getActiveFriendButtonSync();

		if (friendButton) {
			friendButton.dataset.skipWarning = 'true';
			friendButton.click();

			logger.debug('Friend request proceeded - simulated click');
		} else {
			logger.warn('Could not find friend button to proceed with friend request');
		}

		friendWarningOpen = false;
	}

	// Handle friend request cancel
	function handleFriendCancel() {
		logger.userAction(USER_ACTIONS.FRIEND_CANCEL, { userId });
		friendWarningOpen = false;
		logger.debug('Friend request cancelled by user');
	}

	// Handle block user action
	function handleFriendBlock() {
		logger.userAction(USER_ACTIONS.FRIEND_BLOCK, { userId });

		try {
			// Find the more options button (three dots)
			const moreButton = document.querySelector(PROFILE_SELECTORS.HEADER_DROPDOWN_BUTTON);

			if (moreButton instanceof HTMLElement) {
				// Click the more button to open dropdown
				moreButton.click();

				// Wait for dropdown to appear and find block option
				void (async () => {
					try {
						const result = await waitForElement('#block-button', {
							maxRetries: 5,
							baseDelay: 100,
							maxDelay: 1000
						});

						if (result.success && result.element instanceof HTMLElement) {
							result.element.click();
							logger.debug('Block user action triggered');
						} else {
							logger.warn('Could not find block button in dropdown after waiting');
						}
					} catch (error) {
						logger.error('Error waiting for block button:', error);
					}
				})();
			} else {
				logger.warn('Could not find more options button for blocking');
			}
		} catch (error) {
			logger.error('Error blocking user:', error);
		}

		// Hide the modal
		friendWarningOpen = false;
	}

	// Handle carousel user processed event
	function handleCarouselUserProcessed(processedUserId: string, status: CombinedStatus) {
		logger.debug('Profile carousel user processed', {
			userId: processedUserId,
			hasStatus: !!status
		});
	}

	// Handle carousel errors
	function handleCarouselError(error: string) {
		logger.error('Profile carousel UserListManager error:', error);
	}

	// Handle groups showcase errors
	function handleGroupsShowcaseError(error: string) {
		logger.error('Profile groups showcase GroupListManager error:', error);
	}

	// Cleanup resources
	function cleanup() {
		try {
			// Clear profile blur state when leaving page
			clearProfileBlurState();

			// Clean up friend button event listener
			const friendButton = getActiveFriendButtonSync();

			if (friendButton && friendButtonHandler) {
				friendButton.removeEventListener('click', friendButtonHandler, true);
				friendButtonHandler = null;
			}

			// Clean up header check interval
			if (headerCheckInterval) {
				clearInterval(headerCheckInterval);
				headerCheckInterval = null;
			}

			// Clean up any active refresh query
			refreshCancelQuery?.();
			refreshCancelQuery = null;

			// Clean up mounted components
			mountedComponents.forEach((component) => component.unmount?.());
			mountedComponents.clear();

			// Clean up status container
			if (statusContainer) {
				if (statusContainer.dataset.rotectorOwned === 'true') {
					statusContainer.remove();
				} else {
					statusContainer.innerHTML = '';
				}
				statusContainer = null;
			}

			logger.debug('ProfilePageManager cleanup completed');
		} catch (error) {
			logger.error('Failed to cleanup ProfilePageManager:', error);
		}
	}

	// Get the active friend button (sync version)
	function getActiveFriendButtonSync(): HTMLElement | null {
		const buttons = document.querySelectorAll(PROFILE_SELECTORS.HEADER_FRIEND_BUTTON);
		for (const button of buttons) {
			const text = button.textContent?.trim().toLowerCase() || '';
			if (text === 'add' || text.includes('add connection')) {
				return button as HTMLElement;
			}
		}
		return null;
	}

	// Get the active friend button (async version)
	async function getActiveFriendButton(): Promise<HTMLElement | null> {
		const result = await waitForElement(PROFILE_SELECTORS.HEADER_FRIEND_BUTTON);
		if (!result.success || !result.element) return null;
		return getActiveFriendButtonSync();
	}
</script>

<!-- Friend Warning Modal -->
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

<!-- Queue Modal Manager -->
<QueueModalManager bind:this={queueModalManager} onStatusRefresh={handleStatusRefresh} />

<!-- Outfit Viewer Modal -->
<OutfitViewerModal
	{flaggedOutfits}
	onClose={() => (outfitViewerOpen = false)}
	{userId}
	bind:isOpen={outfitViewerOpen}
/>

<!-- Carousel Manager -->
{#if showCarousel}
	<UserListManager
		onError={handleCarouselError}
		onUserProcessed={handleCarouselUserProcessed}
		pageType={PAGE_TYPES.FRIENDS_CAROUSEL}
		profileOwnerId={userId}
	/>
{/if}

<!-- Groups Showcase Manager -->
{#if showGroupsShowcase}
	<GroupListManager onError={handleGroupsShowcaseError} />
{/if}
