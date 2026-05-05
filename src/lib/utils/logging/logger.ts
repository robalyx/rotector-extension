import { SETTINGS_DEFAULTS } from '../../types/settings';
import { LOG_LEVELS, LOG_SOURCES, type LogLevel } from '../../types/developer-logs';
import { addLogEntry } from '../../stores/developer-logs';
import { getLogSource, truncateForLog } from './log-source';
import { getStorage, subscribeStorageKey } from '../storage';

const MAX_DATA_LENGTH = 1000;

class Logger {
	private debugEnabled: boolean = false;

	constructor() {
		this.initializeDebugMode().catch((err: unknown) => {
			console.error('Failed to initialize debug mode:', err);
		});

		subscribeStorageKey<boolean>('sync', 'debugModeEnabled', (newValue) => {
			this.debugEnabled = !!newValue;
			console.log('[Rotector] Debug mode changed to:', this.debugEnabled);
		});
	}

	error(message: string, ...data: unknown[]): void {
		console.error(this.formatMessage('ERROR', message), ...data);
		this.writeToStore(LOG_LEVELS.ERROR, message, data);
	}

	warn(message: string, ...data: unknown[]): void {
		console.warn(this.formatMessage('WARN', message), ...data);
		this.writeToStore(LOG_LEVELS.WARN, message, data);
	}

	info(message: string, ...data: unknown[]): void {
		if (this.debugEnabled) {
			console.log(this.formatMessage('INFO', message), ...data);
			this.writeToStore(LOG_LEVELS.INFO, message, data);
		}
	}

	debug(message: string, ...data: unknown[]): void {
		if (this.debugEnabled) {
			console.log(this.formatMessage('DEBUG', message), ...data);
			this.writeToStore(LOG_LEVELS.DEBUG, message, data);
		}
	}

	userAction(action: string, data?: Record<string, unknown>): void {
		if (!this.debugEnabled) return;
		const message = `User Action: ${action}`;
		if (data) console.log(this.formatMessage('ACTION', message), data);
		else console.log(this.formatMessage('ACTION', message));
		this.writeToStore(LOG_LEVELS.ACTION, message, data ? [data] : undefined);
	}

	// Routed through debug() so requests only log when debugEnabled is set
	apiCall(method: string, url: string, status?: number, duration?: number): void {
		let msg = `API ${method} ${url}`;
		if (status !== undefined) {
			msg += ` - ${String(status)}`;
			if (duration !== undefined) msg += ` (${String(duration)}ms)`;
		}
		this.debug(msg);
	}

	private async initializeDebugMode(): Promise<void> {
		try {
			this.debugEnabled = await getStorage<boolean>(
				'sync',
				'debugModeEnabled',
				SETTINGS_DEFAULTS.debugModeEnabled
			);
			if (this.debugEnabled) {
				console.log('[Rotector] Debug mode is enabled');
			}
		} catch (error) {
			console.warn('[Rotector] Could not initialize debug mode from storage', error);
			this.debugEnabled = false;
		}
	}

	private formatMessage(level: string, message: string): string {
		const timestamp = new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
		return `[${timestamp}] [${level}] Rotector Extension: ${message}`;
	}

	private serializeData(data: unknown[]): unknown {
		if (data.length === 0) return undefined;

		try {
			const toSerialize = data.length === 1 ? data[0] : data;
			return truncateForLog(toSerialize, MAX_DATA_LENGTH);
		} catch {
			return { _error: 'Data not serializable' };
		}
	}

	private writeToStore(level: LogLevel, message: string, data?: unknown[]): void {
		const source = getLogSource();
		const pageUrl = source === LOG_SOURCES.CONTENT ? window.location.href : undefined;

		addLogEntry({
			timestamp: Date.now(),
			level,
			source,
			message,
			data: data ? this.serializeData(data) : undefined,
			pageUrl
		}).catch(() => {
			// Silent fail prevents logging loops
		});
	}
}

export const logger = new Logger();
