/**
 * Formats a date string into relative time text for display in notifications
 */
export function formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'today';
    
    const now = new Date();
    
    // Compare dates only, ignoring time
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = nowOnly.getTime() - dateOnly.getTime();
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    
    if (diffDays === 0) {
        return 'today';
    } else if (diffDays === 1) {
        return 'yesterday';
    } else {
        return `${diffDays} days ago`;
    }
}

/**
 * Calculates the number of days that have elapsed since a given date
 */
export function getDaysSince(dateString: string): number {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 0;
    
    const now = new Date();
    
    // Calculate days difference, ignoring time
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = nowOnly.getTime() - dateOnly.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}