import { unmount, type mount } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { logger } from '../logging/logger';

type MountedComponent = ReturnType<typeof mount>;

// Tracks Svelte components mounted into ad-hoc DOM containers, with safe
// replace/remove/cleanup semantics. Replaces the SvelteMap+unmount boilerplate
// in page managers (UserListManager, GroupListManager, GroupMembersCarousel).
export class MountedComponentRegistry<K> {
	private readonly components = new SvelteMap<K, MountedComponent>();

	// Replace any existing component for `key` and store the new one
	set(key: K, component: MountedComponent): void {
		this.removeOne(key);
		this.components.set(key, component);
	}

	// Unmount and forget the component for `key`, if any
	removeOne(key: K): void {
		const existing = this.components.get(key);
		if (!existing) return;
		try {
			void unmount(existing);
		} catch (error) {
			logger.error('Failed to unmount component:', error);
		}
		this.components.delete(key);
	}

	// Unmount everything not present in `liveKeys`. Returns removed keys.
	removeOrphans(liveKeys: ReadonlySet<K>): K[] {
		const orphans: K[] = [];
		for (const key of this.components.keys()) {
			if (!liveKeys.has(key)) orphans.push(key);
		}
		for (const key of orphans) this.removeOne(key);
		return orphans;
	}

	// Unmount everything and reset the registry
	destroyAll(): void {
		for (const component of this.components.values()) {
			try {
				void unmount(component);
			} catch (error) {
				logger.error('Failed to unmount component:', error);
			}
		}
		this.components.clear();
	}

	has(key: K): boolean {
		return this.components.has(key);
	}
}
