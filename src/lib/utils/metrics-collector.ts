import { LOG_SOURCES, type LogSource } from '../types/developer-logs';
import type { LongTaskEntry, MemorySnapshot, MetricsSnapshot } from '../types/performance';
import { addMetricsSnapshot } from '../stores/metrics';
import { observerRegistry } from './observer-registry';

const IS_DEV = import.meta.env.USE_DEV_API === 'true';
const SAMPLE_INTERVAL = 30000; // 30 seconds

function getLogSource(): LogSource {
	if (typeof document === 'undefined') {
		return LOG_SOURCES.BACKGROUND;
	}

	if (window.location?.hostname?.includes('roblox.com')) {
		return LOG_SOURCES.CONTENT;
	}

	return LOG_SOURCES.POPUP;
}

function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Central service for collecting system health metrics
class MetricsCollector {
	private longTaskObserver: PerformanceObserver | null = null;
	private sampleTimer: number | null = null;

	// Start collecting metrics
	start(): void {
		if (!IS_DEV) return;

		this.setupLongTaskObserver();
		this.startPeriodicSampling();
	}

	// Stop and cleanup
	stop(): void {
		if (this.longTaskObserver) {
			this.longTaskObserver.disconnect();
			this.longTaskObserver = null;
		}

		if (this.sampleTimer) {
			clearInterval(this.sampleTimer);
			this.sampleTimer = null;
		}
	}

	// Manual snapshot on navigation
	takeSnapshot(type: 'navigation' | 'periodic'): void {
		if (!IS_DEV) return;

		const snapshot = this.collectSnapshot(type);
		void addMetricsSnapshot(snapshot);
	}

	private setupLongTaskObserver(): void {
		if (!('PerformanceObserver' in window)) return;

		try {
			this.longTaskObserver = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					if (entry.duration > 50) {
						const longTask: LongTaskEntry = {
							startTime: entry.startTime,
							duration: entry.duration,
							name: entry.name
						};

						this.recordLongTask(longTask);
					}
				}
			});

			this.longTaskObserver.observe({ entryTypes: ['longtask'] });
		} catch {
			// longtask not supported in this browser
		}
	}

	private startPeriodicSampling(): void {
		// Take initial snapshot
		this.takeSnapshot('periodic');

		this.sampleTimer = window.setInterval(() => {
			this.takeSnapshot('periodic');
		}, SAMPLE_INTERVAL);
	}

	private collectSnapshot(type: 'navigation' | 'periodic'): MetricsSnapshot {
		return {
			id: generateId(),
			timestamp: Date.now(),
			pageUrl: window.location.href,
			source: getLogSource(),
			type,
			observerCount: observerRegistry.getCounts(),
			domNodeCount: this.getDomNodeCount(),
			memory: this.getMemorySnapshot()
		};
	}

	private getDomNodeCount(): number {
		return document.querySelectorAll('*').length;
	}

	private getMemorySnapshot(): MemorySnapshot | undefined {
		// Chrome-only API
		const memory = (performance as unknown as { memory?: MemorySnapshot }).memory;
		if (!memory) return undefined;

		return {
			usedJSHeapSize: memory.usedJSHeapSize,
			totalJSHeapSize: memory.totalJSHeapSize,
			jsHeapSizeLimit: memory.jsHeapSizeLimit
		};
	}

	private recordLongTask(task: LongTaskEntry): void {
		const snapshot: MetricsSnapshot = {
			id: generateId(),
			timestamp: Date.now(),
			pageUrl: window.location.href,
			source: getLogSource(),
			type: 'longtask',
			observerCount: observerRegistry.getCounts(),
			domNodeCount: this.getDomNodeCount(),
			memory: this.getMemorySnapshot(),
			longTask: task
		};

		void addMetricsSnapshot(snapshot);
	}
}

export const metricsCollector = new MetricsCollector();
