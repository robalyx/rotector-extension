// Roblox stores the logged-in user ID in localStorage as a quoted string
// e.g., localStorage.getItem('CachedUserId') returns '"123456789"'
export function getLoggedInUserId(): string | null {
	try {
		const cachedUserId = localStorage.getItem('CachedUserId');
		if (!cachedUserId) {
			return null;
		}

		// Remove surrounding quotes from the stored value
		const userId = cachedUserId.replace(/^"|"$/g, '');

		// Validate it's a numeric ID
		const parsed = parseInt(userId, 10);
		if (isNaN(parsed) || parsed <= 0) {
			return null;
		}

		return userId;
	} catch {
		return null;
	}
}
