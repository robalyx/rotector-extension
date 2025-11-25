<script lang="ts">
	import { get } from 'svelte/store';
	import { _ } from 'svelte-i18n';
	import { settings } from '@/lib/stores/settings';
	import { authStore } from '@/lib/stores/auth';
	import { logger } from '@/lib/utils/logger';
	import { apiClient } from '@/lib/services/api-client';
	import { waitForElement } from '@/lib/utils/element-waiter';
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

	// Read violation info setting
	const advancedInfoEnabled = get(settings)[SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED] ?? false;

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
			void setupSubmitButtonListener();

			await mountReportHelper();
			logger.debug('ReportPageManager initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize ReportPageManager:', error);
		}
	}

	// Setup submit button click listener
	async function setupSubmitButtonListener(): Promise<void> {
		try {
			const { element: submitButton, success } = await waitForElement<HTMLButtonElement>(
				REPORT_PAGE_SELECTORS.SUBMIT_BUTTON
			);

			if (!success || !submitButton) {
				logger.debug('Submit button not found after retries, skipping listener setup');
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
			const categoryElement = document.querySelector(REPORT_PAGE_SELECTORS.CATEGORY_SELECTED_TEXT);
			const category =
				categoryElement?.textContent?.trim() || $_('report_page_manager_unknown_category');

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

			const id = Number.parseInt(userId, 10);
			if (!Number.isFinite(id)) {
				throw new Error('Invalid userId');
			}
			await apiClient.submitExtensionReport(id, reportReason);

			logger.debug('Extension report submitted successfully', {
				category,
				hasComment: !!comment
			});
		} catch (error) {
			logger.error('Failed to submit extension report:', error);
		}
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
			// Show report helper if user is reportable
			if (!userStatus?.isReportable) {
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

			// Mount ReportHelper card
			if (userId) {
				const { mount } = await import('svelte');
				const component = mount(ReportHelper, {
					target: container,
					props: {
						status: userStatus,
						onFillForm: handleFillForm,
						advancedInfoEnabled
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
		// Build comment text
		let commentText =
			"This user's profile contains inappropriate content that violates Roblox's Terms of Service.\n\n";

		const profileReason = userStatus?.reasons?.['User Profile'];

		if (profileReason?.message) {
			commentText += 'Detected Issue:\n' + profileReason.message + '\n\n';
		}

		// Add evidence if advanced info is enabled
		const currentSettings = get(settings);
		if (currentSettings[SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED] && profileReason?.evidence) {
			commentText += 'Evidence Snippets:\n';
			profileReason.evidence.forEach((snippet: string, index: number) => {
				commentText += `${index + 1}. ${snippet}\n`;
			});
		}

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

			// Set comment text
			commentTextarea.value = commentText;

			// Trigger input and change events
			commentTextarea.dispatchEvent(new Event('input', { bubbles: true }));
			commentTextarea.dispatchEvent(new Event('change', { bubbles: true }));

			// Validate that the form was filled correctly
			const categoryElement = document.querySelector(REPORT_PAGE_SELECTORS.CATEGORY_SELECTED_TEXT);
			const categoryText = categoryElement?.textContent?.trim() || '';
			const isCategorySet = categoryText.includes('Inappropriate Language');
			const isTextareaSet = commentTextarea.value === commentText;

			if (!isCategorySet || !isTextareaSet) {
				throw new Error('Form validation failed');
			}

			// Scroll form into view
			commentTextarea.scrollIntoView({
				behavior: 'smooth',
				block: 'center'
			});

			// Show success message
			showMessage('success', $_('report_page_manager_success_message'));

			logger.debug('Report form filled successfully');
		} catch (error) {
			logger.error('Auto-fill failed, using clipboard fallback:', error);

			logger.userAction(USER_ACTIONS.REPORT_HELPER_AUTOFILL_FAILED, {
				userId: userId,
				error: error instanceof Error ? error.message : 'Unknown error'
			});

			// Copy to clipboard as fallback
			try {
				await navigator.clipboard.writeText(commentText);
				showMessage('error', $_('report_page_manager_autofill_failed_clipboard'));
			} catch (clipboardError) {
				logger.error('Clipboard copy failed:', clipboardError);
				showMessage('error', $_('report_page_manager_autofill_failed'));
			}
		}
	}

	// Show message below the form
	function showMessage(type: 'success' | 'error', message: string): void {
		try {
			// Remove any existing message
			if (successMessageElement) {
				successMessageElement.remove();
				successMessageElement = null;
			}

			// Find the footer section
			const footer = document.querySelector(REPORT_PAGE_SELECTORS.FOOTER);
			if (!footer || !footer.parentNode) {
				logger.warn('Could not find footer to insert message');
				return;
			}

			// Create message element
			successMessageElement = document.createElement('div');
			successMessageElement.className = `${COMPONENT_CLASSES.REPORT_HELPER_SUCCESS_MESSAGE}${type === 'error' ? ' error' : ''}`;
			successMessageElement.textContent = message;

			// Insert after footer
			footer.parentNode.insertBefore(successMessageElement, footer.nextSibling);

			// Remove after timeout (longer for errors)
			setTimeout(
				() => {
					if (successMessageElement) {
						successMessageElement.remove();
						successMessageElement = null;
					}
				},
				type === 'error' ? 8000 : 5000
			);
		} catch (error) {
			logger.error('Failed to show message:', error);
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
