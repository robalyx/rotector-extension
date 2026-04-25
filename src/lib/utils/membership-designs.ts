import type { MembershipTier, MembershipTierName } from '../types/api';

const BADGE_TIER_ALLOWLIST: Readonly<Record<MembershipTier, readonly number[]>> = {
	1: [0],
	2: [0, 1, 2, 3, 4],
	3: [0, 1, 2, 3, 4, 5, 6, 7]
};
const ICON_TIER_ALLOWLIST: Readonly<Record<MembershipTier, readonly number[]>> = {
	1: [0, 6],
	2: [0, 1, 2, 3, 4, 6],
	3: [0, 1, 2, 3, 4, 5, 6]
};
const TEXT_TIER_ALLOWLIST = BADGE_TIER_ALLOWLIST;

export const TIER_ALLOWLIST = {
	badge: BADGE_TIER_ALLOWLIST,
	icon: ICON_TIER_ALLOWLIST,
	text: TEXT_TIER_ALLOWLIST
} as const;

export type DesignAxis = keyof typeof TIER_ALLOWLIST;

const TIER_NAMES: Readonly<Record<MembershipTier, MembershipTierName>> = {
	1: 'Supporter',
	2: 'Patron',
	3: 'Benefactor'
};

export const BADGE_DESIGN_KEYS = [
	'plain',
	'nature',
	'imperial',
	'cosmic',
	'royal',
	'obsidian',
	'ice',
	'magma'
] as const;
export const ICON_DESIGN_KEYS = [
	'shield',
	'star',
	'banner',
	'heart',
	'bolt',
	'crown',
	'none'
] as const;
export const TEXT_DESIGN_KEYS = [
	'plain',
	'brackets',
	'stars',
	'chevrons',
	'guillemets',
	'dashes',
	'lozenges',
	'florette'
] as const;

const DESIGN_KEYS = {
	badge: BADGE_DESIGN_KEYS,
	icon: ICON_DESIGN_KEYS,
	text: TEXT_DESIGN_KEYS
} as const;

export type IconDesignKey = (typeof ICON_DESIGN_KEYS)[number];

interface DesignKeyFor {
	badge: (typeof BADGE_DESIGN_KEYS)[number];
	icon: IconDesignKey;
	text: (typeof TEXT_DESIGN_KEYS)[number];
}

// Coerce a stored design index to 0 when it isn't in the tier's allowlist
// (e.g. after a downgrade, or unknown tier numbers from the server)
export function resolveDesignIndex(stored: number, tier: MembershipTier, axis: DesignAxis): number {
	const allowed = TIER_ALLOWLIST[axis][tier];
	return allowed.includes(stored) ? stored : 0;
}

// Resolve the stored index to its design key string for the given axis
// (`as` narrows away the `undefined` that noUncheckedIndexedAccess adds to the lookup)
export function designKey<A extends DesignAxis>(
	stored: number,
	tier: MembershipTier,
	axis: A
): DesignKeyFor[A] {
	return DESIGN_KEYS[axis][resolveDesignIndex(stored, tier, axis)] as DesignKeyFor[A];
}

// Coerce unknown tier numbers to Supporter so the extension degrades gracefully on new server tiers
export function tierOf(raw: number): MembershipTier {
	return raw === 1 || raw === 2 || raw === 3 ? raw : 1;
}

// Human-readable tier name (coerced via tierOf)
export function tierNameOf(raw: number): MembershipTierName {
	return TIER_NAMES[tierOf(raw)];
}

// Lowest tier that unlocks a given index, for "Unlocks at Patron" hints on locked tiles
export function indexUnlockTierName(index: number, axis: DesignAxis): MembershipTierName | null {
	for (const tier of [1, 2, 3] as const) {
		if (TIER_ALLOWLIST[axis][tier].includes(index)) return TIER_NAMES[tier];
	}
	return null;
}
