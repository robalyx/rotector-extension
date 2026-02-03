/**
 * Formats bytes to human readable string (B, KB, MB)
 */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Formats a number with locale-specific thousand separators
 */
export function formatNumber(num: number | undefined): string {
	if (num === undefined || num === null) return '—';
	if (isNaN(num)) return '—';
	return num.toLocaleString();
}
