<script lang="ts">
	import { get } from 'svelte/store';
	import { mount } from 'svelte';
	import { settings } from '@/lib/stores/settings';
	import { logger } from '@/lib/utils/logger';
	import { waitForElement } from '@/lib/utils/element-waiter';
	import {
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
	import { queryUserProgressive } from '@/lib/services/unified-query-service';
	import { markProfileElementsForBlur, revealProfileElements } from '@/lib/services/blur-service';
	import { isFlagged } from '@/lib/utils/status-utils';
	import StatusIndicator from '../status/StatusIndicator.svelte';
	import FriendWarning from './FriendWarning.svelte';
	import QueueModalManager from './QueueModalManager.svelte';
	import type { QueueModalManagerInstance } from '@/lib/types/components';
	import UserListManager from './UserListManager.svelte';
	import GroupListManager from './GroupListManager.svelte';

	interface Props {
		userId: string;
	}

	let { userId }: Props = $props();

	// Status state owned by this component
	let userStatus = $state<CombinedStatus | null>(null);

	// Check if user is flagged by any API
	const userIsFlagged = $derived(() => isFlagged(userStatus));

	// Component state
	let friendWarningOpen = $state(false);
	let showCarousel = $state(false);
	let showGroupsShowcase = $state(false);
	let profileElementsReady = $state(false);

	// Component references
	let queueModalManager: QueueModalManagerInstance | undefined;
	let statusContainer: HTMLElement | null = null;
	let friendButtonHandler: ((event: Event) => void) | null = null;
	let mountedComponents = $state(new Map<string, { unmount?: () => void }>());
	let cancelQuery: (() => void) | null = null;

	// Fetch status progressively
	$effect(() => {
		cancelQuery = queryUserProgressive(userId, (status) => {
			userStatus = status;
			revealProfileElements(status);
		});

		return () => cancelQuery?.();
	});

	// Mark profile elements for blur tracking
	$effect(() => {
		if (!profileElementsReady) return;
		markProfileElementsForBlur(userId);
	});

	// Initialize components when mounted
	$effect(() => {
		void initialize();

		return cleanup;
	});

	// Initialize profile components
	async function initialize() {
		try {
			await Promise.all([
				setupStatusIndicator(),
				setupFriendWarning(),
				setupCarousel(),
				setupGroupsShowcase()
			]);

			profileElementsReady = true;

			logger.debug('ProfilePageManager initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize ProfilePageManager:', error);
		}
	}

	// Set up status indicator in profile header
	async function setupStatusIndicator() {
		try {
			// Detect which header version is active
			const headerVersion = detectHeaderVersion();
			logger.debug('Detected header version:', headerVersion);

			let titleContainer: Element | null = null;

			if (headerVersion === 'redesigned') {
				// Wait for redesigned header title
				const titleResult = await waitForElement(PROFILE_SELECTORS.REDESIGNED_TITLE);

				if (!titleResult.success || !titleResult.element) {
					logger.warn('Could not find redesigned header title container');
					return;
				}

				// The status indicator should be injected after the title span
				// Find the parent wrapper that contains the title
				titleContainer = titleResult.element.parentElement;

				if (!titleContainer) {
					logger.warn('Could not find parent container for redesigned title');
					return;
				}
			} else {
				// Wait for legacy profile header title container
				const titleResult = await waitForElement(
					`${PROFILE_SELECTORS.TITLE_CONTAINER}, ${PROFILE_SELECTORS.PROFILE_HEADER}, .profile-header-title-container`
				);

				if (!titleResult.success || !titleResult.element) {
					logger.warn('Could not find legacy profile header title container');
					return;
				}

				titleContainer = titleResult.element;
			}

			// Check if container already exists, reuse it
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

			logger.debug('Status indicator container set up and component mounted', { headerVersion });
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
					onQueue: handleQueueUser
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
			if (!userIsFlagged()) return;

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

			// Wait for groups section
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

	// Handle status indicator click
	function handleStatusClick(clickedUserId: string) {
		logger.userAction(USER_ACTIONS.STATUS_CLICKED, { userId: clickedUserId });
	}

	// Handle queue user request
	function handleQueueUser(clickedUserId: string, isReprocess = false, status?: UserStatus | null) {
		logger.userAction(USER_ACTIONS.QUEUE_REQUESTED, { userId: clickedUserId, isReprocess });
		queueModalManager?.showQueue(clickedUserId, isReprocess, status);
	}

	// Refresh status after queue completion
	function handleStatusRefresh() {
		cancelQuery?.();
		cancelQuery = queryUserProgressive(userId, (status) => {
			userStatus = status;
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
			const moreButton = document.querySelector(PROFILE_SELECTORS.DROPDOWN);

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
			// Clean up friend button event listener
			const friendButton = getActiveFriendButtonSync();

			if (friendButton && friendButtonHandler) {
				friendButton.removeEventListener('click', friendButtonHandler, true);
				friendButtonHandler = null;
			}

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

	// Detect which header version is active
	function detectHeaderVersion(): 'legacy' | 'redesigned' {
		const redesignedHeader = document.querySelector(PROFILE_SELECTORS.REDESIGNED_HEADER);
		const legacyHeader = document.querySelector(PROFILE_SELECTORS.LEGACY_HEADER);

		// Check if redesigned header exists and is visible
		if (
			redesignedHeader instanceof HTMLElement &&
			redesignedHeader.style.display !== 'none' &&
			redesignedHeader.offsetParent !== null
		) {
			return 'redesigned';
		}

		// Check if legacy header exists and is visible
		if (
			legacyHeader instanceof HTMLElement &&
			legacyHeader.style.display !== 'none' &&
			legacyHeader.offsetParent !== null
		) {
			return 'legacy';
		}

		// Default to legacy if we can't determine
		logger.warn('Could not detect header version, defaulting to legacy');
		return 'legacy';
	}

	// Get the active friend button
	async function getActiveFriendButton(): Promise<HTMLElement | null> {
		const headerVersion = detectHeaderVersion();

		if (headerVersion === 'redesigned') {
			// Wait for redesigned friend button
			const result = await waitForElement(PROFILE_SELECTORS.REDESIGNED_FRIEND_BUTTON);

			if (!result.success || !result.element) return null;

			// Find the button that contains "Add" text
			const buttons = document.querySelectorAll(PROFILE_SELECTORS.REDESIGNED_FRIEND_BUTTON);
			for (const button of buttons) {
				const text = button.textContent?.trim().toLowerCase() || '';
				if (text === 'add' || text.includes('add connection')) {
					return button as HTMLElement;
				}
			}

			return null;
		} else {
			// Wait for legacy friend button
			const result = await waitForElement('#friend-button');
			return result.success && result.element ? result.element : null;
		}
	}

	// Get the active friend button (sync version for clicks and cleanup)
	function getActiveFriendButtonSync(): HTMLElement | null {
		const headerVersion = detectHeaderVersion();

		if (headerVersion === 'redesigned') {
			// Find the redesigned friend button
			const buttons = document.querySelectorAll(PROFILE_SELECTORS.REDESIGNED_FRIEND_BUTTON);
			for (const button of buttons) {
				const text = button.textContent?.trim().toLowerCase() || '';
				if (text === 'add' || text.includes('add connection')) {
					return button as HTMLElement;
				}
			}

			return null;
		} else {
			// Find the legacy friend button
			const button = document.querySelector('#friend-button');
			return button instanceof HTMLElement ? button : null;
		}
	}
</script>

<!-- Friend Warning Modal -->
{#if userIsFlagged()}
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
