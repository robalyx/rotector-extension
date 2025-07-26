import { PageController } from './PageController';
import { COMPONENT_CLASSES, USER_ACTIONS } from '../types/constants';
import { SETTINGS_KEYS } from '../types/settings';
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
      // Sources to check for user ID  
      const urlParams = new URLSearchParams(window.location.search);
      const sources = [
        { source: 'targetId URL parameter', getValue: () => urlParams.get('targetId') },
        { source: 'id URL parameter', getValue: () => urlParams.get('id') },
        { source: 'form field', getValue: () => (this.findElement('#Id') as HTMLInputElement)?.value }
      ];

      for (const { source, getValue } of sources) {
        const value = getValue();
        if (value) {
          const sanitized = sanitizeUserId(value);
          if (sanitized) {
            logger.debug(`User ID extracted from ${source}`, { userId: sanitized });
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

  // Find and validate required form elements
  private findFormElements(): { categoryButton: HTMLButtonElement; commentTextarea: HTMLTextAreaElement } {
    const categoryButton = this.findElement('.foundation-web-dropdown-trigger') as HTMLButtonElement;
    const commentTextarea = this.findElement('.free-comment-component textarea') as HTMLTextAreaElement;

    if (!categoryButton || !commentTextarea) {
      logger.error('Could not find report form elements');
      throw new Error('Could not find report form elements');
    }

    return { categoryButton, commentTextarea };
  }

  // Wait for dropdown and select the Inappropriate Language category
  private async selectInappropriateLanguageCategory(): Promise<void> {
    try {
      // Wait for dropdown to open
      let attempts = 0;
      let isDropdownOpen = false;
      
      while (attempts < 10 && !isDropdownOpen) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const categoryButton = this.findElement('.foundation-web-dropdown-trigger') as HTMLButtonElement;
        isDropdownOpen = categoryButton?.getAttribute('aria-expanded') === 'true';
        attempts++;
      }

      if (!isDropdownOpen) {
        logger.warn('Dropdown did not open after waiting');
        return;
      }

      // Find the Inappropriate Language option
      const inappropriateLanguageOption = Array.from(document.querySelectorAll('[role="option"]'))
        .find(option => {
          const textElement = option.querySelector('span');
          return textElement?.textContent?.includes('Inappropriate Language');
        }) as HTMLElement;

      if (inappropriateLanguageOption) {
        inappropriateLanguageOption.click();
        logger.debug('Selected Inappropriate Language category');
      } else {
        logger.warn('Could not find Inappropriate Language category option');
      }
    } catch (error) {
      logger.error('Failed to select category:', error);
    }
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
      const formContainer = this.findElement('.abuse-report-container');

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
      const { categoryButton, commentTextarea } = this.findFormElements();

      // Focus and use Enter key to open dropdown
      categoryButton.focus();
      categoryButton.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'Enter', 
        keyCode: 13, 
        bubbles: true 
      }));

      // Wait for dropdown to appear and select appropriate category
      await this.selectInappropriateLanguageCategory();

      // Build comment text
      let commentText = 'This user\'s profile contains inappropriate content that violates Roblox\'s Terms of Service.\n\n';

      // Get the profile violation reason
      const profileReason = this.userStatus?.reasons?.["0"];

      if (profileReason?.message) {
        commentText += `Detected Issue:\n${profileReason.message}\n\n`;
      }

      // Add evidence if advanced info is enabled
      const currentSettings = get(settings);
      if (currentSettings[SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED] && profileReason?.evidence) {
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
      commentTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });

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

      // Find the footer section
      const footer = this.findElement('.single-step-footer');
      if (!footer || !footer.parentNode) {
        logger.warn('Could not find footer to insert success message');
        return;
      }

      // Create success message element
      this.successMessageElement = document.createElement('div');
      this.successMessageElement.className = 'report-helper-success-message';
      this.successMessageElement.style.marginTop = '12px';
      this.successMessageElement.textContent = '✅ Form filled successfully! Category and comment have been set. Review and submit when ready.';

      // Insert after footer
      footer.parentNode.insertBefore(this.successMessageElement, footer.nextSibling);

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