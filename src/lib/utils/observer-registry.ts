import type { ObserverCount } from '../types/performance';

const IS_DEV = import.meta.env.USE_DEV_API === 'true';

export const OBSERVER_TYPES = {
	MUTATION: 'mutation',
	RESIZE: 'resize'
} as const;

type ObserverType = (typeof OBSERVER_TYPES)[keyof typeof OBSERVER_TYPES];

// Registry singleton to track active observer instances
class ObserverRegistry {
	private counts: Record<ObserverType, number> = {
		mutation: 0,
		resize: 0
	};

	register(type: ObserverType): void {
		if (!IS_DEV) return;
		this.counts[type]++;
	}

	unregister(type: ObserverType): void {
		if (!IS_DEV) return;
		this.counts[type] = Math.max(0, this.counts[type] - 1);
	}

	getCounts(): ObserverCount {
		return {
			mutation: this.counts.mutation,
			resize: this.counts.resize,
			total: this.counts.mutation + this.counts.resize
		};
	}

	reset(): void {
		this.counts = { mutation: 0, resize: 0 };
	}
}

export const observerRegistry = new ObserverRegistry();
