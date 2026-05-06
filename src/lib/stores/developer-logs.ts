import { STORAGE_KEYS } from '../types/constants';
import type { LogEntry } from '../types/developer-logs';
import { generateLocalId } from '../utils/id';
import { createPersistentListStore } from './persistent-list-store';

const {
	store: developerLogs,
	load: loadDeveloperLogs,
	add
} = createPersistentListStore<LogEntry>({
	storageKey: STORAGE_KEYS.DEVELOPER_LOGS,
	maxEntries: 1000
});

export { developerLogs, loadDeveloperLogs };

// ID is auto-generated and callers pass everything else
export async function addLogEntry(entry: Omit<LogEntry, 'id'>): Promise<void> {
	return add({ ...entry, id: generateLocalId() });
}
