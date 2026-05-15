import { logger } from '../logging/logger';
import { startTrace } from '../logging/perf-tracer';
import { IS_DEV } from '../logging/log-source';
import { TRACE_CATEGORIES } from '../../types/performance';
import { OBSERVER_CONFIG } from '../../types/constants';

// Tracks active observer instances for the metrics-collector in dev builds only
let observerCount = 0;
function registerObserver(): void {
	if (IS_DEV) observerCount++;
}
function unregisterObserver(): void {
	if (IS_DEV) observerCount = Math.max(0, observerCount - 1);
}
export function getObserverCount(): number {
	return observerCount;
}

interface ObserverConfig {
	name: string;
	targetSelector?: string | (() => Element | null) | undefined;
	callback?: ((mutations: MutationRecord[], observer: MutationObserver) => void) | undefined;
	observerOptions?: MutationObserverInit | undefined;
	onNoTarget?: (() => void) | undefined;
	onStart?: (() => void | Promise<void>) | undefined;
	onResizeComplete?: (() => void | Promise<void>) | undefined;
	healthCheckInterval?: number | undefined;
	restartDelay?: number | undefined;
	ignoreResizeEvents?: boolean | undefined;
	enablePostResizeProcessing?: boolean | undefined;
}

interface ListObserverConfig {
	name: string;
	containerSelector: string;
	unprocessedItemSelector: string;
	processItems: (items: Element[]) => void | Promise<void>;
	processExistingItems?: boolean;
	restartDelay?: number;
	enablePostResizeProcessing?: boolean;
	onResizeComplete?: () => void | Promise<void>;
}

// Auto-recovers if the target element disappears (Roblox SPA navigation rebuilds the DOM)
export class Observer {
	private readonly name: string;
	private readonly config: Required<ObserverConfig>;
	private active = false;
	private observer: MutationObserver | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
	private resizeTimer: ReturnType<typeof setTimeout> | null = null;
	private resizeHandler: (() => void) | null = null;
	private isResizing = false;
	private retryCount = 0;
	private resizeListenerAdded = false;

	constructor(config: ObserverConfig) {
		this.name = config.name;
		this.config = {
			targetSelector: config.targetSelector ?? '',
			callback: config.callback ?? (() => {}),
			observerOptions: config.observerOptions ?? { childList: true, subtree: true },
			onNoTarget: config.onNoTarget ?? (() => {}),
			onStart: config.onStart ?? (() => {}),
			onResizeComplete: config.onResizeComplete ?? (() => {}),
			healthCheckInterval:
				config.healthCheckInterval ?? OBSERVER_CONFIG.DEFAULT_HEALTH_CHECK_INTERVAL,
			restartDelay: config.restartDelay ?? OBSERVER_CONFIG.DEFAULT_RESTART_DELAY,
			ignoreResizeEvents: config.ignoreResizeEvents !== false,
			enablePostResizeProcessing: config.enablePostResizeProcessing ?? false,
			...config
		};
	}

	// Idempotent start that disconnects any prior observer and schedules retry when target is missing
	async start(): Promise<void> {
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
			this.active = false;
		}

		const target = this.getTarget();
		if (!target) {
			this.config.onNoTarget?.();
			this.scheduleRestart();
			return;
		}

		this.retryCount = 0;

		try {
			this.observer = new MutationObserver((mutations, observer) => {
				if (this.config.ignoreResizeEvents && this.isResizing) {
					logger.debug(`${this.name} observer: Ignoring mutations during resize`);
					return;
				}

				const endTrace = startTrace(TRACE_CATEGORIES.OBSERVER, `${this.name}.mutation`, {
					mutationCount: mutations.length
				});
				this.config.callback?.(mutations, observer);
				endTrace();
			});

			this.observer.observe(target, this.config.observerOptions);
			this.active = true;

			registerObserver();

			if (this.reconnectTimer) {
				clearTimeout(this.reconnectTimer);
				this.reconnectTimer = null;
			}

			this.setupResizeListener();
			this.startHealthCheck();

			logger.debug(`${this.name} observer started successfully`);

			if (this.config.onStart) {
				try {
					await this.config.onStart();
				} catch (error) {
					logger.error(`${this.name} observer: Error in onStart callback:`, error);
				}
			}
		} catch (error) {
			logger.error(`Error starting ${this.name} observer:`, error);
			this.active = false;
			this.scheduleRestart();
		}
	}

	// Tears down the observer, resize listener, health check, and any pending restart timer
	stop(): void {
		this.active = false;

		if (this.observer) {
			unregisterObserver();
			this.observer.disconnect();
			this.observer = null;
		}

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer);
			this.healthCheckTimer = null;
		}

		if (this.resizeTimer) {
			clearTimeout(this.resizeTimer);
			this.resizeTimer = null;
		}

		if (this.resizeHandler && this.resizeListenerAdded) {
			window.removeEventListener('resize', this.resizeHandler);
			this.resizeHandler = null;
			this.resizeListenerAdded = false;
		}

		this.retryCount = 0;
		this.isResizing = false;

		logger.debug(`${this.name} observer stopped`);
	}

	private getTarget(): Element | null {
		try {
			if (typeof this.config.targetSelector === 'function') {
				return this.config.targetSelector();
			}

			if (!this.config.targetSelector) return null;

			const target = document.querySelector(this.config.targetSelector);
			if (!target) {
				logger.debug(
					`${this.name} observer: Target element not found (attempt ${String(this.retryCount + 1)})`
				);
			}
			return target;
		} catch (error) {
			logger.error(`${this.name} observer: Error getting target element:`, error);
		}

		return null;
	}

	// Pauses observation during window resize to avoid spurious mutations
	private setupResizeListener(): void {
		if (this.resizeListenerAdded || !this.config.ignoreResizeEvents) {
			return;
		}

		this.resizeHandler = () => {
			if (this.resizeTimer) {
				clearTimeout(this.resizeTimer);
			}

			this.isResizing = true;
			logger.debug(`${this.name} observer: Resize detected, pausing mutations`);

			this.resizeTimer = setTimeout(() => {
				this.isResizing = false;
				logger.debug(`${this.name} observer: Resize complete, resuming mutations`);

				if (this.config.enablePostResizeProcessing && this.config.onResizeComplete) {
					try {
						logger.debug(`${this.name} observer: Triggering post-resize processing`);
						void this.config.onResizeComplete();
					} catch (error) {
						logger.error(`${this.name} observer: Error in post-resize processing:`, error);
					}
				}
			}, 250);
		};

		window.addEventListener('resize', this.resizeHandler);
		this.resizeListenerAdded = true;
		logger.debug(`${this.name} observer: Resize listener added`);
	}

	// Schedules a restart attempt with exponential backoff capped at 30 seconds
	private scheduleRestart(delay?: number): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
		}

		this.retryCount++;

		const exponentialDelay =
			(this.config.restartDelay ?? OBSERVER_CONFIG.DEFAULT_RESTART_DELAY) * this.retryCount;
		const maxBackoffDelay = 30_000;
		const actualDelay = delay ?? Math.min(exponentialDelay, maxBackoffDelay);

		logger.debug(
			`${this.name} observer: Scheduling restart in ${String(actualDelay)}ms (attempt ${String(this.retryCount)})`
		);

		this.reconnectTimer = setTimeout(() => {
			logger.debug(`${this.name} observer: Attempting restart...`);
			void this.start();
		}, actualDelay);
	}

	private checkHealth(): void {
		if (!this.active || !this.observer) {
			logger.debug(`${this.name} observer: Health check failed - observer not active`);
			return;
		}

		const target = this.getTarget();
		if (!target) {
			logger.warn(`${this.name} observer: Health check failed - target element lost`);
			this.scheduleRestart();
		}
	}

	private startHealthCheck(): void {
		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer);
		}

		this.healthCheckTimer = setInterval(() => {
			this.checkHealth();
		}, this.config.healthCheckInterval);

		logger.debug(
			`${this.name} observer: Health check started (${String(this.config.healthCheckInterval)}ms interval)`
		);
	}
}

export const observerFactory = {
	// Builds an observer that processes unprocessed items on add, start, and post-resize
	createListObserver(config: ListObserverConfig): Observer {
		const {
			name,
			containerSelector,
			unprocessedItemSelector,
			processItems,
			processExistingItems = true,
			restartDelay = OBSERVER_CONFIG.DEFAULT_RESTART_DELAY,
			enablePostResizeProcessing = false,
			onResizeComplete
		} = config;

		const processItemsInContainer = async () => {
			const container = document.querySelector(containerSelector);
			if (!container) return;

			const unprocessedItems = [...container.querySelectorAll(unprocessedItemSelector)];
			if (unprocessedItems.length > 0) {
				logger.debug(`${name}: Processing ${String(unprocessedItems.length)} items`);
				await processItems(unprocessedItems);
			}
		};

		return new Observer({
			name,
			targetSelector: containerSelector,
			observerOptions: {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['href']
			},
			callback: () => {
				processItemsInContainer().catch((error: unknown) => {
					logger.error(`${name}: Error in containerAdded processItems:`, error);
				});
			},
			onNoTarget: () => {
				logger.debug(`${name}: Container not found, will retry`);
			},
			onStart: processExistingItems
				? () => {
						logger.debug(`${name}: Processing existing items on start`);
						processItemsInContainer().catch((error: unknown) => {
							logger.error(`${name}: Error in start processItems:`, error);
						});
					}
				: undefined,
			onResizeComplete:
				onResizeComplete ??
				(enablePostResizeProcessing
					? () => {
							logger.debug(`${name}: Post-resize processing triggered`);
							processItemsInContainer().catch((error: unknown) => {
								logger.error(`${name}: Error in resize processItems:`, error);
							});
						}
					: undefined),
			enablePostResizeProcessing,
			restartDelay
		});
	},

	createContainerWatcher(config: {
		name: string;
		containerSelector: string;
		onContainerAdded: (container: Element) => void;
	}): Observer {
		const { name, containerSelector, onContainerAdded } = config;

		return new Observer({
			name,
			targetSelector: () => document.body,
			observerOptions: {
				childList: true,
				subtree: true
			},
			callback: (mutations) => {
				for (const mutation of mutations) {
					if (mutation.type === 'childList') {
						for (const node of mutation.addedNodes) {
							if (node instanceof Element) {
								if (node.matches(containerSelector)) {
									onContainerAdded(node);
								}
								node.querySelectorAll(containerSelector).forEach(onContainerAdded);
							}
						}
					}
				}
			}
		});
	}
};
