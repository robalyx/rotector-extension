// Log severity levels
export const LOG_LEVELS = {
	ERROR: 'error',
	WARN: 'warn',
	INFO: 'info',
	DEBUG: 'debug',
	ACTION: 'action',
	API: 'api'
} as const;

export type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

// Context where the log originated
export const LOG_SOURCES = {
	CONTENT: 'content',
	BACKGROUND: 'background',
	POPUP: 'popup'
} as const;

export type LogSource = (typeof LOG_SOURCES)[keyof typeof LOG_SOURCES];

// Individual log entry
export interface LogEntry {
	id: string;
	timestamp: number;
	level: LogLevel;
	source: LogSource;
	message: string;
	data?: unknown;
	pageUrl?: string;
}

// System information included in log exports
export interface SystemInfo {
	extensionVersion: string;
	browserName: string;
	browserVersion: string;
	timestamp: string;
	debugModeEnabled: boolean;
}

// Full export format for clipboard
export interface LogExport {
	systemInfo: SystemInfo;
	logs: LogEntry[];
	exportedAt: string;
}
