import { logger } from './logger';
import { OBSERVER_CONFIG } from '../types/constants';

interface ObserverConfig {
	name: string;
	targetSelector?: string | (() => Element | null);
	callback?: (mutations: MutationRecord[], observer: MutationObserver) => void;
	observerOptions?: MutationObserverInit;
	onNoTarget?: () => void;
	onNewMutations?: (mutations: MutationRecord[]) => void;
	onStart?: () => void | Promise<void>;
	onResizeComplete?: () => void | Promise<void>;
	healthCheckInterval?: number;
	restartDelay?: number;
	ignoreResizeEvents?: boolean;
	enablePostResizeProcessing?: boolean;
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

interface UrlChangeObserverConfig {
	name: string;
	callback: (newUrl: string, oldUrl: string) => void;
	checkInterval?: number;
}

/**
 * Base Observer class that defines the common interface for all observers
 */
export abstract class Observer {
	protected name: string;
	protected active: boolean = false;

	protected constructor(config: { name: string }) {
		this.name = config.name;
	}

	// Starts the observer
	async start(): Promise<void> {
		this.active = true;
		logger.debug(`${this.name} observer started`);
		return Promise.resolve();
	}

	// Stops the observer
	stop(): void {
		this.active = false;
		logger.debug(`${this.name} observer stopped`);
	}

	// Cleans up resources
	cleanup(): void {
		this.stop();
		logger.debug(`${this.name} observer cleanup complete`);
	}

	// Pauses the observer temporarily
	pause(): void {
		if (this.active) {
			this.active = false;
			logger.debug(`${this.name} observer paused`);
		}
	}

	// Resumes the observer if paused
	resume(): void {
		if (!this.active) {
			this.active = true;
			logger.debug(`${this.name} observer resumed`);
		}
	}

	// Checks if the observer is currently active
	isActive(): boolean {
		return this.active;
	}
}

/**
 * A mutation observer manager with health checking and auto-recovery
 */
class ObserverManager extends Observer {
	private readonly config: Required<ObserverConfig>;
	private observer: MutationObserver | null = null;
	private reconnectTimer: number | null = null;
	private healthCheckTimer: number | null = null;
	private resizeTimer: number | null = null;
	private resizeHandler: (() => void) | null = null;
	private isResizing: boolean = false;
	private retryCount: number = 0;
	private resizeListenerAdded: boolean = false;

	constructor(config: ObserverConfig) {
		super(config);

		this.config = {
			targetSelector: config.targetSelector ?? '',
			callback: config.callback ?? (() => {}),
			observerOptions: config.observerOptions ?? { childList: true, subtree: true },
			onNoTarget: config.onNoTarget ?? (() => {}),
			onNewMutations: config.onNewMutations ?? (() => {}),
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

	// Starts the MutationObserver on the target element
	override async start(): Promise<void> {
		// Disconnect previous observer if active
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
			this.active = false;
		}

		const target = this.getTarget();
		if (!target) {
			this.config.onNoTarget();
			this.scheduleRestart();
			return;
		}

		// Reset retry count on successful start
		this.retryCount = 0;

		try {
			this.observer = new MutationObserver((mutations, observer) => {
				// Skip processing if we're currently resizing and ignoreResizeEvents is enabled
				if (this.config.ignoreResizeEvents && this.isResizing) {
					logger.debug(`${this.name} observer: Ignoring mutations during resize`);
					return;
				}

				// Call the callback first (for custom processing)
				this.config.callback(mutations, observer);

				// Then call the onNewMutations handler if provided
				if (this.config.onNewMutations) {
					this.config.onNewMutations(mutations);
				}
			});

			this.observer.observe(target, this.config.observerOptions);
			this.active = true;

			// Clear any pending reconnection timer
			if (this.reconnectTimer) {
				window.clearTimeout(this.reconnectTimer);
				this.reconnectTimer = null;
			}

			// Set up resize listener if needed
			this.setupResizeListener();

			// Start health checking
			this.startHealthCheck();

			logger.debug(`${this.name} observer started successfully`);

			// Call onStart callback if provided
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

	// Stops the observer and cleans up
	override stop(): void {
		super.stop();

		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}

		if (this.reconnectTimer) {
			window.clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		if (this.healthCheckTimer) {
			window.clearInterval(this.healthCheckTimer);
			this.healthCheckTimer = null;
		}

		if (this.resizeTimer) {
			window.clearTimeout(this.resizeTimer);
			this.resizeTimer = null;
		}

		if (this.resizeHandler && this.resizeListenerAdded) {
			window.removeEventListener('resize', this.resizeHandler);
			this.resizeHandler = null;
			this.resizeListenerAdded = false;
		}
	}

	// Cleans up all resources
	override cleanup(): void {
		this.stop();
		this.retryCount = 0;
		this.isResizing = false;
		this.resizeListenerAdded = false;
		this.resizeHandler = null;
		super.cleanup();
	}

	// Gets the target element to observe
	private getTarget(): Element | null {
		try {
			if (typeof this.config.targetSelector === 'function') {
				return this.config.targetSelector();
			}

			// targetSelector is a string at this point
			const target = document.querySelector(this.config.targetSelector);
			if (!target) {
				logger.debug(
					`${this.name} observer: Target element not found (attempt ${this.retryCount + 1})`
				);
			}
			return target;
		} catch (error) {
			logger.error(`${this.name} observer: Error getting target element:`, error);
		}

		return null;
	}

	// Sets up the resize event listener to temporarily pause observation during resizes
	private setupResizeListener(): void {
		if (this.resizeListenerAdded || !this.config.ignoreResizeEvents) {
			return;
		}

		this.resizeHandler = () => {
			if (this.resizeTimer) {
				window.clearTimeout(this.resizeTimer);
			}

			this.isResizing = true;
			logger.debug(`${this.name} observer: Resize detected, pausing mutations`);

			this.resizeTimer = window.setTimeout(() => {
				this.isResizing = false;
				logger.debug(`${this.name} observer: Resize complete, resuming mutations`);

				// Trigger post-resize processing if enabled
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
			window.clearTimeout(this.reconnectTimer);
		}

		this.retryCount++;

		// Calculate exponential backoff delay with maximum 30-second cap
		const exponentialDelay = this.config.restartDelay * this.retryCount;
		const maxBackoffDelay = 30000; // 30 seconds max delay
		const actualDelay = delay ?? Math.min(exponentialDelay, maxBackoffDelay);

		logger.debug(
			`${this.name} observer: Scheduling restart in ${actualDelay}ms (attempt ${this.retryCount})`
		);

		this.reconnectTimer = window.setTimeout(() => {
			logger.debug(`${this.name} observer: Attempting restart...`);
			void this.start();
		}, actualDelay);
	}

	// Verify observer is functioning properly
	private checkHealth(): void {
		if (!this.active || !this.observer) {
			logger.debug(`${this.name} observer: Health check failed - observer not active`);
			return;
		}

		const target = this.getTarget();
		if (!target) {
			logger.warn(`${this.name} observer: Health check failed - target element lost`);
			this.scheduleRestart();
			return;
		}

		logger.debug(`${this.name} observer: Health check passed`);
	}

	// Starts the health check timer
	private startHealthCheck(): void {
		if (this.healthCheckTimer) {
			window.clearInterval(this.healthCheckTimer);
		}

		this.healthCheckTimer = window.setInterval(() => {
			this.checkHealth();
		}, this.config.healthCheckInterval);

		logger.debug(
			`${this.name} observer: Health check started (${this.config.healthCheckInterval}ms interval)`
		);
	}
}

/**
 * Observer for URL changes in single-page applications
 */
class UrlChangeObserver extends Observer {
	private readonly config: Required<UrlChangeObserverConfig>;
	private currentUrl: string;
	private timer: number | null = null;

	constructor(config: UrlChangeObserverConfig) {
		super(config);

		this.config = {
			checkInterval: 1000,
			...config
		};

		this.currentUrl = window.location.href;
	}

	// Starts monitoring URL changes
	override async start(): Promise<void> {
		await super.start();

		this.currentUrl = window.location.href;
		this.timer = window.setInterval(() => {
			this.checkUrlChange();
		}, this.config.checkInterval);

		logger.debug(`${this.name} observer started (checking every ${this.config.checkInterval}ms)`);
	}

	// Stops monitoring URL changes
	override stop(): void {
		super.stop();

		if (this.timer) {
			window.clearInterval(this.timer);
			this.timer = null;
		}
	}

	// Cleans up the observer
	override cleanup(): void {
		this.stop();
		super.cleanup();
	}

	// Checks for URL changes
	private checkUrlChange(): void {
		if (!this.active) return;

		const newUrl = window.location.href;
		if (newUrl !== this.currentUrl) {
			const oldUrl = this.currentUrl;
			this.currentUrl = newUrl;

			logger.debug(`${this.name} observer: URL changed from ${oldUrl} to ${newUrl}`);
			this.config.callback(newUrl, oldUrl);
		}
	}
}

/**
 * Factory object for creating common observer patterns
 */
export const observerFactory = {
	// Creates a list observer that processes items in a container
	createListObserver(config: ListObserverConfig): ObserverManager {
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

			const unprocessedItems = Array.from(container.querySelectorAll(unprocessedItemSelector));
			if (unprocessedItems.length > 0) {
				logger.debug(`${name}: Processing ${unprocessedItems.length} items`);
				await processItems(unprocessedItems);
			}
		};

		return new ObserverManager({
			name,
			targetSelector: containerSelector,
			observerOptions: {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['href']
			},
			callback: () => {
				processItemsInContainer().catch((error) => {
					logger.error(`${name}: Error in containerAdded processItems:`, error);
				});
			},
			onNoTarget: () => {
				logger.debug(`${name}: Container not found, will retry`);
			},
			onStart: processExistingItems
				? () => {
						logger.debug(`${name}: Processing existing items on start`);
						processItemsInContainer().catch((error) => {
							logger.error(`${name}: Error in start processItems:`, error);
						});
					}
				: undefined,
			onResizeComplete:
				onResizeComplete ??
				(enablePostResizeProcessing
					? () => {
							logger.debug(`${name}: Post-resize processing triggered`);
							processItemsInContainer().catch((error) => {
								logger.error(`${name}: Error in resize processItems:`, error);
							});
						}
					: undefined),
			enablePostResizeProcessing,
			restartDelay
		});
	},

	// Creates a container watcher that triggers when a container appears
	createContainerWatcher(config: {
		name: string;
		containerSelector: string;
		onContainerAdded: (container: Element) => void;
	}): ObserverManager {
		const { name, containerSelector, onContainerAdded } = config;

		return new ObserverManager({
			name,
			targetSelector: () => document.body,
			observerOptions: {
				childList: true,
				subtree: true
			},
			callback: (mutations) => {
				for (const mutation of mutations) {
					if (mutation.type === 'childList') {
						for (const node of Array.from(mutation.addedNodes)) {
							if (node.nodeType === Node.ELEMENT_NODE) {
								const element = node as Element;

								// Check if element matches container selector
								if (element.matches(containerSelector)) {
									onContainerAdded(element);
								}

								// Check if any children match our selector
								const children = element.querySelectorAll(containerSelector);
								children.forEach(onContainerAdded);
							}
						}
					}
				}
			}
		});
	},

	// Creates a URL change observer
	createUrlChangeObserver(config: UrlChangeObserverConfig): UrlChangeObserver {
		return new UrlChangeObserver(config);
	}
};
