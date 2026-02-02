import { SETTINGS_DEFAULTS } from '../types/settings';
import { LOG_LEVELS, LOG_SOURCES, type LogLevel, type LogSource } from '../types/developer-logs';
import { addLogEntry } from '../stores/developer-logs';

const MAX_DATA_LENGTH = 1000;

/**
 * Logger utility that respects debug mode settings and writes to developer logs store
 */
class Logger {
	private debugEnabled: boolean = false;

	constructor() {
		// Initialize debug mode from storage in the background
		this.initializeDebugMode().catch((err) => {
			console.error('Failed to initialize debug mode:', err);
		});

		// Listen for storage changes
		browser.storage.onChanged.addListener((changes, namespace) => {
			if (namespace === 'sync' && changes.debugModeEnabled) {
				this.debugEnabled = Boolean(changes.debugModeEnabled.newValue);
				console.log('[Rotector] Debug mode changed to:', this.debugEnabled);
			}
		});
	}

	// Logs an error message
	error(message: string, ...data: unknown[]): void {
		console.error(this.formatMessage('ERROR', message), ...data);
		this.writeToStore(LOG_LEVELS.ERROR, message, data);
	}

	// Logs a warning message
	warn(message: string, ...data: unknown[]): void {
		console.warn(this.formatMessage('WARN', message), ...data);
		this.writeToStore(LOG_LEVELS.WARN, message, data);
	}

	// Logs an info message
	info(message: string, ...data: unknown[]): void {
		if (this.debugEnabled) {
			console.log(this.formatMessage('INFO', message), ...data);
			this.writeToStore(LOG_LEVELS.INFO, message, data);
		}
	}

	// Logs debug message
	debug(message: string, ...data: unknown[]): void {
		if (this.debugEnabled) {
			console.log(this.formatMessage('DEBUG', message), ...data);
			this.writeToStore(LOG_LEVELS.DEBUG, message, data);
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
			this.writeToStore(LOG_LEVELS.ACTION, message, data ? [data] : undefined);
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

	// Initialize debug mode from browser storage
	private async initializeDebugMode(): Promise<void> {
		try {
			const result = await browser.storage.sync.get('debugModeEnabled');
			this.debugEnabled = Boolean(result.debugModeEnabled ?? SETTINGS_DEFAULTS.debugModeEnabled);
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

	// Detect which context the logger is running in
	private getLogSource(): LogSource {
		if (typeof document === 'undefined') {
			return LOG_SOURCES.BACKGROUND;
		}

		if (window.location?.hostname?.includes('roblox.com')) {
			return LOG_SOURCES.CONTENT;
		}

		return LOG_SOURCES.POPUP;
	}

	// Serialize data safely for storage
	private serializeData(data: unknown[]): unknown {
		if (!data || data.length === 0) return undefined;

		try {
			// Flatten single-item arrays
			const toSerialize = data.length === 1 ? data[0] : data;
			const json = JSON.stringify(toSerialize);

			// Truncate if too large
			if (json.length > MAX_DATA_LENGTH) {
				return { _truncated: true, preview: `${json.slice(0, MAX_DATA_LENGTH)}...` };
			}

			return toSerialize;
		} catch {
			return { _error: 'Data not serializable' };
		}
	}

	// Write log entry to the developer logs store
	private writeToStore(level: LogLevel, message: string, data?: unknown[]): void {
		const source = this.getLogSource();
		const pageUrl = source === LOG_SOURCES.CONTENT ? window.location.href : undefined;

		addLogEntry({
			timestamp: Date.now(),
			level,
			source,
			message,
			data: data ? this.serializeData(data) : undefined,
			pageUrl
		}).catch(() => {
			// NOTE: We silently fail to prevent logging loops
		});
	}
}

// Export singleton instance
export const logger = new Logger();
