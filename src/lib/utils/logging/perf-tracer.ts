import { LOG_SOURCES } from '../../types/developer-logs';
import { TRACE_CATEGORIES, type TraceCategory } from '../../types/performance';
import { addPerformanceEntry } from '../../stores/performance';
import { getLogSource, IS_DEV, truncateForLog } from './log-source';

const MAX_DATA_LENGTH = 500;

interface TraceData {
	category: TraceCategory;
	operation: string;
	duration: number;
	success?: boolean;
	[key: string]: unknown;
}

function serializeMetadata(data: Record<string, unknown>): Record<string, unknown> | undefined {
	if (Object.keys(data).length === 0) return undefined;

	try {
		return truncateForLog(data, MAX_DATA_LENGTH) as Record<string, unknown>;
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

// Returns the end-trace callback that takes optional metadata to record duration
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
