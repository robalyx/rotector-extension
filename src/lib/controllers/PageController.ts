import { get } from 'svelte/store';
import { asApiError } from '@/lib/utils/api/api-error';
import { logger } from '@/lib/utils/logging/logger';
import { startTrace } from '@/lib/utils/logging/perf-tracer';
import { TRACE_CATEGORIES } from '@/lib/types/performance';
import type { ComponentClassType } from '@/lib/types/constants';
import type { PageType } from '@/lib/types/api';
import type { SettingsKey } from '@/lib/types/settings';
import { settings } from '@/lib/stores/settings';
import { type Component, mount, unmount } from 'svelte';

export abstract class PageController {
	readonly pageType: PageType;
	protected url: string;
	protected isInitialized = false;
	protected mountedComponents: Array<{ element: HTMLElement; cleanup: () => void }> = [];

	// Checked once at init and runtime toggling does not retroactively initialize/cleanup
	protected readonly settingsKey?: SettingsKey;

	constructor(pageType: PageType, url: string) {
		this.pageType = pageType;
		this.url = url;
		logger.debug(`Creating ${this.constructor.name}`, { pageType, url });
	}

	async initialize(): Promise<void> {
		if (this.isInitialized) {
			logger.warn(`${this.constructor.name} already initialized`);
			return;
		}

		if (this.settingsKey && !get(settings)[this.settingsKey]) {
			logger.debug(`${this.constructor.name} gated off by setting ${this.settingsKey}`);
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

			await this.waitForDOM();
			await this.initializePage();

			this.isInitialized = true;
			logger.debug(`${this.constructor.name} initialized successfully`);
		} finally {
			endTrace();
		}
	}

	async cleanup(): Promise<void> {
		const endTrace = startTrace(TRACE_CATEGORIES.CONTROLLER, `${this.constructor.name}.cleanup`, {
			pageType: this.pageType
		});
		try {
			logger.debug(`Cleaning up ${this.constructor.name}`);

			this.cleanupComponents();
			await this.cleanupPage();

			this.isInitialized = false;
			logger.debug(`${this.constructor.name} cleanup completed`);
		} catch (error) {
			logger.error(`Failed to cleanup ${this.constructor.name}:`, error);
		} finally {
			endTrace();
		}
	}

	protected abstract initializePage(): Promise<void>;

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

			let componentCleanup: (() => void) | null = null;

			const enhancedProps = {
				...props,
				onMount: (cleanup: () => void) => {
					componentCleanup = cleanup;
				}
			};

			const component = mount(ComponentClass, {
				target,
				props: enhancedProps
			});

			const cleanup = () => {
				try {
					componentCleanup?.();
					void unmount(component);
					logger.debug('Component unmounted successfully');
				} catch (error) {
					logger.error('Failed to unmount component:', error);
				}
			};

			const mountedComponent = { element: target, cleanup };
			this.mountedComponents.push(mountedComponent);

			endTrace();
			return mountedComponent;
		} catch (error) {
			endTrace({ success: false, error: asApiError(error).message });
			logger.error('Failed to mount component:', error);
			throw error;
		}
	}

	protected createComponentContainer(className: ComponentClassType): HTMLElement {
		const container = document.createElement('div');
		container.className = className;
		return container;
	}

	protected async cleanupPage(): Promise<void> {}

	private cleanupComponents(): void {
		for (const component of this.mountedComponents) {
			try {
				component.cleanup();
				component.element.remove();
			} catch (error) {
				logger.error('Failed to cleanup component:', error);
			}
		}
		this.mountedComponents = [];
	}
}
