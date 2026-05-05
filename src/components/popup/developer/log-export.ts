import { get } from 'svelte/store';
import type { LogExport, SystemInfo } from '@/lib/types/developer-logs';
import { developerLogs } from '@/lib/stores/developer-logs';
import { getStorage } from '@/lib/utils/storage';

async function getSystemInfo(): Promise<SystemInfo> {
	const manifest = browser.runtime.getManifest();
	const debugModeEnabled = await getStorage<boolean>('sync', 'debugModeEnabled', false);

	const matchers: Array<[string, RegExp]> = [
		['Edge', /Edg\/(\d+)/],
		['Chrome', /Chrome\/(\d+)/],
		['Firefox', /Firefox\/(\d+)/]
	];
	const ua = navigator.userAgent;
	const hit = matchers
		.map(([n, r]) => [n, r.exec(ua)?.[1]] as const)
		.find(([, v]) => v !== undefined);

	return {
		extensionVersion: manifest.version,
		browserName: hit?.[0] ?? 'Unknown',
		browserVersion: hit?.[1] ?? 'Unknown',
		timestamp: new Date().toISOString(),
		debugModeEnabled
	};
}

// Bundle current developer logs with system info for diagnostic export
export async function exportLogs(): Promise<LogExport> {
	const logs = get(developerLogs);
	const systemInfo = await getSystemInfo();

	return {
		systemInfo,
		logs,
		exportedAt: new Date().toISOString()
	};
}

// Format an export bundle as plain text for clipboard
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
		`=== Logs (${String(logs.length)} entries) ===`,
		''
	];

	for (const log of logs) {
		const time = new Date(log.timestamp).toISOString().slice(11, 23);
		lines.push(`[${time}] [${log.level.toUpperCase().padEnd(6)}] [${log.source}] ${log.message}`);

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
