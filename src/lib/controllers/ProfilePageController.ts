import {get} from 'svelte/store';
import {PageController} from './PageController';
import {SETTINGS_KEYS} from '../types/settings';
import {userStatusService} from '../services/entity-status-service';
import {sanitizeEntityId} from '../utils/sanitizer';
import {waitForElement} from '../utils/element-waiter';
import {settings} from '../stores/settings';
import ProfilePageManager from '../../components/features/ProfilePageManager.svelte';
import type {UserStatus} from '../types/api';
import {logger} from '../utils/logger';

/**
 * Handles user profile pages
 */
export class ProfilePageController extends PageController {
    private userId: string | null = null;
    private userStatus: UserStatus | null = null;
    private profilePageManager: { element: HTMLElement; cleanup: () => void } | null = null;

    protected override async initializePage(): Promise<void> {
        try {
            logger.debug('Initializing ProfilePageController', {
                pageType: this.pageType,
                url: this.url
            });

            // Check if profile checks are enabled
            const currentSettings = get(settings);
            if (!currentSettings[SETTINGS_KEYS.PROFILE_CHECK_ENABLED]) {
                logger.debug('Profile checks disabled, skipping ProfilePageController initialization');
                return;
            }

            // Extract user ID from URL
            this.userId = this.extractUserIdFromUrl();
            if (!this.userId) {
                throw new Error('Could not extract user ID from profile URL');
            }

            logger.debug('Profile user ID extracted', {userId: this.userId});

            // Wait for profile elements to load
            await this.waitForProfileElements();

            // Load user status
            await this.loadUserStatus();

            // Mount profile page manager to handle all UI components
            this.mountProfilePageManager();

            logger.debug('ProfilePageController initialized successfully');

        } catch (error) {
            this.handleError(error, 'initializePage');
            throw error;
        }
    }

    // Page cleanup
    protected override async cleanupPage(): Promise<void> {
        try {
            // Cleanup profile page manager
            if (this.profilePageManager) {
                this.profilePageManager.cleanup();
                this.profilePageManager = null;
            }

            // Reset state
            this.userId = null;
            this.userStatus = null;

            logger.debug('ProfilePageController cleanup completed');
        } catch (error) {
            this.handleError(error, 'cleanupPage');
            throw error;
        }
    }

    // Extract user ID from profile URL
    private extractUserIdFromUrl(): string | null {
        try {
            const match = /\/users\/(\d+)/.exec(this.url);
            if (match && match.length > 1 && match[1]) {
                return sanitizeEntityId(match[1]) ?? null;
            }
            return null;
        } catch (error) {
            logger.error('Failed to extract user ID from URL:', error);
            return null;
        }
    }

    // Wait for profile elements to be available
    private async waitForProfileElements(): Promise<void> {
        // Wait for the profile header username element
        const result = await waitForElement('.profile-header-username', {
            baseDelay: 200
        });

        if (!result.success) {
            throw new Error('Profile username element not found');
        }
    }

    // Load user status from API with caching
    private async loadUserStatus(): Promise<void> {
        if (!this.userId) return;

        try {
            logger.debug('Loading user status', {userId: this.userId});
            this.userStatus = await userStatusService.getStatus(this.userId);
            logger.debug('User status loaded', {
                userId: this.userId,
                flagType: this.userStatus?.flagType
            });
        } catch (error) {
            logger.error('Failed to load user status:', error);
        }
    }

    // Mount profile page manager to handle all UI components
    private mountProfilePageManager(): void {
        try {
            if (!this.userId) {
                throw new Error('Cannot mount ProfilePageManager without userId');
            }

            // Create container for profile page manager
            const container = this.createComponentContainer();
            container.style.display = 'none';
            document.body.appendChild(container);

            // Mount ProfilePageManager component
            this.profilePageManager = this.mountComponent(
                ProfilePageManager,
                container,
                {
                    userId: this.userId,
                    userStatus: this.userStatus,
                    onStatusRefresh: this.handleStatusRefresh.bind(this)
                }
            );

            logger.debug('ProfilePageManager mounted successfully');

        } catch (error) {
            this.handleError(error, 'mountProfilePageManager');
            throw error;
        }
    }

    // Handle status refresh after successful queue operation
    private async handleStatusRefresh(): Promise<void> {
        try {
            // Refresh user status
            await this.loadUserStatus();

            // Remount profile page manager with updated status
            if (this.profilePageManager) {
                this.mountProfilePageManager();
            }
        } catch (error) {
            logger.error('Failed to refresh status after queue operation:', error);
        }
    }
} 