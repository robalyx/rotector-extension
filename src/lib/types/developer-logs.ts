export const LOG_LEVELS = {
	ERROR: 'error',
	WARN: 'warn',
	INFO: 'info',
	DEBUG: 'debug',
	ACTION: 'action',
	API: 'api'
} as const;

export type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

export const LOG_SOURCES = {
	CONTENT: 'content',
	BACKGROUND: 'background',
	POPUP: 'popup'
} as const;

export type LogSource = (typeof LOG_SOURCES)[keyof typeof LOG_SOURCES];

export interface LogEntry {
	id: string;
	timestamp: number;
	level: LogLevel;
	source: LogSource;
	message: string;
	data?: unknown;
	pageUrl?: string | undefined;
}
