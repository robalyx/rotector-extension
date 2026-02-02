import { derived, get, writable } from 'svelte/store';
import {
	LOG_LEVELS,
	type LogEntry,
	type LogExport,
	type LogLevel,
	type SystemInfo
} from '../types/developer-logs';

const DEVELOPER_LOGS_KEY = 'developerLogs';
const MAX_LOG_ENTRIES = 500;

let writeQueue = Promise.resolve();

export const developerLogs = writable<LogEntry[]>([]);

export const errorLogs = derived(developerLogs, ($logs) =>
	$logs.filter((log) => log.level === LOG_LEVELS.ERROR)
);

export const warningLogs = derived(developerLogs, ($logs) =>
	$logs.filter((log) => log.level === LOG_LEVELS.WARN)
);

// Load logs from session storage
export async function loadDeveloperLogs(): Promise<void> {
	try {
		const result = await browser.storage.session.get([DEVELOPER_LOGS_KEY]);
		const stored = result[DEVELOPER_LOGS_KEY] as LogEntry[] | undefined;
		developerLogs.set(stored ?? []);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn('[Rotector] Failed to load developer logs:', error);
		developerLogs.set([]);
	}
}

// Save logs to session storage
async function saveDeveloperLogs(entries: LogEntry[]): Promise<void> {
	try {
		await browser.storage.session.set({ [DEVELOPER_LOGS_KEY]: entries });
		developerLogs.set(entries);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn('[Rotector] Failed to save developer logs:', error);
	}
}

// Add a new log entry
export async function addLogEntry(entry: Omit<LogEntry, 'id'>): Promise<void> {
	const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const newEntry: LogEntry = { ...entry, id };

	writeQueue = writeQueue.then(async () => {
		// Read latest from storage to avoid overwriting concurrent writes
		const result = await browser.storage.session.get([DEVELOPER_LOGS_KEY]);
		const current = (result[DEVELOPER_LOGS_KEY] as LogEntry[] | undefined) ?? [];
		const updated = [newEntry, ...current].slice(0, MAX_LOG_ENTRIES);
		await saveDeveloperLogs(updated);
	});

	return writeQueue;
}

// Clear all logs
export async function clearDeveloperLogs(): Promise<void> {
	await saveDeveloperLogs([]);
}

// Collect system information for export
async function getSystemInfo(): Promise<SystemInfo> {
	const manifest = browser.runtime.getManifest();
	const settings = await browser.storage.sync.get(['debugModeEnabled']);

	// Parse browser info from user agent
	const ua = navigator.userAgent;
	let browserName = 'Unknown';
	let browserVersion = 'Unknown';

	const chromeMatch = /Chrome\/(\d+)/.exec(ua);
	const firefoxMatch = /Firefox\/(\d+)/.exec(ua);
	const edgeMatch = /Edg\/(\d+)/.exec(ua);

	if (edgeMatch) {
		browserName = 'Edge';
		browserVersion = edgeMatch[1];
	} else if (chromeMatch) {
		browserName = 'Chrome';
		browserVersion = chromeMatch[1];
	} else if (firefoxMatch) {
		browserName = 'Firefox';
		browserVersion = firefoxMatch[1];
	}

	return {
		extensionVersion: manifest.version,
		browserName,
		browserVersion,
		timestamp: new Date().toISOString(),
		debugModeEnabled: Boolean(settings.debugModeEnabled)
	};
}

// Export logs with system info
export async function exportLogs(): Promise<LogExport> {
	const logs = get(developerLogs);
	const systemInfo = await getSystemInfo();

	return {
		systemInfo,
		logs,
		exportedAt: new Date().toISOString()
	};
}

// Format log level for display
function formatLevel(level: LogLevel): string {
	return level.toUpperCase().padEnd(6);
}

// Format logs as plain text for clipboard
export function formatLogsForCopy(exportData: LogExport): string {
	const { systemInfo, logs } = exportData;

	const lines: string[] = [
		'=== Rotector Extension Debug Log ===',
		'',
		'System Information:',
		`- Extension Version: ${systemInfo.extensionVersion}`,
		`- Browser: ${systemInfo.browserName} ${systemInfo.browserVersion}`,
		`- Debug Mode: ${systemInfo.debugModeEnabled ? 'Enabled' : 'Disabled'}`,
		`- Exported: ${systemInfo.timestamp}`,
		'',
		`=== Logs (${logs.length} entries) ===`,
		''
	];

	for (const log of logs) {
		const time = new Date(log.timestamp).toISOString().slice(11, 23);
		lines.push(`[${time}] [${formatLevel(log.level)}] [${log.source}] ${log.message}`);

		if (log.pageUrl) {
			lines.push(`URL: ${log.pageUrl}`);
		}

		if (log.data !== undefined) {
			try {
				const dataStr = JSON.stringify(log.data, null, 2);
				lines.push(`Data: ${dataStr}`);
			} catch {
				lines.push('Data: [Unable to serialize]');
			}
		}

		lines.push('');
	}

	return lines.join('\n');
}

// Listen for storage changes from other contexts
browser.storage.onChanged.addListener((changes, namespace) => {
	if (namespace === 'session' && changes[DEVELOPER_LOGS_KEY]) {
		const newValue = changes[DEVELOPER_LOGS_KEY].newValue as LogEntry[] | undefined;
		developerLogs.set(newValue ?? []);
	}
});
