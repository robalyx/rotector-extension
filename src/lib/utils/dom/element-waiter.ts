import { logger } from '../logging/logger';
import { logElementWaitResult } from '../logging/perf-tracer';
import { RETRY_CONFIG } from '../../types/constants';

interface WaitForElementOptions {
	maxRetries?: number;
	baseDelay?: number;
	backoffMultiplier?: number;
	maxDelay?: number;
	onRetry?: (attempt: number, delay: number) => void;
}

// Wait for an element to appear in the DOM with exponential backoff retry
export async function waitForElement(
	selector: string,
	options: WaitForElementOptions = {}
): Promise<{ element: HTMLElement | null; attempts: number; totalTime: number; success: boolean }> {
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

		const element = document.querySelector<HTMLElement>(selector);
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

			const result = {
				element,
				attempts: attempt,
				totalTime,
				success: true
			};
			logElementWaitResult(selector, result);
			return result;
		}

		const elapsed = Date.now() - startTime;
		logger.debug(`Element not found, retrying: ${selector}`, {
			attempt,
			nextDelay: currentDelay,
			elapsed
		});

		onRetry?.(attempt, currentDelay);

		await new Promise((resolve) => setTimeout(resolve, currentDelay));

		currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
	}

	const totalTime = Date.now() - startTime;
	logger.warn(`Element search failed after max retries: ${selector}`, {
		maxRetries,
		totalTime,
		finalDelay: currentDelay
	});

	const result = {
		element: null,
		attempts: attempt,
		totalTime,
		success: false
	};
	logElementWaitResult(selector, result);
	return result;
}
