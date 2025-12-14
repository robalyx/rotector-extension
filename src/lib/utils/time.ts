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
 * Formats an ISO date string to a compact duration showing how long it's been active
 */
export function formatActiveDuration(dateString: string): string {
	const date = new Date(dateString);
	if (isNaN(date.getTime())) return '0m';

	const now = new Date();
	const diffMs = now.getTime() - date.getTime();

	if (diffMs < 0) return '0m';

	const diffMinutes = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffMinutes < 1) {
		return '< 1m';
	} else if (diffMinutes < 60) {
		return `${diffMinutes}m`;
	} else if (diffHours < 24) {
		return `${diffHours}h`;
	} else {
		return `${diffDays}d`;
	}
}
