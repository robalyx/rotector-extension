/**
 * Calculates the number of days that have elapsed since a Unix timestamp
 */
export function getDaysSinceTimestamp(timestamp: number): number {
	if (!timestamp) return 0;

	const date = new Date(timestamp * 1000); // Convert seconds to milliseconds
	if (isNaN(date.getTime())) return 0;

	const now = new Date();

	const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	const diffTime = nowOnly.getTime() - dateOnly.getTime();
	return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * Formats a Unix timestamp (in seconds) to relative time text
 */
export function formatTimestamp(timestamp: number): string {
	const date = new Date(timestamp * 1000); // Convert seconds to milliseconds
	if (isNaN(date.getTime())) return 'unknown time';

	const now = new Date();
	const diffMs = now.getTime() - date.getTime();

	if (diffMs < 0) return 'just now';

	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffSeconds < 60) {
		return 'just now';
	} else if (diffMinutes < 60) {
		return `${diffMinutes}m ago`;
	} else if (diffHours < 24) {
		return `${diffHours}h ago`;
	} else if (diffDays < 7) {
		return `${diffDays}d ago`;
	} else {
		const currentYear = now.getFullYear();
		const dateYear = date.getFullYear();

		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: dateYear !== currentYear ? 'numeric' : undefined
		});
	}
}

/**
 * Gets the duration between two Unix timestamps (in seconds) in a human-readable format
 */
export function getProcessingDuration(queuedAt: number, processedAt: number): string {
	if (!queuedAt || !processedAt || processedAt <= queuedAt) return '';

	const durationSeconds = processedAt - queuedAt;
	const durationMinutes = Math.floor(durationSeconds / 60);
	const durationHours = Math.floor(durationMinutes / 60);

	if (durationSeconds < 60) {
		return durationSeconds === 1 ? '1s' : `${durationSeconds}s`;
	} else if (durationMinutes < 60) {
		return durationMinutes === 1 ? '1m' : `${durationMinutes}m`;
	} else {
		const remainingMinutes = durationMinutes % 60;
		if (remainingMinutes === 0) {
			return durationHours === 1 ? '1h' : `${durationHours}h`;
		} else {
			return `${durationHours}h ${remainingMinutes}m`;
		}
	}
}

/**
 * Gets the duration since a timestamp
 */
export function getDurationSince(timestamp: number): string {
	const now = Math.floor(Date.now() / 1000); // Convert to seconds
	return getProcessingDuration(timestamp, now);
}

/**
 * Formats a Unix timestamp to a short date string (e.g., "Jan 1" or "Jan 1, 2024" if different year)
 */
export function formatShortDate(timestamp: number | null): string | null {
	if (!timestamp) return null;
	const date = new Date(timestamp * 1000);
	if (isNaN(date.getTime())) return null;

	const now = new Date();
	const dateYear = date.getFullYear();
	const currentYear = now.getFullYear();

	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: dateYear !== currentYear ? 'numeric' : undefined
	});
}

/**
 * Formats a Unix timestamp to a complete date and time string
 */
export function formatExactTimestamp(timestamp: number): string {
	const date = new Date(timestamp * 1000); // Convert seconds to milliseconds
	if (isNaN(date.getTime())) return 'unknown time';

	return date.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
}

/**
 * Formats milliseconds to a human-readable duration string
 */
export function formatDurationMs(ms: number): string {
	if (ms < 1) return '<1ms';
	if (ms < 1000) return `${ms.toFixed(1)}ms`;
	return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Formats a timestamp to time-of-day string (HH:MM:SS)
 */
export function formatTimeOfDay(timestamp: number): string {
	return new Date(timestamp).toISOString().slice(11, 19);
}
