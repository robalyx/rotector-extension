export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${String(bytes)} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatNumber(num: number | undefined): string {
	if (num === undefined || isNaN(num)) return '—';
	return num.toLocaleString();
}

// Compact notation (256K, 3.4K, 1.2M) for hero displays
export function formatCompact(num: number | undefined): string {
	if (num === undefined || isNaN(num)) return '—';
	if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
	if (num >= 10_000) return `${String(Math.round(num / 1_000))}K`;
	if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
	return num.toString();
}

export function calculatePercentage(current: number, limit: number): number {
	if (limit <= 0) return 0;
	return Math.max(0, Math.min(100, Math.round((current / limit) * 100)));
}

export function formatCurrency(amount: number): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(Math.abs(amount));
}
