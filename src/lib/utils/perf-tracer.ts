import { LOG_SOURCES, type LogSource } from '../types/developer-logs';
import { TRACE_CATEGORIES, type TraceCategory } from '../types/performance';
import { addPerformanceEntry } from '../stores/performance';

// Re-export for backward compatibility
export { TRACE_CATEGORIES, type TraceCategory };

const IS_DEV = import.meta.env.USE_DEV_API === 'true';
const MAX_DATA_LENGTH = 500;

interface TraceData {
	category: TraceCategory;
	operation: string;
	duration: number;
	success?: boolean;
	[key: string]: unknown;
}

function getLogSource(): LogSource {
	if (typeof document === 'undefined') {
		return LOG_SOURCES.BACKGROUND;
	}

	if (window.location?.hostname?.includes('roblox.com')) {
		return LOG_SOURCES.CONTENT;
	}

	return LOG_SOURCES.POPUP;
}

function serializeMetadata(data: Record<string, unknown>): Record<string, unknown> | undefined {
	if (Object.keys(data).length === 0) return undefined;

	try {
		const json = JSON.stringify(data);
		if (json.length > MAX_DATA_LENGTH) {
			return { _truncated: true, preview: `${json.slice(0, MAX_DATA_LENGTH)}...` };
		}
		return data;
	} catch {
		return { _error: 'Data not serializable' };
	}
}

function logTrace(data: TraceData): void {
	if (!IS_DEV) return;

	const source = getLogSource();
	const pageUrl = source === LOG_SOURCES.CONTENT ? window.location.href : undefined;
	const { category, operation, duration, success = true, ...rest } = data;

	addPerformanceEntry({
		timestamp: Date.now(),
		category,
		operation,
		duration,
		success,
		source,
		pageUrl,
		metadata: serializeMetadata(rest)
	}).catch(() => {
		// Silently fail to prevent logging loops
	});
}

/**
 * Starts a trace and returns a function to end it
 */
export function startTrace(
	category: TraceCategory,
	operation: string,
	metadata?: Record<string, unknown>
): (additionalData?: Record<string, unknown>) => void {
	if (!IS_DEV) return () => {};

	const start = performance.now();

	return (additionalData?: Record<string, unknown>) => {
		const duration = performance.now() - start;
		logTrace({
			category,
			operation,
			duration,
			...metadata,
			...additionalData
		});
	};
}

/**
 * Traces an async function execution
 */
export async function traceAsync<T>(
	category: TraceCategory,
	operation: string,
	fn: () => Promise<T>,
	metadata?: Record<string, unknown>
): Promise<T> {
	if (!IS_DEV) return fn();

	const start = performance.now();
	try {
		const result = await fn();
		const duration = performance.now() - start;
		logTrace({
			category,
			operation,
			duration,
			success: true,
			...metadata
		});
		return result;
	} catch (error) {
		const duration = performance.now() - start;
		logTrace({
			category,
			operation,
			duration,
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
			...metadata
		});
		throw error;
	}
}

/**
 * Logs element waiter result with existing timing data
 */
export function logElementWaitResult(
	selector: string,
	result: { totalTime: number; attempts: number; success: boolean }
): void {
	if (!IS_DEV) return;

	logTrace({
		category: TRACE_CATEGORIES.DOM,
		operation: `waitForElement: ${selector}`,
		duration: result.totalTime,
		attempts: result.attempts,
		success: result.success
	});
}
