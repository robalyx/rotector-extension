export type EngineStatus = keyof typeof ENGINE_STATUS_KEY;

export const ENGINE_STATUS_BY_COMPAT: Record<string, Exclude<EngineStatus, 'unknown'>> = {
	current: 'latest',
	compatible: 'behind-minor',
	outdated: 'behind-major'
};

export const ENGINE_STATUS_KEY = {
	latest: 'engine_status_latest',
	'behind-minor': 'engine_status_compatible',
	'behind-major': 'engine_status_outdated',
	unknown: 'engine_status_unknown'
} as const;
