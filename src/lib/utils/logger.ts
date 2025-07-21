import { SETTINGS_DEFAULTS } from '../types/settings';

/**
 * Logger utility that respects debug mode settings
 */
class Logger {
  private debugEnabled: boolean = false;

  constructor() {
    // Initialize debug mode from storage in the background
    this.initializeDebugMode();

    // Listen for storage changes
    browser.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && changes.debugModeEnabled) {
        this.debugEnabled = changes.debugModeEnabled.newValue || false;
        console.log('[Rotector] Debug mode changed to:', this.debugEnabled);
      }
    });
  }

  // Initialize debug mode from browser storage
  private async initializeDebugMode(): Promise<void> {
    try {
      const result = await browser.storage.sync.get('debugModeEnabled');
      this.debugEnabled = result.debugModeEnabled || SETTINGS_DEFAULTS.debugModeEnabled || false;
      if (this.debugEnabled) {
        console.log('[Rotector] Debug mode is enabled');
      }
    } catch (error) {
      console.warn('[Rotector] Could not initialize debug mode from storage', error);
      this.debugEnabled = false;
    }
  }

  // Formats a log message with timestamp and prefix
  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
    return `[${timestamp}] [${level}] Rotector Extension: ${message}`;
  }

  // Logs an error message (always shown)
  error(message: string, ...data: unknown[]): void {
    console.error(this.formatMessage('ERROR', message), ...data);
  }

  // Logs a warning message (always shown)
  warn(message: string, ...data: unknown[]): void {
    console.warn(this.formatMessage('WARN', message), ...data);
  }

  // Logs an info message (shown when debug enabled)
  info(message: string, ...data: unknown[]): void {
    if (this.debugEnabled) {
      console.log(this.formatMessage('INFO', message), ...data);
    }
  }

  // Logs debug message (shown when debug enabled)
  debug(message: string, ...data: unknown[]): void {
    if (this.debugEnabled) {
      console.log(this.formatMessage('DEBUG', message), ...data);
    }
  }

  // Logs user interaction events
  userAction(action: string, data?: Record<string, unknown>): void {
    const message = `User Action: ${action}`;
    if (this.debugEnabled) {
      if (data) {
        console.log(this.formatMessage('ACTION', message), data);
      } else {
        console.log(this.formatMessage('ACTION', message));
      }
    }
  }

  // Logs API request/response information
  apiCall(method: string, url: string, status?: number, duration?: number): void {
    const message = `API ${method} ${url}`;
    if (status !== undefined) {
      const statusMessage = `${message} - ${status}`;
      if (duration !== undefined) {
        this.debug(`${statusMessage} (${duration}ms)`);
      } else {
        this.debug(statusMessage);
      }
    } else {
      this.debug(message);
    }
  }
}

// Export singleton instance
export const logger = new Logger();