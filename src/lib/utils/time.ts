// Timestamp is seconds, returns whole calendar days using local-midnight boundaries
export function getDaysSinceTimestamp(timestamp: number): number {
	if (!timestamp) return 0;

	const date = new Date(timestamp * 1000);
	if (Number.isNaN(date.getTime())) return 0;

	const now = new Date();

	const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	const diffTime = nowOnly.getTime() - dateOnly.getTime();
	return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

// Input is in seconds
export function formatTimestamp(timestamp: number): string {
	const date = new Date(timestamp * 1000);
	if (Number.isNaN(date.getTime())) return 'unknown time';

	const now = new Date();
	const diffMs = now.getTime() - date.getTime();

	if (diffMs < 60_000) return 'just now';

	const diffMinutes = Math.floor(diffMs / 60_000);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMinutes < 60) return `${String(diffMinutes)}m ago`;
	if (diffHours < 24) return `${String(diffHours)}h ago`;
	if (diffDays < 7) return `${String(diffDays)}d ago`;
	return formatShortDate(timestamp) ?? 'unknown time';
}

// Both timestamps in seconds
export function getProcessingDuration(queuedAt: number, processedAt: number): string {
	if (!queuedAt || !processedAt || processedAt <= queuedAt) return '';

	const durationSeconds = processedAt - queuedAt;
	const durationMinutes = Math.floor(durationSeconds / 60);
	const durationHours = Math.floor(durationMinutes / 60);

	if (durationSeconds < 60) return durationSeconds === 1 ? '1s' : `${String(durationSeconds)}s`;
	if (durationMinutes < 60) return durationMinutes === 1 ? '1m' : `${String(durationMinutes)}m`;
	const remainingMinutes = durationMinutes % 60;
	if (remainingMinutes === 0) return durationHours === 1 ? '1h' : `${String(durationHours)}h`;
	return `${String(durationHours)}h ${String(remainingMinutes)}m`;
}

// Timestamp is seconds, returns short form like 5m or 2h 10m versus current time
export function getDurationSince(timestamp: number): string {
	const now = Math.floor(Date.now() / 1000);
	return getProcessingDuration(timestamp, now);
}

export function formatShortDate(timestamp: number | null): string | null {
	if (!timestamp) return null;
	const date = new Date(timestamp * 1000);
	if (Number.isNaN(date.getTime())) return null;

	const now = new Date();
	const dateYear = date.getFullYear();
	const currentYear = now.getFullYear();

	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: dateYear === currentYear ? undefined : 'numeric'
	});
}

export function formatExactTimestamp(timestamp: number): string {
	const date = new Date(timestamp * 1000);
	if (Number.isNaN(date.getTime())) return 'unknown time';

	return date.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
}

export function formatDurationMs(ms: number): string {
	if (ms < 1) return '<1ms';
	if (ms < 1000) return `${ms.toFixed(1)}ms`;
	return `${(ms / 1000).toFixed(2)}s`;
}

export function formatTimeOfDay(timestamp: number): string {
	return new Date(timestamp).toISOString().slice(11, 19);
}
