import {logger} from '../utils/logger';
import {COMPONENT_CLASSES, type ComponentClassType} from '../types/constants';
import type {PageType, UserStatus} from '../types/api';
import type {Observer} from '../utils/observer';
import {type Component, mount} from 'svelte';
import UserListManager from '../../components/features/UserListManager.svelte';

/**
 * Base class for all page controllers
 */
export abstract class PageController {
    protected isInitialized = false;
    protected observers: Observer[] = [];
    protected mountedComponents: { element: HTMLElement; cleanup: () => void }[] = [];

    constructor(
        protected pageType: PageType,
        protected url: string
    ) {
        logger.debug(`Creating ${this.constructor.name}`, {pageType, url});
    }

    // Initialize the page controller
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            logger.warn(`${this.constructor.name} already initialized`);
            return;
        }

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
        }
    }

    // Get the page type
    getPageType(): PageType {
        return this.pageType;
    }

    // Get the current URL
    getUrl(): string {
        return this.url;
    }

    // Check if the controller is initialized
    isReady(): boolean {
        return this.isInitialized;
    }

    // Update the URL (called on navigation within same page type)
    updateUrl(newUrl: string): void {
        logger.debug(`Updating URL for ${this.constructor.name}`, {
            oldUrl: this.url,
            newUrl
        });
        this.url = newUrl;
    }

    // Cleanup all resources
    async cleanup(): Promise<void> {
        try {
            logger.debug(`Cleaning up ${this.constructor.name}`);

            // Cleanup mounted components
            this.cleanupComponents();

            // Stop and cleanup observers
            this.cleanupObservers();

            // Call page cleanup
            await this.cleanupPage();

            this.isInitialized = false;
            logger.debug(`${this.constructor.name} cleanup completed`);

        } catch (error) {
            logger.error(`Failed to cleanup ${this.constructor.name}:`, error);
        }
    }

    // Abstract method for page initialization
    protected abstract initializePage(): Promise<void>;

    // Wait for DOM to be ready
    protected waitForDOM(): Promise<void> {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => resolve(), {once: true});
            } else {
                resolve();
            }
        });
    }

    // Mount a Svelte component to a DOM element
    protected mountComponent(
        ComponentClass: Component<any, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
        target: HTMLElement,
        props: Record<string, any> = {} // eslint-disable-line @typescript-eslint/no-explicit-any
    ): { element: HTMLElement; cleanup: () => void } {
        try {
            logger.debug(`Mounting component to`, {target: target.tagName, props});

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
            });

            // Create cleanup function
            const cleanup = () => {
                try {
                    // Call component's cleanup if available
                    if (componentCleanup) {
                        componentCleanup();
                    }

                    // Unmount the Svelte component
                    if (component && typeof component.unmount === 'function') {
                        component.unmount();
                    }
                    logger.debug('Component unmounted successfully');
                } catch (error) {
                    logger.error('Failed to unmount component:', error);
                }
            };

            // Track mounted component
            const mountedComponent = {element: target, cleanup};
            this.mountedComponents.push(mountedComponent);

            return mountedComponent;
        } catch (error) {
            logger.error('Failed to mount component:', error);
            throw error;
        }
    }

    // Create a container element for components
    protected createComponentContainer(className: ComponentClassType = COMPONENT_CLASSES.COMPONENT_BASE): HTMLElement {
        const container = document.createElement('div');
        container.className = className;
        return container;
    }

    // Find elements using a selector with error handling
    protected findElements(selector: string): HTMLElement[] {
        try {
            return Array.from(document.querySelectorAll(selector));
        } catch (error) {
            logger.error(`Failed to find elements with selector: ${selector}`, error);
            return [];
        }
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

    // Add an observer and track it for cleanup
    protected addObserver(observer: Observer): void {
        this.observers.push(observer);
    }

    // Abstract method for page cleanup
    protected async cleanupPage(): Promise<void> {
    }

    // Handle errors that occur during page operation
    protected handleError(error: unknown, context: string): void {
        logger.error(`Error in ${this.constructor.name} (${context}):`, error);
    }

    // Mount UserListManager with standard configuration
    protected mountUserListManager(
        containerSelector: string,
        componentClass: ComponentClassType,
        pageType: PageType,
        showTooltips: boolean,
        onUserProcessed?: (userId: string, status: UserStatus) => void,
        onError?: (error: string) => void
    ): { element: HTMLElement; cleanup: () => void } | null {
        try {
            const targetContainer = this.findElement(containerSelector);

            if (!targetContainer) {
                throw new Error(`Container not found: ${containerSelector}`);
            }

            // Create a wrapper for our component
            const componentContainer = this.createComponentContainer(componentClass);
            targetContainer.appendChild(componentContainer);

            // Mount UserListManager
            const component = this.mountComponent(
                UserListManager,
                componentContainer,
                {
                    pageType,
                    showTooltips,
                    onUserProcessed: onUserProcessed || this.handleUserProcessed.bind(this),
                    onError: onError || this.handleUserListError.bind(this)
                }
            );

            logger.debug('UserListManager mounted successfully', {
                container: containerSelector,
                pageType
            });

            return component;

        } catch (error) {
            this.handleError(error, 'mountUserListManager');
            throw error;
        }
    }

    // Default user processed handler
    protected handleUserProcessed(userId: string, status: UserStatus): void {
        logger.debug('User processed', {userId, status: status.flagType});
    }

    // Default user list error handler
    protected handleUserListError(error: string): void {
        logger.error('UserListManager error:', error);
    }

    // Generic method to update modal visibility by remounting component
    protected updateModalVisibility(
        modalRef: { element: HTMLElement; cleanup: () => void } | null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        componentClass: any,
        visible: boolean,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        props: Record<string, any>
    ): { element: HTMLElement; cleanup: () => void } | null {
        if (!modalRef) return null;

        try {
            // Clean up existing component
            modalRef.cleanup();

            // Remount with new visibility state
            return this.mountComponent(componentClass, modalRef.element, {
                isOpen: visible,
                ...props
            });
        } catch (error) {
            this.handleError(error, 'updateModalVisibility');
            return null;
        }
    }

    // Cleanup all mounted components
    private cleanupComponents(): void {
        for (const component of this.mountedComponents) {
            try {
                component.cleanup();
            } catch (error) {
                logger.error('Failed to cleanup component:', error);
            }
        }
        this.mountedComponents = [];
    }

    // Cleanup all observers
    private cleanupObservers(): void {
        for (const observer of this.observers) {
            try {
                observer.stop();
            } catch (error) {
                logger.error('Failed to stop observer:', error);
            }
        }
        this.observers = [];
    }
} 