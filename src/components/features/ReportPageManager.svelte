<script lang="ts">
	import { get } from 'svelte/store';
	import { settings } from '@/lib/stores/settings';
	import { logger } from '@/lib/utils/logger';
	import { apiClient } from '@/lib/services/api-client';
	import { sanitizeEntityId } from '@/lib/utils/sanitizer';
	import { waitForElement } from '@/lib/utils/element-waiter';
	import { COMPONENT_CLASSES, USER_ACTIONS, REPORT_PAGE_SELECTORS } from '@/lib/types/constants';
	import { SETTINGS_KEYS } from '@/lib/types/settings';
	import type { UserStatus } from '@/lib/types/api';
	import ReportHelper from './ReportHelper.svelte';

	const REPORT_CATEGORY = 'Inappropriate Language';

	interface Props {
		userId: string;
		userStatus: UserStatus | null;
		onMount?: (cleanup: () => void) => void;
	}

	let { userId, userStatus, onMount }: Props = $props();

	// Component state
	let reportHelper: { element: HTMLElement; cleanup: () => void } | null = null;
	let submitButtonListener: (() => void) | null = null;
	let pendingObserver: MutationObserver | null = null;
	let pendingTimeout: ReturnType<typeof setTimeout> | undefined;

	// Read violation info setting
	const advancedInfoEnabled = get(settings)[SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED] ?? false;

	// Lifecycle
	$effect(() => {
		void initialize();
		onMount?.(cleanup);
		return cleanup;
	});

	// Initialize report page components
	async function initialize() {
		// Setup submit button listener to log all reports
		void setupSubmitButtonListener();
		await mountReportHelper();
	}

	// Submit button listener for logging all reports
	async function setupSubmitButtonListener(): Promise<void> {
		const { element: submitButton, success } = await waitForElement<HTMLButtonElement>(
			REPORT_PAGE_SELECTORS.SUBMIT_BUTTON
		);
		if (!success || !submitButton) return;

		const handleSubmitClick = () => {
			handleReportSubmit().catch((err) => {
				logger.error('Report submission logging failed:', err);
			});
		};

		submitButton.addEventListener('click', handleSubmitClick);
		submitButtonListener = () => {
			submitButton.removeEventListener('click', handleSubmitClick);
		};
	}

	// Report submission logging
	async function handleReportSubmit(): Promise<void> {
		const categoryElement = document.querySelector(REPORT_PAGE_SELECTORS.CATEGORY_SELECTED_TEXT);
		const category = categoryElement?.textContent?.trim() || '';

		const commentTextarea = document.querySelector(
			REPORT_PAGE_SELECTORS.COMMENT_TEXTAREA
		) as HTMLTextAreaElement;
		const comment = commentTextarea?.value?.trim() || '';

		let reportReason = `Category: ${category}`;
		if (comment) {
			reportReason += `\n\nComment: ${comment}`;
		}

		logger.userAction(USER_ACTIONS.REPORT_HELPER_SUBMIT, {
			userId,
			category
		});

		const id = sanitizeEntityId(userId);
		if (!id) throw new Error(`Invalid userId: ${userId}`);

		await apiClient.submitExtensionReport(Number(id), reportReason);
	}

	// Form element lookup
	function findFormElements() {
		const categoryButton = document.querySelector(
			REPORT_PAGE_SELECTORS.CATEGORY_BUTTON
		) as HTMLButtonElement;
		const commentTextarea = document.querySelector(
			REPORT_PAGE_SELECTORS.COMMENT_TEXTAREA
		) as HTMLTextAreaElement;

		if (!categoryButton || !commentTextarea) {
			throw new Error('Report form elements not found');
		}

		return { categoryButton, commentTextarea };
	}

	// Dropdown appearance detection via MutationObserver
	function waitForDropdown(): Promise<boolean> {
		return new Promise((resolve) => {
			const existing = document.querySelector(REPORT_PAGE_SELECTORS.DROPDOWN_LISTBOX);
			if (existing?.getAttribute('data-state') === 'open') {
				resolve(true);
				return;
			}

			pendingTimeout = setTimeout(() => {
				pendingObserver?.disconnect();
				pendingObserver = null;
				resolve(false);
			}, 3000);

			pendingObserver = new MutationObserver(() => {
				const listbox = document.querySelector(REPORT_PAGE_SELECTORS.DROPDOWN_LISTBOX);
				if (listbox?.getAttribute('data-state') === 'open') {
					clearTimeout(pendingTimeout);
					pendingObserver?.disconnect();
					pendingObserver = null;
					resolve(true);
				}
			});

			pendingObserver.observe(document.body, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['data-state']
			});
		});
	}

	// Category selection in Roblox's Radix dropdown
	async function selectInappropriateLanguageCategory(): Promise<void> {
		const isOpen = await waitForDropdown();
		if (!isOpen) {
			logger.warn('Dropdown did not open after waiting');
			return;
		}

		const option = Array.from(
			document.querySelectorAll(REPORT_PAGE_SELECTORS.DROPDOWN_OPTION)
		).find((el) => {
			const text = el.querySelector(REPORT_PAGE_SELECTORS.DROPDOWN_OPTION_TEXT);
			return text?.textContent?.includes(REPORT_CATEGORY);
		}) as HTMLElement | undefined;

		if (option) {
			option.click();
		} else {
			logger.warn('Could not find Inappropriate Language category option');
		}
	}

	// Report helper bar mount
	async function mountReportHelper(): Promise<void> {
		const innerForm = document.querySelector(REPORT_PAGE_SELECTORS.INNER_FORM);
		if (!innerForm) {
			logger.warn('Inner form container not found');
			return;
		}

		const container = document.createElement('div');
		container.className = COMPONENT_CLASSES.REPORT_HELPER;
		innerForm.insertBefore(container, innerForm.firstChild);

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

	// Auto-fill handler
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
			logger.userAction(USER_ACTIONS.REPORT_HELPER_AUTOFILL, { userId });

			// Find form elements
			const { categoryButton, commentTextarea } = findFormElements();

			// Open Radix dropdown
			categoryButton.click();
			await selectInappropriateLanguageCategory();

			// Fill comment textarea
			commentTextarea.value = commentText;
			commentTextarea.dispatchEvent(new Event('input', { bubbles: true }));
			commentTextarea.dispatchEvent(new Event('change', { bubbles: true }));

			// Validate form state
			const categoryElement = document.querySelector(REPORT_PAGE_SELECTORS.CATEGORY_SELECTED_TEXT);
			const categoryText = categoryElement?.textContent?.trim() || '';

			if (!categoryText.includes(REPORT_CATEGORY) || commentTextarea.value !== commentText) {
				throw new Error('Form validation failed');
			}

			// Scroll form into view
			commentTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
		} catch (error) {
			logger.error('Auto-fill failed, using clipboard fallback:', error);

			logger.userAction(USER_ACTIONS.REPORT_HELPER_AUTOFILL_FAILED, {
				userId,
				error: error instanceof Error ? error.message : 'Unknown error'
			});

			// Clipboard fallback for manual paste
			try {
				await navigator.clipboard.writeText(commentText);
			} catch (clipboardError) {
				logger.error('Clipboard copy failed:', clipboardError);
			}

			throw error;
		}
	}

	// Resource cleanup
	function cleanup() {
		// Observer cleanup
		clearTimeout(pendingTimeout);
		pendingObserver?.disconnect();
		pendingObserver = null;

		// Submit button listener
		submitButtonListener?.();
		submitButtonListener = null;

		// Report helper component
		reportHelper?.cleanup();
		reportHelper = null;
	}
</script>
