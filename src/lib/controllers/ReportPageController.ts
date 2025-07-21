import { PageController } from './PageController';
import { COMPONENT_CLASSES, USER_ACTIONS } from '../types/constants';
import { userStatusService } from '../services/user-status-service';
import { sanitizeUserId } from '../utils/sanitizer';
import ReportHelper from '../../components/features/ReportHelper.svelte';
import type { UserStatus } from '../types/api';
import { logger } from '../utils/logger';
import { settings } from '../stores/settings';
import { get } from 'svelte/store';

/**
 * Handles Roblox report pages
 */
export class ReportPageController extends PageController {
  private userId: string | null = null;
  private userStatus: UserStatus | null = null;
  private reportHelper: { element: HTMLElement; cleanup: () => void } | null = null;
  private successMessageElement: HTMLElement | null = null;

  protected async initializePage(): Promise<void> {
    try {
      logger.debug('Initializing ReportPageController', { 
        pageType: this.pageType,
        url: this.url 
      });

      // Check if report helper is enabled
      const currentSettings = get(settings);
      if (!currentSettings.reportHelperEnabled) {
        logger.debug('Report helper is disabled in settings');
        return;
      }

      // Extract user ID from report page
      this.userId = await this.extractUserId();
      if (!this.userId) {
        logger.warn('Could not extract user ID from report page');
        return;
      }

      logger.debug('Report user ID extracted', { userId: this.userId });

      // Load user status
      await this.loadUserStatus();

      // Mount report helper if user is reportable
      await this.mountReportHelper();

      logger.debug('ReportPageController initialized successfully');

    } catch (error) {
      this.handleError(error, 'initializePage');
      throw error;
    }
  }

  // Extract user ID from report page
  private async extractUserId(): Promise<string | null> {
    try {
      // Try to get from hidden form field
      const idField = this.findElement('#Id') as HTMLInputElement;
      if (idField && idField.value) {
        const sanitized = sanitizeUserId(idField.value);
        if (sanitized) {
          logger.debug('User ID extracted from form field', { userId: sanitized });
          return sanitized.toString();
        }
      }

      // Try to get from URL parameter
      const urlParams = new URLSearchParams(window.location.search);
      const idParam = urlParams.get('id');
      if (idParam) {
        const sanitized = sanitizeUserId(idParam);
        if (sanitized) {
          logger.debug('User ID extracted from URL parameter', { userId: sanitized });
          return sanitized.toString();
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
      logger.debug('Loading user status for report page', { userId: this.userId });
      this.userStatus = await userStatusService.getStatus(this.userId);
      logger.debug('User status loaded for report page', { 
        userId: this.userId, 
        flagType: this.userStatus?.flagType,
        hasUserProfileViolations: this.hasUserProfileViolations()
      });
    } catch (error) {
      logger.error('Failed to load user status for report page:', error);
    }
  }

  // Check if user has profile violations (reason type 0)
  private hasUserProfileViolations(): boolean {
    if (!this.userStatus || !this.userStatus.reasons) {
      return false;
    }
    return "0" in this.userStatus.reasons;
  }

  // Mount report helper card on the page
  private async mountReportHelper(): Promise<void> {
    try {
      // Only show report helper if user has profile violations
      if (!this.userStatus || !this.hasUserProfileViolations()) {
        logger.debug('User has no profile violations, not showing report helper');
        return;
      }

      // Find the report form container
      const formContainer = this.findElement('#report-form') || 
                           this.findElement('.report-abuse-form') || 
                           this.findElement('#report-abuse-form') ||
                           this.findElement('.form-container');

      if (!formContainer) {
        logger.warn('Could not find report form container');
        return;
      }

      // Create container for report helper card
      const container = this.createComponentContainer(COMPONENT_CLASSES.REPORT_HELPER);
      container.style.marginBottom = '20px';

      // Insert before the form
      formContainer.parentNode?.insertBefore(container, formContainer);

      // Mount ReportHelper as a card
      if (this.userId) {
        this.reportHelper = this.mountComponent(
          ReportHelper,
          container,
          {
            isOpen: true,
            isCard: true, 
            userId: this.userId,
            status: this.userStatus,
            onFillForm: this.handleFillForm.bind(this),
            onClose: () => {} 
          }
        );
      }

      logger.debug('Report helper card mounted');

    } catch (error) {
      this.handleError(error, 'mountReportHelper');
    }
  }

  // Handle fill form button click
  private async handleFillForm(): Promise<void> {
    try {
      logger.userAction(USER_ACTIONS.REPORT_HELPER_AUTOFILL, { 
        userId: this.userId 
      });

      // Find form elements
      const categorySelect = this.findElement('#ReportCategory') as HTMLSelectElement;
      const commentTextarea = this.findElement('#Comment') as HTMLTextAreaElement;

      if (!categorySelect || !commentTextarea) {
        logger.error('Could not find report form elements');
        throw new Error('Could not find report form elements');
      }

      // Set category to "1" (Inappropriate Language - Profanity & Adult Content)
      categorySelect.value = '1';

      // Trigger change event on select
      const changeEvent = new Event('change', { bubbles: true });
      categorySelect.dispatchEvent(changeEvent);

      // Build comment text
      let commentText = 'This user\'s profile contains inappropriate content that violates Roblox\'s Terms of Service.\n\n';

      // Get the profile violation reason
      const profileReason = this.userStatus?.reasons?.["0"];

      if (profileReason?.message) {
        commentText += `Detected Issue:\n${profileReason.message}\n\n`;
      }

      // Add evidence if advanced info is enabled
      const currentSettings = get(settings);
      if (currentSettings.advancedViolationInfoEnabled && profileReason?.evidence) {
        commentText += 'Evidence Snippets:\n';
        profileReason.evidence.forEach((snippet: string, index: number) => {
          commentText += `${index + 1}. ${snippet}\n`;
        });
      }

      // Set comment text
      commentTextarea.value = commentText;

      // Trigger input event on textarea
      const inputEvent = new Event('input', { bubbles: true });
      commentTextarea.dispatchEvent(inputEvent);

      // Scroll form into view
      categorySelect.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Show success message
      this.showSuccessMessage();

      logger.debug('Report form filled successfully');

    } catch (error) {
      this.handleError(error, 'handleFillForm');
      throw error;
    }
  }

  // Show success message below the form
  private showSuccessMessage(): void {
    try {
      // Remove any existing success message
      if (this.successMessageElement) {
        this.successMessageElement.remove();
        this.successMessageElement = null;
      }

      // Find the submit group
      const submitGroup = this.findElement('.submit-group');
      if (!submitGroup || !submitGroup.parentNode) {
        logger.warn('Could not find submit group to insert success message');
        return;
      }

      // Create success message element
      this.successMessageElement = document.createElement('div');
      this.successMessageElement.className = 'report-helper-success-message';
      this.successMessageElement.style.cssText = `
        font-size: 13px;
        padding: 8px 12px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(34, 197, 94, 0.1);
        color: #22c55e;
        border: 1px solid rgba(34, 197, 94, 0.2);
        margin-top: 12px;
      `;
      this.successMessageElement.textContent = '✅ Form filled successfully! Review and submit when ready.';

      // Insert after submit group
      submitGroup.parentNode.insertBefore(this.successMessageElement, submitGroup.nextSibling);

      // Remove after 5 seconds
      setTimeout(() => {
        if (this.successMessageElement) {
          this.successMessageElement.remove();
          this.successMessageElement = null;
        }
      }, 5000);

    } catch (error) {
      logger.error('Failed to show success message:', error);
    }
  }

  /**
   * Page cleanup
   */
  protected async cleanupPage(): Promise<void> {
    try {
      // Cleanup report helper
      if (this.reportHelper) {
        this.reportHelper.cleanup();
        this.reportHelper = null;
      }

      // Cleanup success message
      if (this.successMessageElement) {
        this.successMessageElement.remove();
        this.successMessageElement = null;
      }

      // Reset state
      this.userId = null;
      this.userStatus = null;

      logger.debug('ReportPageController cleanup completed');
    } catch (error) {
      this.handleError(error, 'cleanupPage');
    }
  }
}