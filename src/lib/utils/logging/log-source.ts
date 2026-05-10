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

// Returns a structured-clone-safe copy of value so log entries survive browser.storage.local.set on Firefox
function normalizeForClone(value: unknown, seen: WeakSet<object>): unknown {
	if (value === null || value === undefined) return value;
	if (typeof value === 'function') return '[Function]';
	if (typeof value === 'symbol') return value.toString();
	if (typeof value === 'bigint') return value.toString();
	if (typeof value !== 'object') return value;

	if (seen.has(value)) return '[Circular]';
	seen.add(value);

	if (value instanceof Error) {
		const out: Record<string, unknown> = {
			name: value.name,
			message: value.message,
			stack: value.stack
		};
		for (const [k, v] of Object.entries(value)) {
			if (k in out) continue;
			out[k] = normalizeForClone(v, seen);
		}
		return out;
	}
	if (typeof Node !== 'undefined' && value instanceof Node) {
		return `[Node: ${value.nodeName}]`;
	}
	if (Array.isArray(value)) {
		return value.map((v) => normalizeForClone(v, seen));
	}

	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value)) {
		out[k] = normalizeForClone(v, seen);
	}
	return out;
}

// Stringifies and truncates an arbitrary log payload, returning a clone-safe value for storage IPC
export function truncateForLog(data: unknown, maxLength: number): unknown {
	const normalized = normalizeForClone(data, new WeakSet());
	if (normalized === undefined) return undefined;
	const json = JSON.stringify(normalized);
	if (json.length > maxLength) {
		return { _truncated: true, preview: `${json.slice(0, maxLength)}...` };
	}
	return normalized;
}
