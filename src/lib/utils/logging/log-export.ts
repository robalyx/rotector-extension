import { get } from 'svelte/store';
import { customApis } from '@/lib/stores/custom-apis';
import { developerLogs } from '@/lib/stores/developer-logs';
import { settings } from '@/lib/stores/settings';
import type { LogEntry } from '@/lib/types/developer-logs';
import { SETTINGS_KEYS } from '@/lib/types/settings';

const SENSITIVE_SETTING_KEYS = new Set<string>([SETTINGS_KEYS.API_KEY]);

interface SystemInfo {
	extensionVersion: string;
	browserName: string;
	browserVersion: string;
	timestamp: string;
	debugModeEnabled: boolean;
}

function getSystemInfo(): SystemInfo {
	const manifest = browser.runtime.getManifest();
	const debugModeEnabled = get(settings)[SETTINGS_KEYS.DEBUG_MODE_ENABLED];

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

function redactUrl(url: string): string {
	try {
		const u = new URL(url);
		return `${u.origin}${u.pathname}`;
	} catch {
		return '[invalid URL]';
	}
}

function formatSettingValue(value: unknown): string {
	if (value === undefined) return 'undefined';
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	if (Array.isArray(value)) return `[${String(value.length)} items]`;
	return '[object]';
}

function formatLogEntry(log: LogEntry): string[] {
	const time = new Date(log.timestamp).toISOString().slice(11, 23);
	const lines = [`[${time}] [${log.level.toUpperCase().padEnd(6)}] [${log.source}] ${log.message}`];

	if (log.pageUrl) lines.push(`URL: ${log.pageUrl}`);

	if (log.data !== undefined) {
		try {
			lines.push(`Data: ${JSON.stringify(log.data, null, 2)}`);
		} catch {
			lines.push('Data: [Unable to serialize]');
		}
	}

	lines.push('');
	return lines;
}

function buildReport(systemInfo: SystemInfo): string {
	const settingsSnapshot = get(settings);
	const apis = get(customApis);
	const logs = get(developerLogs);

	const lines: string[] = [
		'=== Rotector Extension Debug Log ===',
		'',
		'System Information:',
		`- Extension Version: ${systemInfo.extensionVersion}`,
		`- Browser: ${systemInfo.browserName} ${systemInfo.browserVersion}`,
		`- Debug Mode: ${systemInfo.debugModeEnabled ? 'Enabled' : 'Disabled'}`,
		`- Exported: ${systemInfo.timestamp}`,
		'',
		'Settings (snapshot):'
	];

	const settingEntries = Object.entries(settingsSnapshot).toSorted(([a], [b]) =>
		a.localeCompare(b)
	);
	for (const [key, value] of settingEntries) {
		if (SENSITIVE_SETTING_KEYS.has(key)) continue;
		lines.push(`- ${key}: ${formatSettingValue(value)}`);
	}

	lines.push('', `Custom APIs (${String(apis.length)}):`);
	if (apis.length === 0) {
		lines.push('- (none)');
	} else {
		for (const api of apis) {
			const flags = [api.isSystem ? 'system' : 'user', api.enabled ? 'enabled' : 'disabled'].join(
				', '
			);
			lines.push(`- ${api.name}  ${redactUrl(api.singleUrl)}  [${flags}]`);
		}
	}

	lines.push('', `=== Logs (${String(logs.length)} entries) ===`, '');
	for (const log of logs) lines.push(...formatLogEntry(log));

	return lines.join('\n');
}

export function downloadDebugLogs(): void {
	const systemInfo = getSystemInfo();
	const text = buildReport(systemInfo);

	const safeStamp = systemInfo.timestamp.replace(/\..+$/, '').replaceAll(':', '-');
	const filename = `rotector-debug-${safeStamp}.txt`;

	const blob = new Blob([text], { type: 'text/plain' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.append(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
