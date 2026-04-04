import { derived, get } from 'svelte/store';
import {
	LOG_LEVELS,
	type LogEntry,
	type LogExport,
	type LogLevel,
	type SystemInfo
} from '../types/developer-logs';
import { createPersistentListStore } from './persistent-list-store';

const {
	store: developerLogsStore,
	load,
	add,
	clear
} = createPersistentListStore<LogEntry>({
	storageKey: 'developerLogs',
	maxEntries: 500
});

export const developerLogs = developerLogsStore;

export const errorLogs = derived(developerLogs, ($logs) =>
	$logs.filter((log) => log.level === LOG_LEVELS.ERROR)
);

export const warningLogs = derived(developerLogs, ($logs) =>
	$logs.filter((log) => log.level === LOG_LEVELS.WARN)
);

export const loadDeveloperLogs = load;

// Add a new log entry with auto-generated ID
export async function addLogEntry(entry: Omit<LogEntry, 'id'>): Promise<void> {
	const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	return add({ ...entry, id });
}

export const clearDeveloperLogs = clear;

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
