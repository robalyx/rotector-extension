export type HoverPopoverKind =
	| 'cross-signal'
	| 'outfit-only'
	| 'reviewer-anonymous'
	| 'trap-info'
	| 'discord-info'
	| 'trapv2-info'
	| 'trap3-info'
	| 'matchmaking-info'
	| 'monitor-info'
	| 'purchase-info'
	| 'listdata-info'
	| 'gamedata-info'
	| 'ferns-info';

interface SourceInfoEntry {
	kind: HoverPopoverKind;
	titleKey: string;
	messageKey: string;
}

export interface HoverPopoverInstance {
	show: (anchor: HTMLElement, kind: HoverPopoverKind) => void;
	scheduleClose: () => void;
	cancelClose: () => void;
	markSeen: (kind: HoverPopoverKind) => void;
}

export const SOURCE_INFO_MAP: Record<string, SourceInfoEntry> = {
	discord: {
		kind: 'discord-info',
		titleKey: 'tooltip_discord_info_title',
		messageKey: 'tooltip_discord_info_message'
	},
	ferns: {
		kind: 'ferns-info',
		titleKey: 'tooltip_ferns_info_title',
		messageKey: 'tooltip_ferns_info_message'
	},
	gamedata: {
		kind: 'gamedata-info',
		titleKey: 'tooltip_gamedata_info_title',
		messageKey: 'tooltip_gamedata_info_message'
	},
	listdata: {
		kind: 'listdata-info',
		titleKey: 'tooltip_listdata_info_title',
		messageKey: 'tooltip_listdata_info_message'
	},
	matchmaking: {
		kind: 'matchmaking-info',
		titleKey: 'tooltip_matchmaking_info_title',
		messageKey: 'tooltip_matchmaking_info_message'
	},
	monitor: {
		kind: 'monitor-info',
		titleKey: 'tooltip_monitor_info_title',
		messageKey: 'tooltip_monitor_info_message'
	},
	purchase: {
		kind: 'purchase-info',
		titleKey: 'tooltip_purchase_info_title',
		messageKey: 'tooltip_purchase_info_message'
	},
	trap: {
		kind: 'trap-info',
		titleKey: 'tooltip_trap_info_title',
		messageKey: 'tooltip_trap_info_message'
	},
	trap3: {
		kind: 'trap3-info',
		titleKey: 'tooltip_trap3_info_title',
		messageKey: 'tooltip_trap3_info_message'
	},
	trapv2: {
		kind: 'trapv2-info',
		titleKey: 'tooltip_trapv2_info_title',
		messageKey: 'tooltip_trapv2_info_message'
	}
};
