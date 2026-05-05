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
	pageUrl?: string | undefined;
	metadata?: Record<string, unknown> | undefined;
}

export interface CategoryStats {
	category: TraceCategory;
	count: number;
	totalDuration: number;
	avgDuration: number;
	minDuration: number;
	maxDuration: number;
}

export interface MetricsSnapshot {
	id: string;
	timestamp: number;
	pageUrl?: string | undefined;
	source: LogSource;
	type: 'periodic' | 'navigation' | 'longtask';
	observerCount: number;
	domNodeCount: number;
	memory?: MemorySnapshot | undefined;
	longTask?: LongTaskEntry | undefined;
}

export interface LongTaskEntry {
	startTime: number;
	duration: number;
	name: string;
}

export interface MemorySnapshot {
	usedJSHeapSize: number;
	totalJSHeapSize: number;
	jsHeapSizeLimit: number;
}
