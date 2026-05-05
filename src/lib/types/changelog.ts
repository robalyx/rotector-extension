export interface ChangelogEntry {
	type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
	description: string;
	subpoints?: string[];
}

export interface Changelog {
	id: string;
	version: string;
	date: string;
	title: string;
	summary: string;
	changes: ChangelogEntry[];
}
