import type { LogSource } from './developer-logs';

export const TRACE_CATEGORIES = {
	CONTROLLER: 'controller',
	OBSERVER: 'observer',
	API: 'api',
	DOM: 'dom',
	BLUR: 'blur',
	COMPONENT: 'component'
} as const;

export type TraceCategory = (typeof TRACE_CATEGORIES)[keyof typeof TRACE_CATEGORIES];

export interface PerformanceEntry {
	id: string;
	timestamp: number;
	category: TraceCategory;
	operation: string;
	duration: number;
	success: boolean;
	source: LogSource;
	pageUrl?: string;
	metadata?: Record<string, unknown>;
}

export interface CategoryStats {
	category: TraceCategory;
	count: number;
	totalDuration: number;
	avgDuration: number;
	minDuration: number;
	maxDuration: number;
}
