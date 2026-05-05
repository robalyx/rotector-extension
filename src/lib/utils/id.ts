// Locally-unique id derived from the current timestamp plus randomness
// Stable for the lifetime of the page and not cryptographically random
export function generateLocalId(prefix?: string): string {
	const id = `${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`;
	return prefix ? `${prefix}-${id}` : id;
}
