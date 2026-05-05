<script lang="ts">
	import { get } from 'svelte/store';
	import { settings } from '@/lib/stores/settings';
	import { asApiError } from '@/lib/utils/api/api-error';
	import { logger } from '@/lib/utils/logging/logger';
	import { waitForElement } from '@/lib/utils/dom/element-waiter';
	import { COMPONENT_CLASSES, REASON_KEYS, USER_ACTIONS } from '@/lib/types/constants';
	import { REPORT_PAGE_SELECTORS } from '@/lib/controllers/selectors/report';
	import { SETTINGS_KEYS } from '@/lib/types/settings';
	import type { UserStatus } from '@/lib/types/api';
	import ReportHelper from './ReportHelper.svelte';

	const REPORT_CATEGORY = 'Inappropriate Language';

	interface Props {
		userId: string;
		userStatus: UserStatus | null;
	}

	let { userId, userStatus }: Props = $props();

	let reportHelper: { element: HTMLElement; cleanup: () => void } | null = null;
	let pendingObserver: MutationObserver | null = null;
	let pendingTimeout: ReturnType<typeof setTimeout> | undefined;

	const advancedInfoEnabled = get(settings)[SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED];

	$effect(() => {
		void mountReportHelper();
		return cleanup;
	});

	// Resolves true when the listbox reaches data-state=open or false after a 3 second timeout
	function waitForDropdown(listboxId: string): Promise<boolean> {
		const selector = `#${CSS.escape(listboxId)}`;

		return new Promise((resolve) => {
			const existing = document.querySelector(selector);
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
				const listbox = document.querySelector(selector);
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

	// Waits for the rendered dropdown to open then clicks the matching option by its text
	async function selectInappropriateLanguageCategory(
		categoryButton: HTMLButtonElement
	): Promise<void> {
		const listboxId = categoryButton.getAttribute('aria-controls');
		if (!listboxId) {
			logger.warn('Category combobox missing aria-controls');
			return;
		}

		const isOpen = await waitForDropdown(listboxId);
		if (!isOpen) {
			logger.warn('Dropdown did not open after waiting');
			return;
		}

		const option = Array.from(
			document.querySelectorAll<HTMLElement>(REPORT_PAGE_SELECTORS.DROPDOWN_OPTION)
		).find((el) => {
			const text = el.querySelector(REPORT_PAGE_SELECTORS.DROPDOWN_OPTION_TEXT);
			return text?.textContent.includes(REPORT_CATEGORY);
		});

		if (option) {
			option.click();
		} else {
			logger.warn('Could not find Inappropriate Language category option');
		}
	}

	async function mountReportHelper(): Promise<void> {
		const { element: innerForm, success } = await waitForElement(REPORT_PAGE_SELECTORS.INNER_FORM);
		if (!success || !innerForm) return;

		const container = document.createElement('div');
		container.className = COMPONENT_CLASSES.REPORT_HELPER;
		innerForm.insertBefore(container, innerForm.firstChild);

		const { mount, unmount } = await import('svelte');
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
				void unmount(component);
				container.remove();
			}
		};
	}

	// Drives Roblox's form via synthetic events and falls back to copying the comment to clipboard if validation fails
	async function handleFillForm(): Promise<void> {
		let commentText =
			"This user's profile contains inappropriate content that violates Roblox's Terms of Service.\n\n";

		const profileReason = userStatus?.reasons[REASON_KEYS.USER_PROFILE];

		if (profileReason?.message) {
			commentText += 'Detected Issue:\n' + profileReason.message + '\n\n';
		}

		const currentSettings = get(settings);
		if (currentSettings[SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED] && profileReason?.evidence) {
			commentText += 'Evidence Snippets:\n';
			profileReason.evidence.forEach((snippet: string, index: number) => {
				commentText += `${String(index + 1)}. ${snippet}\n`;
			});
		}

		try {
			logger.userAction(USER_ACTIONS.REPORT_HELPER_AUTOFILL, { userId });

			const categoryButton = document.querySelector<HTMLButtonElement>(
				REPORT_PAGE_SELECTORS.CATEGORY_BUTTON
			);
			const commentTextarea = document.querySelector<HTMLTextAreaElement>(
				REPORT_PAGE_SELECTORS.COMMENT_TEXTAREA
			);
			if (!categoryButton || !commentTextarea) {
				throw new Error('Report form elements not found');
			}

			categoryButton.dispatchEvent(
				new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
			);
			await selectInappropriateLanguageCategory(categoryButton);

			commentTextarea.value = commentText;
			commentTextarea.dispatchEvent(new Event('input', { bubbles: true }));
			commentTextarea.dispatchEvent(new Event('change', { bubbles: true }));

			await new Promise((r) => requestAnimationFrame(r));

			const categoryText = categoryButton.textContent.trim();

			if (!categoryText.includes(REPORT_CATEGORY) || commentTextarea.value !== commentText) {
				throw new Error('Form validation failed');
			}

			commentTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
		} catch (error) {
			logger.error('Auto-fill failed, using clipboard fallback:', error);

			logger.userAction(USER_ACTIONS.REPORT_HELPER_AUTOFILL_FAILED, {
				userId,
				error: asApiError(error).message
			});

			try {
				await navigator.clipboard.writeText(commentText);
			} catch (clipboardError) {
				logger.error('Clipboard copy failed:', clipboardError);
			}

			throw error;
		}
	}

	function cleanup() {
		clearTimeout(pendingTimeout);
		pendingObserver?.disconnect();
		reportHelper?.cleanup();
	}
</script>
