import { LOG_SOURCES, type LogSource } from '../types/developer-logs';

// Detect which extension context the code is running in
export function getLogSource(): LogSource {
	if (typeof document === 'undefined') {
		return LOG_SOURCES.BACKGROUND;
	}

	if (window.location?.hostname?.includes('roblox.com')) {
		return LOG_SOURCES.CONTENT;
	}

	return LOG_SOURCES.POPUP;
}
