import { logger } from '../utils/logger';
import { startTrace, TRACE_CATEGORIES } from '../utils/perf-tracer';
import { COMPONENT_CLASSES, type ComponentClassType } from '../types/constants';
import type { PageType } from '../types/api';
import { type Component, mount } from 'svelte';

/**
 * Base class for all page controllers
 */
export abstract class PageController {
	protected isInitialized = false;
	protected mountedComponents: Array<{ element: HTMLElement; cleanup: () => void }> = [];

	constructor(
		public readonly pageType: PageType,
		protected url: string
	) {
		logger.debug(`Creating ${this.constructor.name}`, { pageType, url });
	}

	// Initialize the page controller
	async initialize(): Promise<void> {
		if (this.isInitialized) {
			logger.warn(`${this.constructor.name} already initialized`);
			return;
		}

		const endTrace = startTrace(
			TRACE_CATEGORIES.CONTROLLER,
			`${this.constructor.name}.initialize`,
			{
				pageType: this.pageType
			}
		);
		try {
			logger.debug(`Initializing ${this.constructor.name}`);

			// Wait for DOM to be ready
			await this.waitForDOM();

			// Initialize page functionality
			await this.initializePage();

			this.isInitialized = true;
			logger.debug(`${this.constructor.name} initialized successfully`);
		} catch (error) {
			logger.error(`Failed to initialize ${this.constructor.name}:`, error);
			throw error;
		} finally {
			endTrace();
		}
	}

	// Cleanup all resources
	async cleanup(): Promise<void> {
		const endTrace = startTrace(TRACE_CATEGORIES.CONTROLLER, `${this.constructor.name}.cleanup`, {
			pageType: this.pageType
		});
		try {
			logger.debug(`Cleaning up ${this.constructor.name}`);

			// Cleanup mounted components
			this.cleanupComponents();

			// Call page cleanup
			await this.cleanupPage();

			this.isInitialized = false;
			logger.debug(`${this.constructor.name} cleanup completed`);
		} catch (error) {
			logger.error(`Failed to cleanup ${this.constructor.name}:`, error);
		} finally {
			endTrace();
		}
	}

	// Abstract method for page initialization
	protected abstract initializePage(): Promise<void>;

	// Wait for DOM to be ready
	protected async waitForDOM(): Promise<void> {
		return new Promise((resolve) => {
			if (document.readyState === 'loading') {
				document.addEventListener(
					'DOMContentLoaded',
					() => {
						resolve();
					},
					{ once: true }
				);
			} else {
				resolve();
			}
		});
	}

	// Mount a Svelte component to a DOM element
	protected mountComponent<TProps extends Record<string, unknown>>(
		ComponentClass: Component<TProps>,
		target: HTMLElement,
		props: TProps
	): { element: HTMLElement; cleanup: () => void } {
		const endTrace = startTrace(TRACE_CATEGORIES.COMPONENT, 'mountComponent', {
			target: target.tagName,
			pageType: this.pageType
		});
		try {
			logger.debug(`Mounting component to`, { target: target.tagName, props });

			// Store component cleanup function if provided
			let componentCleanup: (() => void) | null = null;

			// Add onMount prop to capture cleanup function
			const enhancedProps = {
				...props,
				onMount: (cleanup: () => void) => {
					componentCleanup = cleanup;
				}
			};

			// Create component instance
			const component = mount(ComponentClass, {
				target,
				props: enhancedProps
			}) as { unmount?: () => void };

			// Create cleanup function
			const cleanup = () => {
				try {
					// Call component's cleanup if available
					if (componentCleanup) {
						componentCleanup();
					}

					// Unmount the Svelte component
					if (component.unmount) {
						component.unmount();
					}
					logger.debug('Component unmounted successfully');
				} catch (error) {
					logger.error('Failed to unmount component:', error);
				}
			};

			// Track mounted component
			const mountedComponent = { element: target, cleanup };
			this.mountedComponents.push(mountedComponent);

			endTrace();
			return mountedComponent;
		} catch (error) {
			endTrace({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
			logger.error('Failed to mount component:', error);
			throw error;
		}
	}

	// Create a container element for components
	protected createComponentContainer(
		className: ComponentClassType = COMPONENT_CLASSES.COMPONENT_BASE
	): HTMLElement {
		const container = document.createElement('div');
		container.className = className;
		return container;
	}

	// Find a single element using a selector with error handling
	protected findElement(selector: string): HTMLElement | null {
		try {
			return document.querySelector(selector);
		} catch (error) {
			logger.error(`Failed to find element with selector: ${selector}`, error);
			return null;
		}
	}

	// Abstract method for page cleanup
	protected async cleanupPage(): Promise<void> {}

	// Cleanup all mounted components and remove their DOM elements
	private cleanupComponents(): void {
		for (const component of this.mountedComponents) {
			try {
				component.cleanup();
				component.element.parentNode?.removeChild(component.element);
			} catch (error) {
				logger.error('Failed to cleanup component:', error);
			}
		}
		this.mountedComponents = [];
	}
}
