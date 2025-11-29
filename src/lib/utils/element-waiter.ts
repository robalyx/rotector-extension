import { logger } from './logger';
import { RETRY_CONFIG } from '../types/constants';

interface WaitForElementOptions {
	maxRetries?: number;
	baseDelay?: number;
	backoffMultiplier?: number;
	maxDelay?: number;
	onRetry?: (attempt: number, delay: number) => void;
}

interface ElementWaiterResult<T = HTMLElement> {
	element: T | null;
	attempts: number;
	totalTime: number;
	success: boolean;
}

// Wait for an element to appear in the DOM with exponential backoff retry
export async function waitForElement<T extends HTMLElement = HTMLElement>(
	selector: string,
	options: WaitForElementOptions = {}
): Promise<ElementWaiterResult<T>> {
	const {
		maxRetries = RETRY_CONFIG.MAX_RETRIES,
		baseDelay = RETRY_CONFIG.BASE_DELAY,
		backoffMultiplier = RETRY_CONFIG.BACKOFF_MULTIPLIER,
		maxDelay = RETRY_CONFIG.MAX_DELAY,
		onRetry
	} = options;

	const startTime = Date.now();
	let attempt = 0;
	let currentDelay = baseDelay;

	logger.debug(`Starting element search for: ${selector}`, {
		maxRetries,
		baseDelay
	});

	while (attempt < maxRetries) {
		attempt++;

		// Check if element exists
		const element = document.querySelector<T>(selector);
		if (element) {
			const totalTime = Date.now() - startTime;
			logger.debug(`Element found: ${selector}`, {
				attempt,
				totalTime,
				element: {
					tagName: element.tagName,
					className: element.className,
					id: element.id
				}
			});

			return {
				element,
				attempts: attempt,
				totalTime,
				success: true
			};
		}

		// Log retry attempt
		const elapsed = Date.now() - startTime;
		logger.debug(`Element not found, retrying: ${selector}`, {
			attempt,
			nextDelay: currentDelay,
			elapsed
		});

		// Call retry callback
		onRetry?.(attempt, currentDelay);

		// Wait before next attempt
		await new Promise((resolve) => setTimeout(resolve, currentDelay));

		// Calculate next delay with exponential backoff
		currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
	}

	// Max retries exceeded
	const totalTime = Date.now() - startTime;
	logger.warn(`Element search failed after max retries: ${selector}`, {
		maxRetries,
		totalTime,
		finalDelay: currentDelay
	});

	return {
		element: null,
		attempts: attempt,
		totalTime,
		success: false
	};
}

// Wait for all items in a container to be ready (e.g., have href attributes populated)
export async function waitForAllItems<T extends HTMLElement = HTMLElement>(
	containerSelector: string,
	itemSelector: string,
	readyItemSelector: string,
	options: WaitForElementOptions = {}
): Promise<ElementWaiterResult<T>> {
	const {
		maxRetries = RETRY_CONFIG.MAX_RETRIES,
		baseDelay = RETRY_CONFIG.BASE_DELAY,
		backoffMultiplier = RETRY_CONFIG.BACKOFF_MULTIPLIER,
		maxDelay = RETRY_CONFIG.MAX_DELAY,
		onRetry
	} = options;

	const startTime = Date.now();
	let attempt = 0;
	let currentDelay = baseDelay;

	logger.debug(`Waiting for all items ready: ${containerSelector}`, {
		itemSelector,
		readyItemSelector,
		maxRetries,
		baseDelay
	});

	while (attempt < maxRetries) {
		attempt++;

		const container = document.querySelector<T>(containerSelector);
		if (container) {
			const totalItems = container.querySelectorAll(itemSelector);
			const readyItems = container.querySelectorAll(readyItemSelector);

			if (totalItems.length > 0 && totalItems.length === readyItems.length) {
				const totalTime = Date.now() - startTime;
				logger.debug(`All items ready: ${containerSelector}`, {
					attempt,
					totalTime,
					itemCount: totalItems.length
				});

				return {
					element: container,
					attempts: attempt,
					totalTime,
					success: true
				};
			}

			logger.debug(`Items not ready, retrying: ${containerSelector}`, {
				attempt,
				totalItems: totalItems.length,
				readyItems: readyItems.length,
				nextDelay: currentDelay
			});
		}

		onRetry?.(attempt, currentDelay);
		await new Promise((resolve) => setTimeout(resolve, currentDelay));
		currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
	}

	const totalTime = Date.now() - startTime;
	logger.warn(`waitForAllItems failed after max retries: ${containerSelector}`, {
		maxRetries,
		totalTime
	});

	return {
		element: null,
		attempts: attempt,
		totalTime,
		success: false
	};
}
