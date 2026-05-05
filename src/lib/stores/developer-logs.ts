import { derived } from 'svelte/store';
import { STORAGE_KEYS } from '../types/constants';
import { LOG_LEVELS, type LogEntry } from '../types/developer-logs';
import { generateLocalId } from '../utils/id';
import { createPersistentListStore } from './persistent-list-store';

const {
	store: developerLogsStore,
	load,
	add,
	clear
} = createPersistentListStore<LogEntry>({
	storageKey: STORAGE_KEYS.DEVELOPER_LOGS,
	maxEntries: 500
});

export const developerLogs = developerLogsStore;

export const errorLogs = derived(developerLogs, ($logs) =>
	$logs.filter((log) => log.level === LOG_LEVELS.ERROR)
);

export const warningLogs = derived(developerLogs, ($logs) =>
	$logs.filter((log) => log.level === LOG_LEVELS.WARN)
);

export const loadDeveloperLogs = load;

// ID is auto-generated and callers pass everything else
export async function addLogEntry(entry: Omit<LogEntry, 'id'>): Promise<void> {
	return add({ ...entry, id: generateLocalId() });
}

export const clearDeveloperLogs = clear;
