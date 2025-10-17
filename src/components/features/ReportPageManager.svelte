<script lang="ts">
	import { get } from 'svelte/store';
	import { settings } from '@/lib/stores/settings';
	import { authStore } from '@/lib/stores/auth';
	import { logger } from '@/lib/utils/logger';
	import { apiClient } from '@/lib/services/api-client';
	import { COMPONENT_CLASSES, USER_ACTIONS, REPORT_PAGE_SELECTORS } from '@/lib/types/constants';
	import { SETTINGS_KEYS } from '@/lib/types/settings';
	import type { UserStatus } from '@/lib/types/api';
	import ReportHelper from './ReportHelper.svelte';

	interface Props {
		userId: string;
		userStatus: UserStatus | null;
		onMount?: (cleanup: () => void) => void;
	}

	let { userId, userStatus, onMount }: Props = $props();

	// Component state
	let reportHelper: { element: HTMLElement; cleanup: () => void } | null = null;
	let successMessageElement: HTMLElement | null = null;
	let submitButtonListener: (() => void) | null = null;

	// Initialize components when mounted
	$effect(() => {
		void initialize();
		onMount?.(cleanup);

		return cleanup;
	});

	// Initialize report page components
	async function initialize() {
		try {
			// Setup submit button listener to log all reports
			setupSubmitButtonListener();

			await mountReportHelper();
			logger.debug('ReportPageManager initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize ReportPageManager:', error);
		}
	}

	// Setup submit button click listener
	function setupSubmitButtonListener(): void {
		try {
			const submitButton = document.querySelector(
				REPORT_PAGE_SELECTORS.SUBMIT_BUTTON
			) as HTMLButtonElement;

			if (!submitButton) {
				logger.warn('Submit button not found, will retry');
				// Retry after a delay
				setTimeout(() => {
					setupSubmitButtonListener();
				}, 500);
				return;
			}

			const handleSubmitClick = () => {
				void handleReportSubmit();
			};

			submitButton.addEventListener('click', handleSubmitClick);
			submitButtonListener = () => {
				submitButton.removeEventListener('click', handleSubmitClick);
			};

			logger.debug('Submit button listener attached');
		} catch (error) {
			logger.error('Failed to setup submit button listener:', error);
		}
	}

	// Handle report submission
	async function handleReportSubmit(): Promise<void> {
		if (!userId) {
			return;
		}

		// Only log reports if user is authenticated
		if (!$authStore.isAuthenticated) {
			logger.debug('User not authenticated, skipping report logging');
			return;
		}

		try {
			// Extract category from the dropdown
			const categoryElement = document.querySelector(
				`${REPORT_PAGE_SELECTORS.CATEGORY_BUTTON} .foundation-web-menu-item-title`
			);
			const category = categoryElement?.textContent?.trim() || 'Unknown Category';

			// Extract comment from the textarea
			const commentTextarea = document.querySelector(
				REPORT_PAGE_SELECTORS.COMMENT_TEXTAREA
			) as HTMLTextAreaElement;
			const comment = commentTextarea?.value?.trim() || '';

			// Build report reason
			let reportReason = `Category: ${category}`;
			if (comment) {
				reportReason += `\n\nComment: ${comment}`;
			}

			logger.userAction(USER_ACTIONS.REPORT_HELPER_AUTOFILL, {
				userId: userId,
				category: category
			});

			await apiClient.submitExtensionReport(parseInt(userId), reportReason);

			logger.debug('Extension report submitted successfully', {
				category,
				hasComment: !!comment
			});
		} catch (error) {
			logger.error('Failed to submit extension report:', error);
		}
	}

	// Check if user has profile violations (reason type 0)
	function hasUserProfileViolations(): boolean {
		if (!userStatus || !userStatus.reasons) {
			return false;
		}
		return '0' in userStatus.reasons;
	}

	// Find and validate required form elements
	function findFormElements(): {
		categoryButton: HTMLButtonElement;
		commentTextarea: HTMLTextAreaElement;
	} {
		const categoryButton = document.querySelector(
			REPORT_PAGE_SELECTORS.CATEGORY_BUTTON
		) as HTMLButtonElement;
		const commentTextarea = document.querySelector(
			REPORT_PAGE_SELECTORS.COMMENT_TEXTAREA
		) as HTMLTextAreaElement;

		if (!categoryButton || !commentTextarea) {
			logger.error('Could not find report form elements');
			throw new Error('Could not find report form elements');
		}

		return { categoryButton, commentTextarea };
	}

	// Wait for dropdown and select the Inappropriate Language category
	async function selectInappropriateLanguageCategory(): Promise<void> {
		try {
			// Wait for dropdown to open
			let attempts = 0;
			let isDropdownOpen = false;

			while (attempts < 10 && !isDropdownOpen) {
				await new Promise((resolve) => setTimeout(resolve, 100));
				const categoryButton = document.querySelector(
					REPORT_PAGE_SELECTORS.CATEGORY_BUTTON
				) as HTMLButtonElement;
				isDropdownOpen = categoryButton?.getAttribute('aria-expanded') === 'true';
				attempts++;
			}

			if (!isDropdownOpen) {
				logger.warn('Dropdown did not open after waiting');
				return;
			}

			// Find the Inappropriate Language option
			const inappropriateLanguageOption = Array.from(
				document.querySelectorAll(REPORT_PAGE_SELECTORS.DROPDOWN_OPTION)
			).find((option) => {
				const textElement = option.querySelector('span');
				return textElement?.textContent?.includes('Inappropriate Language');
			}) as HTMLElement;

			if (inappropriateLanguageOption) {
				inappropriateLanguageOption.click();
				logger.debug('Selected Inappropriate Language category');
			} else {
				logger.warn('Could not find Inappropriate Language category option');
			}
		} catch (error) {
			logger.error('Failed to select category:', error);
		}
	}

	// Mount report helper card on the page
	async function mountReportHelper(): Promise<void> {
		try {
			// Only show report helper if user has profile violations
			if (!userStatus || !hasUserProfileViolations()) {
				logger.debug('User has no profile violations, not showing report helper');
				return;
			}

			// Find the report form container
			const formContainer = document.querySelector(REPORT_PAGE_SELECTORS.FORM_CONTAINER);

			if (!formContainer) {
				logger.warn('Could not find report form container');
				return;
			}

			// Create container for report helper card
			const container = document.createElement('div');
			container.className = COMPONENT_CLASSES.REPORT_HELPER;

			// Insert before the form
			formContainer.parentNode?.insertBefore(container, formContainer);

			// Mount ReportHelper as a card
			if (userId) {
				const { mount } = await import('svelte');
				const component = mount(ReportHelper, {
					target: container,
					props: {
						isOpen: true,
						isCard: true,
						userId: userId,
						status: userStatus,
						onFillForm: handleFillForm,
						onClose: () => {}
					}
				});

				reportHelper = {
					element: container,
					cleanup: () => {
						if ('unmount' in component && typeof component.unmount === 'function') {
							(component as { unmount: () => void }).unmount();
						}
						container.remove();
					}
				};
			}

			logger.debug('Report helper card mounted');
		} catch (error) {
			logger.error('Failed to mount report helper:', error);
		}
	}

	// Handle fill form button click
	async function handleFillForm(): Promise<void> {
		try {
			logger.userAction(USER_ACTIONS.REPORT_HELPER_AUTOFILL, {
				userId: userId
			});

			// Find form elements
			const { categoryButton, commentTextarea } = findFormElements();

			// Focus and use Enter key to open dropdown
			categoryButton.focus();
			categoryButton.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Enter',
					bubbles: true
				})
			);

			// Wait for dropdown to appear and select appropriate category
			await selectInappropriateLanguageCategory();

			// Build comment text
			let commentText =
				"This user's profile contains inappropriate content that violates Roblox's Terms of Service.\n\n";

			// Get the profile violation reason
			const profileReason = userStatus?.reasons?.['0'];

			if (profileReason?.message) {
				commentText += `Detected Issue:\n${profileReason.message}\n\n`;
			}

			// Add evidence if advanced info is enabled
			const currentSettings = get(settings);
			if (
				currentSettings[SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED] &&
				profileReason?.evidence
			) {
				commentText += 'Evidence Snippets:\n';
				profileReason.evidence.forEach((snippet: string, index: number) => {
					commentText += `${index + 1}. ${snippet}\n`;
				});
			}

			// Set comment text
			commentTextarea.value = commentText;

			// Trigger input and change events
			commentTextarea.dispatchEvent(new Event('input', { bubbles: true }));
			commentTextarea.dispatchEvent(new Event('change', { bubbles: true }));

			// Scroll form into view
			commentTextarea.scrollIntoView({
				behavior: 'smooth',
				block: 'center'
			});

			// Show success message
			showSuccessMessage();

			logger.debug('Report form filled successfully');
		} catch (error) {
			logger.error('Failed to fill form:', error);
			throw error;
		}
	}

	// Show success message below the form
	function showSuccessMessage(): void {
		try {
			// Remove any existing success message
			if (successMessageElement) {
				successMessageElement.remove();
				successMessageElement = null;
			}

			// Find the footer section
			const footer = document.querySelector(REPORT_PAGE_SELECTORS.FOOTER);
			if (!footer || !footer.parentNode) {
				logger.warn('Could not find footer to insert success message');
				return;
			}

			// Create success message element
			successMessageElement = document.createElement('div');
			successMessageElement.className = COMPONENT_CLASSES.REPORT_HELPER_SUCCESS_MESSAGE;
			successMessageElement.textContent =
				'Form filled successfully! Category and comment have been set. Review and submit when ready.';

			// Insert after footer
			footer.parentNode.insertBefore(successMessageElement, footer.nextSibling);

			// Remove after 5 seconds
			setTimeout(() => {
				if (successMessageElement) {
					successMessageElement.remove();
					successMessageElement = null;
				}
			}, 5000);
		} catch (error) {
			logger.error('Failed to show success message:', error);
		}
	}

	// Cleanup resources
	function cleanup() {
		try {
			// Cleanup submit button listener
			if (submitButtonListener) {
				submitButtonListener();
				submitButtonListener = null;
			}

			// Cleanup report helper
			if (reportHelper) {
				reportHelper.cleanup();
				reportHelper = null;
			}

			// Cleanup success message
			if (successMessageElement) {
				successMessageElement.remove();
				successMessageElement = null;
			}

			logger.debug('ReportPageManager cleanup completed');
		} catch (error) {
			logger.error('Failed to cleanup ReportPageManager:', error);
		}
	}
</script>
