import { logger } from './logger';
import { RETRY_CONFIG } from '../types/constants';

interface WaitForElementOptions {
  maxRetries?: number;
  baseDelay?: number;
  backoffMultiplier?: number;
  maxDelay?: number;
  timeout?: number;
  onRetry?: (attempt: number, delay: number) => void;
  onTimeout?: () => void;
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
    timeout = RETRY_CONFIG.TIMEOUT,
    onRetry,
    onTimeout
  } = options;

  const startTime = Date.now();
  let attempt = 0;
  let currentDelay = baseDelay;

  logger.debug(`Starting element search for: ${selector}`, {
    maxRetries,
    baseDelay,
    timeout
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

    // Check timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= timeout) {
      logger.warn(`Element search timed out: ${selector}`, {
        attempts: attempt,
        totalTime: elapsed,
        timeout
      });
      
      onTimeout?.();
      return {
        element: null,
        attempts: attempt,
        totalTime: elapsed,
        success: false
      };
    }

    // Log retry attempt
    logger.debug(`Element not found, retrying: ${selector}`, {
      attempt,
      nextDelay: currentDelay,
      elapsed
    });

    // Call retry callback
    onRetry?.(attempt, currentDelay);

    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, currentDelay));

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
