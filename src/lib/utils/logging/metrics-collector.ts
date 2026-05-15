import type { LongTaskEntry, MemorySnapshot, MetricsSnapshot } from '../../types/performance';
import { addMetricsSnapshot } from '../../stores/metrics';
import { getObserverCount } from '../dom/observer';
import { getLogSource, IS_DEV } from './log-source';
import { generateLocalId } from '../id';

const SAMPLE_INTERVAL = 30_000; // 30 seconds

class MetricsCollector {
	private longTaskObserver: PerformanceObserver | null = null;
	private sampleTimer: ReturnType<typeof setInterval> | null = null;

	start(): void {
		if (!IS_DEV) return;

		this.setupLongTaskObserver();
		this.startPeriodicSampling();
	}

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

	takeSnapshot(type: 'navigation' | 'periodic'): void {
		if (!IS_DEV) return;

		const snapshot = this.collectSnapshot(type);
		void addMetricsSnapshot(snapshot);
	}

	private setupLongTaskObserver(): void {
		if (!('PerformanceObserver' in globalThis)) return;

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
		this.takeSnapshot('periodic');

		this.sampleTimer = setInterval(() => {
			this.takeSnapshot('periodic');
		}, SAMPLE_INTERVAL);
	}

	private collectSnapshot(type: 'navigation' | 'periodic'): MetricsSnapshot {
		return {
			id: generateLocalId(),
			timestamp: Date.now(),
			pageUrl: globalThis.location.href,
			source: getLogSource(),
			type,
			observerCount: getObserverCount(),
			domNodeCount: this.getDomNodeCount(),
			memory: this.getMemorySnapshot()
		};
	}

	private getDomNodeCount(): number {
		return document.querySelectorAll('*').length;
	}

	private getMemorySnapshot(): MemorySnapshot | undefined {
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
			id: generateLocalId(),
			timestamp: Date.now(),
			pageUrl: globalThis.location.href,
			source: getLogSource(),
			type: 'longtask',
			observerCount: getObserverCount(),
			domNodeCount: this.getDomNodeCount(),
			memory: this.getMemorySnapshot(),
			longTask: task
		};

		void addMetricsSnapshot(snapshot);
	}
}

export const metricsCollector = new MetricsCollector();
