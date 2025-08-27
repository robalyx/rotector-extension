import {PageController} from './PageController';
import {COMPONENT_CLASSES} from '../types/constants';
import {SETTINGS_KEYS} from '../types/settings';
import {userStatusService} from '../services/entity-status-service';
import {sanitizeEntityId} from '../utils/sanitizer';
import ReportPageManager from '../../components/features/ReportPageManager.svelte';
import type {UserStatus} from '../types/api';
import {logger} from '../utils/logger';
import {settings} from '../stores/settings';
import {get} from 'svelte/store';

/**
 * Handles Roblox report pages
 */
export class ReportPageController extends PageController {
    private userId: string | null = null;
    private userStatus: UserStatus | null = null;
    private reportPageManager: { element: HTMLElement; cleanup: () => void } | null = null;

    protected async initializePage(): Promise<void> {
        try {
            logger.debug('Initializing ReportPageController', {
                pageType: this.pageType,
                url: this.url
            });

            // Check if report helper is enabled
            const currentSettings = get(settings);
            if (!currentSettings[SETTINGS_KEYS.REPORT_HELPER_ENABLED]) {
                logger.debug('Report helper is disabled in settings');
                return;
            }

            // Extract user ID from report page
            this.userId = await this.extractUserId();
            if (!this.userId) {
                logger.warn('Could not extract user ID from report page');
                return;
            }

            logger.debug('Report user ID extracted', {userId: this.userId});

            // Load user status
            await this.loadUserStatus();

            // Mount report page manager
            await this.mountReportPageManager();

            logger.debug('ReportPageController initialized successfully');

        } catch (error) {
            this.handleError(error, 'initializePage');
            throw error;
        }
    }

    /**
     * Page cleanup
     */
    protected async cleanupPage(): Promise<void> {
        try {
            // Cleanup report page manager
            if (this.reportPageManager) {
                this.reportPageManager.cleanup();
                this.reportPageManager = null;
            }

            // Reset state
            this.userId = null;
            this.userStatus = null;

            logger.debug('ReportPageController cleanup completed');
        } catch (error) {
            this.handleError(error, 'cleanupPage');
        }
    }

    // Extract user ID from report page
    private async extractUserId(): Promise<string | null> {
        try {
            // Sources to check for user ID
            const urlParams = new URLSearchParams(window.location.search);
            const sources = [
                {source: 'targetId URL parameter', getValue: () => urlParams.get('targetId')},
                {source: 'id URL parameter', getValue: () => urlParams.get('id')},
                {source: 'form field', getValue: () => (this.findElement('#Id') as HTMLInputElement)?.value}
            ];

            for (const {source, getValue} of sources) {
                const value = getValue();
                if (value) {
                    const sanitized = sanitizeEntityId(value);
                    if (sanitized) {
                        logger.debug(`User ID extracted from ${source}`, {userId: sanitized});
                        return sanitized.toString();
                    }
                }
            }

            return null;
        } catch (error) {
            logger.error('Failed to extract user ID from report page:', error);
            return null;
        }
    }

    // Load user status from API
    private async loadUserStatus(): Promise<void> {
        if (!this.userId) return;

        try {
            logger.debug('Loading user status for report page', {userId: this.userId});
            this.userStatus = await userStatusService.getStatus(this.userId);
            logger.debug('User status loaded for report page', {
                userId: this.userId,
                flagType: this.userStatus?.flagType,
                hasProfileViolations: this.userStatus?.reasons && "0" in this.userStatus.reasons
            });
        } catch (error) {
            logger.error('Failed to load user status for report page:', error);
        }
    }

    // Mount report page manager
    private async mountReportPageManager(): Promise<void> {
        try {
            if (!this.userId || !this.userStatus) {
                logger.debug('Missing userId or userStatus, not mounting ReportPageManager');
                return;
            }

            // Create container for report page manager
            const container = this.createComponentContainer(COMPONENT_CLASSES.REPORT_HELPER);

            // Mount ReportPageManager
            this.reportPageManager = this.mountComponent(
                ReportPageManager,
                container,
                {
                    userId: this.userId,
                    userStatus: this.userStatus
                }
            );

            logger.debug('ReportPageManager mounted successfully');

        } catch (error) {
            this.handleError(error, 'mountReportPageManager');
        }
    }
}