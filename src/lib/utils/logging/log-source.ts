import { LOG_SOURCES, type LogSource } from '../../types/developer-logs';

export const IS_DEV = import.meta.env.USE_DEV_API === 'true';

export function getLogSource(): LogSource {
	if (typeof document === 'undefined') {
		return LOG_SOURCES.BACKGROUND;
	}

	if (window.location.hostname.includes('roblox.com')) {
		return LOG_SOURCES.CONTENT;
	}

	return LOG_SOURCES.POPUP;
}

// Stringifies and truncates an arbitrary log payload to keep stored metrics small
export function truncateForLog(data: unknown, maxLength: number): unknown {
	const json = JSON.stringify(data);
	if (json.length > maxLength) {
		return { _truncated: true, preview: `${json.slice(0, maxLength)}...` };
	}
	return data;
}
