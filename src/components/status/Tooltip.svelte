<script lang="ts">
	import { STATUS } from '@/lib/types/constants';
	import type { ReviewerInfo, UserStatus, VoteData } from '@/lib/types/api';
	import { logger } from '@/lib/utils/logger';
	import { extractErrorMessage, sanitizeEntityId } from '@/lib/utils/sanitizer';
	import { calculateStatusBadges } from '@/lib/utils/status-utils';
	import { apiClient } from '@/lib/services/api-client';
	import {
		outfitSnapshotService,
		type SnapshotKey,
		type SnapshotMaps
	} from '@/lib/services/outfit-snapshot-service';
	import { voteDataService } from '@/lib/services/vote-data-service';
	import { restrictedAccessStore } from '@/lib/stores/restricted-access';
	import { getLoggedInUserId } from '@/lib/utils/client-id';
	import {
		extractFlaggedOutfits,
		type FormattedReasonEntry,
		formatViolationReasons,
		groupSourceLines
	} from '@/lib/utils/violation-formatter';
	import {
		detectPageContext,
		extractGroupInfo,
		extractUserInfo,
		type GroupInfo,
		type UserInfo
	} from '@/lib/utils/page-detection';
	import {
		formatExactTimestamp,
		formatTimestamp,
		getDaysSinceTimestamp,
		getDurationSince,
		getProcessingDuration
	} from '@/lib/utils/time';
	import {
		applyTooltipPosition,
		calculateTooltipPosition,
		calculateTransformOrigin
	} from '@/lib/utils/tooltip-positioning';
	import { detectEncoding, makeDecoder } from '@/lib/utils/encoding-detector';
	import type { EncodingResult } from '@/lib/utils/encoding-detector';
	import MembershipPill from '../features/MembershipPill.svelte';
	import { tierNameOf, tierOf } from '@/lib/utils/membership-designs';
	import {
		User,
		CircleAlert,
		Flag,
		Shirt,
		Clock,
		LoaderCircle,
		Check,
		RefreshCw,
		Languages,
		FileText,
		Ban,
		Ellipsis,
		Link,
		Info,
		ChevronRight,
		ChevronDown,
		Lock,
		LockOpen
	} from '@lucide/svelte';
	import LoadingSpinner from '../ui/LoadingSpinner.svelte';
	import VotingWidget from './VotingWidget.svelte';
	import DiscordAccountsEvidence from './DiscordAccountsEvidence.svelte';
	import OutfitSnapshotLightbox from '../features/OutfitSnapshotLightbox.svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { get } from 'svelte/store';
	import { _, locale } from 'svelte-i18n';
	import { SETTINGS_KEYS, type SettingsKey } from '@/lib/types/settings';

	import type { CombinedStatus } from '@/lib/types/custom-api';
	import { ROTECTOR_API_ID } from '@/lib/stores/custom-apis';
	import { settings, updateSetting, removeSetting } from '@/lib/stores/settings';
	import { themeManager } from '@/lib/utils/theme';
	import { guardWatermark, renderWatermarkTile } from '@/lib/utils/watermark';

	const effectiveTheme = themeManager.effectiveTheme;

	const TOOLTIP_SIZE = {
		MIN_WIDTH: 400,
		MIN_HEIGHT: 350,
		MAX_WIDTH_RATIO: 0.9,
		MAX_HEIGHT_RATIO: 0.9
	} as const;

	const PREVIEW_TOOLTIP_SIZE = {
		MIN_WIDTH: 200,
		MIN_HEIGHT: 150,
		MAX_WIDTH: 500,
		MAX_HEIGHT: 600
	} as const;

	const COMPACT_HEADER_MIN_WIDTH = 450;
	const MIN_EVIDENCE_DECODE_LENGTH = 20;
	const HOVER_POPOVER_OFFSET = 6;
	const HOVER_POPOVER_VIEWPORT_PADDING = 12;
	const HOVER_POPOVER_HIDE_DELAY = 80;

	type HoverPopoverKind =
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

	interface HoverPopoverState {
		anchor: HTMLElement;
		kind: HoverPopoverKind;
	}

	interface EvidenceDecodeEntry {
		encoding: EncodingResult;
		decoded: string;
	}

	const SOURCE_INFO_MAP: Record<
		string,
		{ kind: HoverPopoverKind; titleKey: string; messageKey: string }
	> = {
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

	interface Props {
		userId: string | number;
		userStatus?: CombinedStatus | null;
		error?: string | null;
		anchorElement: HTMLElement;
		mode?: 'preview' | 'expanded';
		entityType?: 'user' | 'group';
		onQueue?: (isReprocess?: boolean, userStatus?: UserStatus | null) => void;
		onViewOutfits?: (() => void) | undefined;
		onClose?: () => void;
		onExpand?: () => void;
		onMouseEnter?: () => void;
		onMouseLeave?: () => void;
		userUsername?: string | undefined;
		userDisplayName?: string | undefined;
		userAvatarUrl?: string | undefined;
	}

	interface HeaderMessage {
		full?: string;
		parts?: HeaderPart[];
	}

	interface HeaderPart {
		text: string;
		class?: string;
	}

	let {
		userId,
		userStatus = null,
		error = null,
		anchorElement,
		mode = 'preview',
		entityType = 'user',
		onQueue,
		onViewOutfits,
		onClose,
		onExpand,
		onMouseEnter,
		onMouseLeave,
		userUsername,
		userDisplayName,
		userAvatarUrl
	}: Props = $props();

	// Local state
	let tooltipRef = $state<HTMLElement>();
	let overlayRef = $state<HTMLElement>();
	let scrollContentRef = $state<HTMLElement>();
	let stickyHeaderRef = $state<HTMLElement>();
	let profileHeaderRef = $state<HTMLElement>();
	let hoverPopoverRef = $state<HTMLElement>();
	let voteData: VoteData | null = $state(null);
	let loadingVotes = $state(false);
	let voteError = $state<string | null>(null);
	let voteAccessDenied = $state(false);
	let userInfo: UserInfo | null = $state(null);
	let groupInfo: GroupInfo | null = $state(null);
	let activeTab = $state<string>(ROTECTOR_API_ID);
	let lastSelectedForUserId = $state<string | number | null>(null);
	let activeHoverPopover = $state<HoverPopoverState | null>(null);
	let hoverPopoverPosition = $state({ left: 0, top: 0 });

	const hintsSeen = $derived(new Set<string>($settings[SETTINGS_KEYS.INFO_POPOVER_HINTS_SEEN]));
	let hintWriteQueue: Promise<unknown> = Promise.resolve();

	// Outfit snapshot state
	let outfitSnapshotMaps: SnapshotMaps | null = $state(null);
	let loadingOutfitSnapshots = $state(false);
	let latestSnapshotLoadId = 0;
	let lightboxState = $state<{
		name: string;
		reason: string;
		confidence: number | null;
		primaryDataUrl: string | null;
		rawUrls: string[];
	} | null>(null);

	// Translation state
	let translationsMap = $state<Record<string, string>>({});
	let isTranslating = $state(false);
	let translationError = $state<string | null>(null);
	let showTranslated = $state(true);
	let translationAttempted = $state(false);

	// Expanded cipher originals
	let expandedOriginals = new SvelteSet<string>();

	// Options menu state
	let optionsMenuRef = $state<HTMLElement>();
	let showOptionsMenu = $state(false);
	let copySuccess = $state(false);

	// Resize state
	let isResizing = $state(false);
	let resizeStartPos = $state<{ x: number; y: number } | null>(null);
	let resizeStartSize = $state<{ width: number; height: number } | null>(null);
	let customWidth = $state<number | undefined>(undefined);
	let customHeight = $state<number | undefined>(undefined);
	let headerCompact = $state(false);
	let hoverPopoverHideTimeout: ReturnType<typeof setTimeout> | null = null;
	let hoverPopoverFrame: number | null = null;
	let previewPositionFrame: number | null = null;

	// Engine version status for options menu display
	const engineVersionStatus = $derived.by(() => {
		if (!activeUserStatus?.versionCompatibility) return 'unknown';
		const compatibility = activeUserStatus.versionCompatibility;
		if (compatibility === 'current') return 'latest';
		if (compatibility === 'compatible') return 'behind-minor';
		if (compatibility === 'outdated') return 'behind-major';
		return 'deprecated';
	});

	// Check if any translations actually differ from originals
	const hasActualTranslations = $derived.by(() => {
		if (Object.keys(translationsMap).length === 0) return false;

		return Object.entries(translationsMap).some(
			([original, translated]) => original !== translated
		);
	});

	// Get active status based on selected tab
	const activeStatus = $derived.by(() => {
		if (!userStatus) return null;

		const apiResult = userStatus.get(activeTab);
		return apiResult?.data ?? null;
	});

	// Get active error based on selected tab
	const activeError = $derived.by(() => {
		if (!userStatus) return error;

		const apiResult = userStatus.get(activeTab);
		return apiResult?.error ?? error ?? null;
	});

	// Get active loading state based on selected tab
	const activeLoading = $derived.by(() => {
		if (!userStatus) return false;

		const apiResult = userStatus.get(activeTab);
		return apiResult?.loading ?? false;
	});

	// Get ordered tabs
	const tabs = $derived.by(() => {
		if (!userStatus) return [];

		return Array.from(userStatus.entries(), ([apiId, result]) => ({
			id: apiId,
			name: result.apiName,
			loading: result.loading,
			error: !!result.error && !result.data,
			noData: !result.loading && !result.error && !result.data,
			landscapeImageDataUrl: result.landscapeImageDataUrl
		}));
	});

	// Set default active tab
	$effect(() => {
		if (!userStatus) return;
		if (lastSelectedForUserId === userId) return;

		// Persisted user preference wins if available
		const preferredTab = get(settings).lastSelectedCustomApiTab;
		if (preferredTab && userStatus.has(preferredTab)) {
			activeTab = preferredTab;
			lastSelectedForUserId = userId;
			return;
		}

		// Smart selection requires all APIs to have settled
		const values = Array.from(userStatus.values());
		const allSettled = values.every((result) => !result.loading);
		if (!allSettled) return;

		const rotector = userStatus.get(ROTECTOR_API_ID);
		const allApisSafe = values.every(
			(result) => !result.data || result.data.flagType === STATUS.FLAGS.SAFE
		);

		if (rotector?.data?.flagType === STATUS.FLAGS.SAFE && userStatus.size > 1 && !allApisSafe) {
			const firstCustomWithDetection = Array.from(userStatus.entries()).find(
				([id, result]) =>
					id !== ROTECTOR_API_ID && result.data && result.data.flagType !== STATUS.FLAGS.SAFE
			);

			if (firstCustomWithDetection) {
				activeTab = firstCustomWithDetection[0];
				lastSelectedForUserId = userId;
				return;
			}
		}

		activeTab = ROTECTOR_API_ID;
		lastSelectedForUserId = userId;
	});

	// Computed values
	const sanitizedUserId = $derived.by(() => {
		const id = sanitizeEntityId(userId);
		return id ?? '';
	});

	const isGroup = $derived(entityType === 'group');

	// Type guard for UserStatus properties
	const activeUserStatus = $derived.by(() => {
		const status = activeStatus;
		return !isGroup && status ? (status as UserStatus) : null;
	});

	const flaggedOutfitLookups = $derived.by<SnapshotKey[]>(() => {
		if (isGroup) return [];
		const evidence = userStatus?.get(ROTECTOR_API_ID)?.data?.reasons['Avatar Outfit']?.evidence;
		if (!evidence || evidence.length === 0) return [];
		const keys: SnapshotKey[] = [];
		for (const info of extractFlaggedOutfits(evidence)) {
			if (info.outfitId !== null) keys.push({ kind: 'id', id: info.outfitId });
			else keys.push({ kind: 'name', name: info.name });
		}
		return keys;
	});

	// Signature for the current flagged-outfit set
	const flaggedOutfitNamesKey = $derived(
		flaggedOutfitLookups.length > 0
			? flaggedOutfitLookups
					.map((k) => (k.kind === 'id' ? `id:${k.id}` : `name:${k.name}`))
					.sort()
					.join('\x00')
			: ''
	);

	const shouldShowVoting = $derived(
		!isGroup &&
			!voteAccessDenied &&
			activeTab === ROTECTOR_API_ID && // Only show voting on Rotector tab
			activeUserStatus &&
			(activeUserStatus.flagType === STATUS.FLAGS.UNSAFE ||
				activeUserStatus.flagType === STATUS.FLAGS.PENDING ||
				activeUserStatus.flagType === STATUS.FLAGS.INTEGRATION ||
				activeUserStatus.flagType === STATUS.FLAGS.MIXED ||
				(activeUserStatus.flagType === STATUS.FLAGS.QUEUED && activeUserStatus.processed === true))
	);

	const isSafeUserWithQueueOnly = $derived(
		!isGroup &&
			activeTab === ROTECTOR_API_ID && // Only show queue on Rotector tab
			activeUserStatus &&
			(activeUserStatus.flagType === STATUS.FLAGS.SAFE ||
				(activeUserStatus.flagType === STATUS.FLAGS.QUEUED && activeUserStatus.processed === true))
	);

	const isQueuedSafe = $derived(
		isSafeUserWithQueueOnly &&
			activeUserStatus?.flagType === STATUS.FLAGS.QUEUED &&
			activeUserStatus.processed === true
	);

	// Minimal tooltip entities skip saved height (safe or queued)
	const isMinimalEntity = $derived(
		activeTab === ROTECTOR_API_ID &&
			activeStatus &&
			(activeStatus.flagType === STATUS.FLAGS.SAFE || activeStatus.flagType === STATUS.FLAGS.QUEUED)
	);

	let showSafeReasons = $state(false);

	// Queue cooldown check for recently processed users (3-day cooldown)
	const queueCooldownInfo = $derived.by(() => {
		if (!activeUserStatus?.processedAt) return { isInCooldown: false, daysRemaining: 0 };
		const daysSinceProcessed = getDaysSinceTimestamp(activeUserStatus.processedAt);
		const rawRemaining = 3 - daysSinceProcessed;
		const daysRemaining = Math.max(0, Math.ceil(rawRemaining));
		return {
			isInCooldown: rawRemaining > 0,
			daysRemaining
		};
	});

	const isExpanded = $derived(mode === 'expanded');

	// Check if access is restricted
	const isRestricted = $derived($restrictedAccessStore.isRestricted);

	// Check if this is a self-lookup
	const isSelfLookup = $derived.by(() => {
		if (isGroup) return false;
		const clientId = getLoggedInUserId();
		return clientId !== null && clientId === sanitizedUserId;
	});

	// Effective restricted state
	const effectivelyRestricted = $derived(
		activeError === 'restricted_access' ||
			(isRestricted && !isSelfLookup && !activeStatus && !activeLoading && !activeError)
	);

	// Batch resolved with this user omitted from the response
	const isNoData = $derived(
		!!userStatus && !activeLoading && !activeError && !effectivelyRestricted && !activeStatus
	);

	// Get custom API badges for active tab
	const customApiBadges = $derived.by(() => {
		if (activeTab === ROTECTOR_API_ID || isGroup || !userStatus) return [];

		const data = userStatus.get(activeTab)?.data;
		return data && 'badges' in data ? (data.badges ?? []) : [];
	});

	// Read from the Rotector entry directly so the membership pill stays visible
	// even when the user has a non-Rotector tab active
	const rotectorMembershipBadge = $derived.by(() => {
		if (isGroup || !userStatus) return null;
		const data = userStatus.get(ROTECTOR_API_ID)?.data;
		return data && 'membershipBadge' in data ? (data.membershipBadge ?? null) : null;
	});

	// Get header message from flag and confidence
	function getHeaderMessageFromFlag(
		flag: number,
		confidence = 0,
		currentStatus?: UserStatus | null
	): HeaderMessage {
		const entityType = $_(isGroup ? 'tooltip_entity_group' : 'tooltip_entity_user');

		switch (flag) {
			case STATUS.FLAGS.UNSAFE: {
				if (!isReviewed) {
					return {
						full: $_('tooltip_header_unsafe_auto', { values: { 0: entityType } })
					};
				}

				const prefix = $_('tooltip_header_unsafe_pre', { values: { 0: entityType } });
				const suffix = $_('tooltip_header_unsafe_suf', { values: { 0: entityType } });

				return {
					parts: [
						{ text: prefix },
						{ text: $_('tooltip_entity_moderators'), class: 'moderators-text' },
						{ text: suffix }
					]
				};
			}
			case STATUS.FLAGS.PENDING: {
				const confidencePercent = Math.round(confidence * 100);
				return {
					full: $_('tooltip_header_pending', {
						values: { 0: entityType, 1: confidencePercent.toString() }
					})
				};
			}
			case STATUS.FLAGS.QUEUED:
				// Check if processed to determine message
				if (currentStatus?.processed === true) {
					return { full: $_('tooltip_header_queued_safe', { values: { 0: entityType } }) };
				} else {
					return { full: $_('tooltip_header_queued_processing', { values: { 0: entityType } }) };
				}
			case STATUS.FLAGS.INTEGRATION:
				return { full: $_('tooltip_header_integration', { values: { 0: entityType } }) };
			case STATUS.FLAGS.MIXED:
				if (isGroup) {
					return { full: $_('tooltip_header_mixed_group') };
				} else {
					return { full: $_('tooltip_header_mixed_user') };
				}
			case STATUS.FLAGS.PAST_OFFENDER:
				return { full: $_('tooltip_header_past_offender', { values: { 0: entityType } }) };
			case STATUS.FLAGS.SAFE:
				return { full: $_('tooltip_header_safe', { values: { 0: entityType } }) };
			default:
				return { full: $_('tooltip_header_unavailable') };
		}
	}

	const headerMessage = $derived.by(() => {
		if (effectivelyRestricted) return { full: $_('tooltip_restricted_header') };
		if (activeError) return { full: $_('tooltip_error_details') };
		if (activeLoading || !userStatus) return { full: $_('tooltip_loading') };
		if (!activeStatus) return { full: $_('tooltip_no_data_available') };

		const currentStatus = activeStatus;
		const confidence = currentStatus.confidence || 0;

		switch (currentStatus.flagType) {
			case STATUS.FLAGS.SAFE:
			case STATUS.FLAGS.UNSAFE:
			case STATUS.FLAGS.PENDING:
			case STATUS.FLAGS.QUEUED:
			case STATUS.FLAGS.INTEGRATION:
			case STATUS.FLAGS.MIXED:
			case STATUS.FLAGS.PAST_OFFENDER:
				return getHeaderMessageFromFlag(currentStatus.flagType, confidence, activeUserStatus);
			default:
				return { full: $_('tooltip_header_unknown') };
		}
	});

	const statusBadgeClass = $derived.by(() => {
		const currentStatus = activeStatus;
		if (!currentStatus) return 'error';

		switch (currentStatus.flagType) {
			case STATUS.FLAGS.SAFE:
				return 'safe';
			case STATUS.FLAGS.UNSAFE:
				return 'unsafe';
			case STATUS.FLAGS.PENDING:
				return 'pending';
			case STATUS.FLAGS.QUEUED:
				return activeUserStatus?.processed === true ? 'safe' : 'pending';
			case STATUS.FLAGS.INTEGRATION:
				return 'integration';
			case STATUS.FLAGS.MIXED:
				return isGroup ? 'unsafe' : 'mixed';
			case STATUS.FLAGS.PAST_OFFENDER:
				return 'past-offender';
			default:
				return 'error';
		}
	});

	const statusBadgeText = $derived.by(() => {
		if (effectivelyRestricted) return $_('tooltip_restricted_title');
		const currentStatus = activeStatus;
		if (!currentStatus) return $_('tooltip_status_unknown');

		switch (currentStatus.flagType) {
			case STATUS.FLAGS.SAFE:
				return $_('tooltip_status_not_checked');
			case STATUS.FLAGS.UNSAFE:
				return $_('tooltip_status_unsafe');
			case STATUS.FLAGS.PENDING:
				return $_('tooltip_status_under_review');
			case STATUS.FLAGS.QUEUED:
				return activeUserStatus?.processed === true
					? $_('tooltip_status_not_flagged')
					: $_('tooltip_status_checking');
			case STATUS.FLAGS.INTEGRATION:
				return $_('tooltip_status_integration');
			case STATUS.FLAGS.MIXED:
				return $_('tooltip_status_mixed');
			case STATUS.FLAGS.PAST_OFFENDER:
				return $_('tooltip_status_past_offender');
			default:
				return $_('tooltip_status_unknown');
		}
	});

	const reasonEntries = $derived.by((): FormattedReasonEntry[] => {
		const currentStatus = activeStatus;
		if (!currentStatus?.reasons || currentStatus.flagType === STATUS.FLAGS.SAFE) return [];
		return formatViolationReasons(currentStatus.reasons);
	});

	// Decode map keyed by raw evidence content
	const evidenceEncodingMap = $derived.by(() => {
		const map = new SvelteMap<string, EvidenceDecodeEntry>();
		if (!$settings[SETTINGS_KEYS.CIPHER_DECODING_ENABLED]) return map;
		for (const reason of reasonEntries) {
			if (!reason.evidence) continue;
			for (const evidence of reason.evidence) {
				if (evidence.type !== 'regular') continue;
				if (evidence.content.trim().length < MIN_EVIDENCE_DECODE_LENGTH) continue;
				if (map.has(evidence.content)) continue;

				const result = detectEncoding(evidence.content);
				if (!result) continue;

				const decoded = makeDecoder(result)(evidence.content);
				if (decoded.trim() === evidence.content.trim()) continue;

				map.set(evidence.content, { encoding: result, decoded });
			}
		}
		return map;
	});

	// Check if auto-translation should be enabled
	const shouldAutoTranslate = $derived.by(() => {
		const translateEnabled = $settings[SETTINGS_KEYS.TRANSLATE_VIOLATIONS_ENABLED];
		const hasReasons = reasonEntries.length > 0;
		return translateEnabled && hasReasons;
	});

	// Resize config based on current tooltip mode
	function getResizeConfig() {
		if (isExpanded) {
			return {
				minWidth: TOOLTIP_SIZE.MIN_WIDTH,
				minHeight: TOOLTIP_SIZE.MIN_HEIGHT,
				maxWidth: window.innerWidth * TOOLTIP_SIZE.MAX_WIDTH_RATIO,
				maxHeight: window.innerHeight * TOOLTIP_SIZE.MAX_HEIGHT_RATIO,
				widthKey: SETTINGS_KEYS.EXPANDED_TOOLTIP_WIDTH as SettingsKey,
				heightKey: SETTINGS_KEYS.EXPANDED_TOOLTIP_HEIGHT as SettingsKey,
				sensitivity: 2
			};
		}
		return {
			minWidth: PREVIEW_TOOLTIP_SIZE.MIN_WIDTH,
			minHeight: PREVIEW_TOOLTIP_SIZE.MIN_HEIGHT,
			maxWidth: PREVIEW_TOOLTIP_SIZE.MAX_WIDTH,
			maxHeight: PREVIEW_TOOLTIP_SIZE.MAX_HEIGHT,
			widthKey: SETTINGS_KEYS.PREVIEW_TOOLTIP_WIDTH as SettingsKey,
			heightKey: SETTINGS_KEYS.PREVIEW_TOOLTIP_HEIGHT as SettingsKey,
			sensitivity: 1
		};
	}

	// Calculate constrained tooltip dimensions
	const tooltipDimensions = $derived.by(() => {
		const config = getResizeConfig();
		return {
			width: customWidth
				? Math.min(Math.max(customWidth, config.minWidth), config.maxWidth)
				: undefined,
			height:
				customHeight && !isMinimalEntity
					? Math.min(Math.max(customHeight, config.minHeight), config.maxHeight)
					: undefined
		};
	});

	// Two-column compact layout when tooltip is wide enough
	const showCompactColumns = $derived(
		headerCompact && (tooltipDimensions.width ?? TOOLTIP_SIZE.MIN_WIDTH) >= COMPACT_HEADER_MIN_WIDTH
	);

	// Get text to display
	function getDisplayText(originalText: string): string {
		if (!showTranslated) return originalText;
		return translationsMap[originalText] || originalText;
	}

	// Resolve decoded content, falling back to raw if no decode entry exists
	function getDecodedContent(content: string): string {
		return evidenceEncodingMap.get(content)?.decoded ?? content;
	}

	// Match Rotector's "Discord User ID: <id>" evidence lines
	function isDiscordIdEvidence(content: string): boolean {
		return getDecodedContent(content).trim().startsWith('Discord User ID');
	}

	// Chip label when decoded text is shown
	function getDecodedChipLabel(encoding: EncodingResult): string {
		switch (encoding.type) {
			case 'caesar':
				return $_('cipher_chip_decoded', { values: { shift: encoding.shift } });
			case 'morse':
				return $_('cipher_chip_decoded_morse');
			case 'morse+caesar':
				return $_('cipher_chip_decoded_morse_caesar', { values: { shift: encoding.shift } });
			case 'binary':
				return $_('cipher_chip_decoded_binary');
		}
	}

	// Chip label when original cipher text is shown
	function getDetectedChipLabel(encoding: EncodingResult): string {
		switch (encoding.type) {
			case 'caesar':
				return $_('cipher_chip_detected');
			case 'morse':
				return $_('cipher_chip_detected_morse');
			case 'morse+caesar':
				return $_('cipher_chip_detected_morse_caesar');
			case 'binary':
				return $_('cipher_chip_detected_binary');
		}
	}

	// Toggle cipher original visibility
	function toggleOriginal(content: string) {
		if (expandedOriginals.has(content)) {
			expandedOriginals.delete(content);
		} else {
			expandedOriginals.add(content);
		}
	}

	// Reviewer display info for current user status
	const reviewerInfo = $derived.by((): ReviewerInfo | null => {
		if (isGroup) return null;
		const currentStatus = activeUserStatus;
		if (!currentStatus?.reviewer) return null;
		return currentStatus.reviewer;
	});

	// Status badge text and CSS class for the active tab
	const badgeStatus = $derived.by(() => calculateStatusBadges(activeUserStatus));

	// Whether the cached status data is stale
	const isOutdated = $derived.by(() => {
		if (isGroup) return false;
		const currentStatus = activeUserStatus;
		if (!currentStatus?.lastUpdated) return false;
		const daysSince = getDaysSinceTimestamp(currentStatus.lastUpdated);
		return daysSince >= 7;
	});

	// Whether the status is reviewed by a moderator
	const isReviewed = $derived.by(() => {
		if (!activeStatus || activeStatus.flagType !== STATUS.FLAGS.UNSAFE) return false;
		return isGroup || !!activeUserStatus?.reviewer;
	});

	// Metadata information for processed users
	const metadataInfo = $derived.by(() => {
		if (isGroup || activeTab !== ROTECTOR_API_ID) return null;

		const currentStatus = activeUserStatus;
		if (!currentStatus) return null;

		const queuedAt = currentStatus.queuedAt;
		const processedAt = currentStatus.processedAt;
		const lastUpdated = currentStatus.lastUpdated;

		if (!queuedAt && !lastUpdated) return null;

		return {
			queuedTime: queuedAt ? formatTimestamp(queuedAt) : null,
			queuedExact: queuedAt ? formatExactTimestamp(queuedAt) : null,
			processedTime: processedAt ? formatTimestamp(processedAt) : null,
			processedExact: processedAt ? formatExactTimestamp(processedAt) : null,
			duration:
				queuedAt && processedAt
					? getProcessingDuration(queuedAt, processedAt)
					: queuedAt
						? getDurationSince(queuedAt)
						: null,
			isProcessing: queuedAt ? !processedAt : false,
			lastUpdatedTime: lastUpdated ? formatTimestamp(lastUpdated) : null,
			lastUpdatedExact: lastUpdated ? formatExactTimestamp(lastUpdated) : null
		};
	});

	// Get user info from props or extract from page DOM
	function getPageUserInfo(): UserInfo | null {
		const id = sanitizedUserId;
		if (!id) return null;

		if (userUsername || userDisplayName || userAvatarUrl) {
			return {
				userId: id,
				username: userUsername,
				displayName: userDisplayName,
				avatarUrl: userAvatarUrl
			};
		}

		const { pageType, container } = detectPageContext(anchorElement);
		return extractUserInfo(id, pageType, container);
	}

	// Extract group info from the page DOM
	function getPageGroupInfo(): GroupInfo | null {
		const groupId = sanitizedUserId;
		if (!groupId) return null;

		const { pageType, container } = detectPageContext(anchorElement);
		return extractGroupInfo(groupId, pageType, container);
	}

	// Positioning for preview tooltips
	function positionTooltip() {
		if (!tooltipRef || isExpanded) return;

		if (!anchorElement.isConnected) {
			onClose?.();
			return;
		}

		const position = calculateTooltipPosition(tooltipRef, anchorElement);
		applyTooltipPosition(tooltipRef, position);
	}

	function clearHoverPopoverHideTimeout() {
		if (hoverPopoverHideTimeout !== null) {
			clearTimeout(hoverPopoverHideTimeout);
			hoverPopoverHideTimeout = null;
		}
	}

	function clearHoverPopoverFrame() {
		if (hoverPopoverFrame !== null) {
			cancelAnimationFrame(hoverPopoverFrame);
			hoverPopoverFrame = null;
		}
	}

	function closeHoverPopover() {
		clearHoverPopoverHideTimeout();
		clearHoverPopoverFrame();
		activeHoverPopover = null;
	}

	function positionHoverPopover() {
		if (!activeHoverPopover || !hoverPopoverRef) return;

		const { anchor } = activeHoverPopover;
		if (!anchor.isConnected) {
			closeHoverPopover();
			return;
		}

		const anchorRect = anchor.getBoundingClientRect();
		const popoverWidth = hoverPopoverRef.offsetWidth;
		const popoverHeight = hoverPopoverRef.offsetHeight;

		if (!popoverWidth || !popoverHeight) return;

		const minLeft = HOVER_POPOVER_VIEWPORT_PADDING;
		const maxLeft = Math.max(minLeft, window.innerWidth - popoverWidth - minLeft);
		const belowTop = anchorRect.bottom + HOVER_POPOVER_OFFSET;
		const aboveTop = anchorRect.top - popoverHeight - HOVER_POPOVER_OFFSET;
		const fitsBelow =
			belowTop + popoverHeight <= window.innerHeight - HOVER_POPOVER_VIEWPORT_PADDING;
		const fitsAbove = aboveTop >= HOVER_POPOVER_VIEWPORT_PADDING;
		const left = Math.min(Math.max(anchorRect.right - popoverWidth, minLeft), maxLeft);
		let top = belowTop;

		if (!fitsBelow && fitsAbove) {
			top = aboveTop;
		}

		const minTop = HOVER_POPOVER_VIEWPORT_PADDING;
		const maxTop = Math.max(minTop, window.innerHeight - popoverHeight - minTop);

		hoverPopoverPosition = {
			left: Math.round(left),
			top: Math.round(Math.min(Math.max(top, minTop), maxTop))
		};
	}

	function queueHoverPopoverPosition() {
		if (hoverPopoverFrame !== null) return;

		hoverPopoverFrame = requestAnimationFrame(() => {
			hoverPopoverFrame = null;
			positionHoverPopover();
		});
	}

	function handleHoverPopoverTriggerEnter(kind: HoverPopoverKind, event: MouseEvent) {
		const anchor = event.currentTarget;
		if (!(anchor instanceof HTMLElement)) return;

		clearHoverPopoverHideTimeout();
		activeHoverPopover = { anchor, kind };
		queueHoverPopoverPosition();
		markInfoHintSeen(kind);
	}

	function markInfoHintSeen(kind: HoverPopoverKind) {
		if (hintsSeen.has(kind)) return;
		hintWriteQueue = hintWriteQueue
			.then(() => {
				const existing = $settings[SETTINGS_KEYS.INFO_POPOVER_HINTS_SEEN];
				if (existing.includes(kind)) return;
				return updateSetting(SETTINGS_KEYS.INFO_POPOVER_HINTS_SEEN, [...existing, kind]);
			})
			.catch((err: unknown) => {
				logger.error('Failed to mark info hint seen:', err);
			});
	}

	function scheduleHoverPopoverClose() {
		clearHoverPopoverHideTimeout();
		hoverPopoverHideTimeout = setTimeout(() => {
			hoverPopoverHideTimeout = null;
			activeHoverPopover = null;
		}, HOVER_POPOVER_HIDE_DELAY);
	}

	function handleHoverPopoverTriggerLeave() {
		scheduleHoverPopoverClose();
	}

	function handleHoverPopoverEnter() {
		clearHoverPopoverHideTimeout();
	}

	function handleHoverPopoverLeave() {
		scheduleHoverPopoverClose();
	}

	// Calculate transform-origin for expanded tooltip animation
	function getTransformOrigin() {
		return calculateTransformOrigin(anchorElement);
	}

	// Load vote data if needed
	async function loadVoteData() {
		if (!shouldShowVoting || loadingVotes || isSafeUserWithQueueOnly) return;

		loadingVotes = true;
		voteError = null;

		try {
			const votes = await voteDataService.getVoteData(sanitizedUserId);
			voteData = votes;
			logger.debug('Loaded vote data for user', { userId: sanitizedUserId, votes });
		} catch (err) {
			const structuredError = err as Error & { type?: string };
			if (structuredError.type === 'AbuseDetectionError') {
				voteAccessDenied = true;
				return;
			}
			voteError = 'Failed to load voting data';
			logger.error('Failed to load vote data:', err);
		} finally {
			loadingVotes = false;
		}
	}

	// Load R2 snapshot URLs for the currently flagged outfits
	async function loadOutfitSnapshots() {
		const loadId = ++latestSnapshotLoadId;
		loadingOutfitSnapshots = true;
		try {
			const maps = await outfitSnapshotService.getSnapshots(sanitizedUserId, flaggedOutfitLookups);
			if (loadId !== latestSnapshotLoadId) return;
			outfitSnapshotMaps = maps;
		} catch (err) {
			logger.error('Failed to load outfit snapshots:', err);
		} finally {
			if (loadId === latestSnapshotLoadId) {
				loadingOutfitSnapshots = false;
			}
		}
	}

	// Prefer id match, fall back to name (legacy 3-field evidence)
	function resolveSnapshot(outfitName: string, outfitId: string | null | undefined) {
		const byId = outfitId ? outfitSnapshotMaps?.byId.get(outfitId) : undefined;
		return byId ?? outfitSnapshotMaps?.byName.get(outfitName);
	}

	// Open the snapshot lightbox for a single outfit evidence item
	function openOutfitLightbox(
		outfitName: string,
		outfitReason: string,
		outfitConfidence: number | null,
		outfitId: string | null | undefined
	) {
		const result = resolveSnapshot(outfitName, outfitId);
		if (!result) return;
		lightboxState = {
			name: getDisplayText(outfitName),
			reason: getDisplayText(outfitReason),
			confidence: outfitConfidence,
			primaryDataUrl: result.primaryDataUrl,
			rawUrls: result.rawUrls
		};
	}

	// Handle vote submission
	async function handleVoteSubmit(voteType: number) {
		if (loadingVotes) return;

		try {
			loadingVotes = true;
			voteError = null;

			const result = await apiClient.submitVote(sanitizedUserId, voteType as 1 | -1);
			voteData = result.newVoteData;

			voteDataService.updateCachedVoteData(sanitizedUserId, result.newVoteData);

			logger.userAction('vote_submitted', {
				userId: sanitizedUserId,
				voteType,
				success: true
			});
		} catch (err) {
			const structuredError = err as Error & { type?: string };
			if (structuredError.type === 'AbuseDetectionError') {
				voteAccessDenied = true;
				return;
			}
			logger.error('Failed to submit vote:', err);
			voteError = 'Failed to submit vote';
		} finally {
			loadingVotes = false;
		}
	}

	// Handle queue submission
	function handleQueueSubmit() {
		if (onQueue) {
			onQueue();
		}
	}

	// Handle reprocess request
	function handleReprocessRequest(event: MouseEvent) {
		event.stopPropagation();
		if (onQueue) {
			onQueue(true, activeUserStatus);
		}
	}

	// Toggle options menu
	function toggleOptionsMenu(event: MouseEvent) {
		event.stopPropagation();
		showOptionsMenu = !showOptionsMenu;
	}

	// Tooltip resize handlers
	function handleResizeStart(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (!tooltipRef) return;

		isResizing = true;
		resizeStartPos = { x: event.clientX, y: event.clientY };

		const rect = tooltipRef.getBoundingClientRect();
		resizeStartSize = { width: rect.width, height: rect.height };

		document.addEventListener('mousemove', handleResizeMove);
		document.addEventListener('mouseup', handleResizeEnd);
	}

	function handleResizeMove(event: MouseEvent) {
		if (!isResizing || !resizeStartPos || !resizeStartSize) return;

		const config = getResizeConfig();
		const deltaX = (event.clientX - resizeStartPos.x) * config.sensitivity;
		const deltaY = (event.clientY - resizeStartPos.y) * config.sensitivity;

		customWidth = Math.min(
			Math.max(resizeStartSize.width + deltaX, config.minWidth),
			config.maxWidth
		);
		customHeight = Math.min(
			Math.max(resizeStartSize.height + deltaY, config.minHeight),
			config.maxHeight
		);

		if (!isExpanded) {
			requestAnimationFrame(() => positionTooltip());
		}

		queueHoverPopoverPosition();
	}

	function handleResizeEnd() {
		if (!isResizing) return;

		isResizing = false;
		resizeStartPos = null;
		resizeStartSize = null;

		document.removeEventListener('mousemove', handleResizeMove);
		document.removeEventListener('mouseup', handleResizeEnd);

		const config = getResizeConfig();
		if (customWidth !== undefined) {
			updateSetting(config.widthKey, customWidth).catch((err: unknown) => {
				logger.error('Failed to save tooltip width:', err);
			});
		}
		if (customHeight !== undefined) {
			updateSetting(config.heightKey, customHeight).catch((err: unknown) => {
				logger.error('Failed to save tooltip height:', err);
			});
		}
	}

	function handleResizeReset(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();

		// Clean up any in-progress resize
		isResizing = false;
		resizeStartPos = null;
		resizeStartSize = null;
		document.removeEventListener('mousemove', handleResizeMove);
		document.removeEventListener('mouseup', handleResizeEnd);

		const config = getResizeConfig();
		customWidth = undefined;
		customHeight = undefined;
		removeSetting(config.widthKey).catch((err: unknown) => {
			logger.error('Failed to remove tooltip width setting:', err);
		});
		removeSetting(config.heightKey).catch((err: unknown) => {
			logger.error('Failed to remove tooltip height setting:', err);
		});

		// Reposition preview tooltip after reset
		if (!isExpanded) {
			requestAnimationFrame(() => positionTooltip());
		}
	}

	// Header compact toggle
	function toggleHeaderCompact(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		headerCompact = !headerCompact;
		updateSetting(SETTINGS_KEYS.EXPANDED_HEADER_HEIGHT, headerCompact ? 1 : 0).catch(
			(err: unknown) => {
				logger.error('Failed to save header compact state:', err);
			}
		);
	}

	// Copy Discord link to clipboard
	async function handleCopyDiscordLink(event: MouseEvent) {
		event.stopPropagation();
		try {
			const link = `https://rotector.com/u/${sanitizedUserId}`;
			await navigator.clipboard.writeText(link);
			copySuccess = true;
			logger.userAction('discord_link_copied', { userId: sanitizedUserId });

			setTimeout(() => {
				copySuccess = false;
			}, 2000);
		} catch (err) {
			logger.error('Failed to copy Discord link:', err);
		}
	}

	// Handle view outfits click
	function handleViewOutfits(event: MouseEvent) {
		event.stopPropagation();
		showOptionsMenu = false;
		onViewOutfits?.();
	}

	// Handle click outside options menu
	function handleOptionsMenuClickOutside(event: MouseEvent) {
		const target = event.composedPath()[0];
		if (
			showOptionsMenu &&
			optionsMenuRef &&
			target instanceof Node &&
			!optionsMenuRef.contains(target)
		) {
			showOptionsMenu = false;
		}
	}

	// Handle expand tooltip click
	function handleExpand() {
		if (isResizing) return;
		if (!isExpanded && onExpand) {
			onExpand();
		}
	}

	// Reset states when switching tabs or data changes
	$effect(() => {
		void activeTab;
		void reasonEntries;
		translationsMap = {};
		translationError = null;
		translationAttempted = false;
		showTranslated = true;
		showOptionsMenu = false;
		copySuccess = false;
		expandedOriginals.clear();
	});

	// Trigger automatic translation
	$effect(() => {
		if (shouldAutoTranslate && !translationAttempted && !isTranslating) {
			void performAutoTranslation();
		}
	});

	// Automatically translate when conditions are met
	async function performAutoTranslation() {
		if (isTranslating || Object.keys(translationsMap).length > 0) return;

		try {
			isTranslating = true;
			translationError = null;

			const currentLanguage = $locale ?? 'en';
			const isEnglishUser = currentLanguage.split('-')[0]?.toLowerCase() === 'en';

			const targetLanguage = isEnglishUser ? 'en' : currentLanguage;
			const allTranslations: Record<string, string> = {};
			let totalTextsCount = 0;

			// Process each reason separately
			for (const reason of reasonEntries) {
				const textsForReason: string[] = [];

				// Collect reason message
				if (!isEnglishUser && reason.message) {
					textsForReason.push(reason.message);
				}

				// Collect all evidence
				if (reason.evidence) {
					for (const evidence of reason.evidence) {
						if (evidence.type === 'outfit') {
							if (evidence.outfitName) textsForReason.push(evidence.outfitName);
							if (evidence.outfitReason) textsForReason.push(evidence.outfitReason);
						} else if (evidence.content) {
							textsForReason.push(getDecodedContent(evidence.content));
						}
					}
				}

				// Batch translate all texts
				if (textsForReason.length > 0) {
					try {
						const result = await apiClient.translateTexts(textsForReason, targetLanguage, 'auto');
						Object.assign(allTranslations, result.translations);
						totalTextsCount += textsForReason.length;
					} catch (err) {
						logger.warn('Translation failed for reason, keeping original:', err);
					}
				}
			}

			translationsMap = allTranslations;

			if (totalTextsCount > 0) {
				logger.userAction('auto_translation_completed', {
					count: totalTextsCount,
					to: targetLanguage
				});
			}
		} catch (err) {
			logger.error('Auto-translation failed:', err);
			translationError = extractErrorMessage(err);
		} finally {
			isTranslating = false;
			translationAttempted = true;
		}
	}

	// Handle escape key
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && onClose) {
			onClose();
		}
	}

	// Handle clicks outside tooltip
	function handleClickOutside(event: MouseEvent) {
		const target = event.composedPath()[0];
		if (
			tooltipRef &&
			target instanceof Node &&
			!tooltipRef.contains(target) &&
			!anchorElement.contains(target) &&
			onClose
		) {
			onClose();
		}
	}

	// Handle overlay click for expanded tooltip
	function handleOverlayClick(event: MouseEvent | KeyboardEvent) {
		if (event.target === overlayRef && onClose) {
			closeWithAnimation();
		}
	}

	// Close expanded tooltip with animation
	function closeWithAnimation() {
		if (!overlayRef || !tooltipRef) {
			onClose?.();
			return;
		}

		const { originX, originY } = getTransformOrigin();
		tooltipRef.style.setProperty('--tooltip-origin-x', `${String(originX)}%`);
		tooltipRef.style.setProperty('--tooltip-origin-y', `${String(originY)}%`);

		overlayRef.classList.remove('visible');
		tooltipRef.style.transform = 'translate(-50%, -50%) scale(0.05)';
		tooltipRef.style.opacity = '0';

		setTimeout(() => {
			onClose?.();
		}, 350);
	}

	// Load saved dimensions based on tooltip mode
	$effect(() => {
		if (isExpanded) {
			customWidth = $settings[SETTINGS_KEYS.EXPANDED_TOOLTIP_WIDTH];
			customHeight = $settings[SETTINGS_KEYS.EXPANDED_TOOLTIP_HEIGHT];
			headerCompact = !!$settings[SETTINGS_KEYS.EXPANDED_HEADER_HEIGHT];
		} else {
			customWidth = $settings[SETTINGS_KEYS.PREVIEW_TOOLTIP_WIDTH];
			customHeight = $settings[SETTINGS_KEYS.PREVIEW_TOOLTIP_HEIGHT];
		}
	});

	// Handle window resize to clamp dimensions
	$effect(() => {
		function handleWindowResize() {
			const config = getResizeConfig();
			if (customWidth && customWidth > config.maxWidth) customWidth = config.maxWidth;
			if (customHeight && customHeight > config.maxHeight) customHeight = config.maxHeight;
		}

		window.addEventListener('resize', handleWindowResize);
		return () => window.removeEventListener('resize', handleWindowResize);
	});

	// Cleanup resize event listeners on unmount
	$effect(() => {
		return () => {
			if (isResizing) {
				document.removeEventListener('mousemove', handleResizeMove);
				document.removeEventListener('mouseup', handleResizeEnd);
			}
		};
	});

	$effect(() => {
		if (!activeHoverPopover || !hoverPopoverRef) return;

		queueHoverPopoverPosition();
	});

	$effect(() => {
		if (!activeHoverPopover) return;

		const handleViewportChange = () => {
			queueHoverPopoverPosition();
		};
		const scrollContent = scrollContentRef;

		scrollContent?.addEventListener('scroll', handleViewportChange);
		window.addEventListener('resize', handleViewportChange);
		window.addEventListener('scroll', handleViewportChange, true);

		return () => {
			scrollContent?.removeEventListener('scroll', handleViewportChange);
			window.removeEventListener('resize', handleViewportChange);
			window.removeEventListener('scroll', handleViewportChange, true);
		};
	});

	$effect(() => {
		return () => {
			clearHoverPopoverHideTimeout();
			clearHoverPopoverFrame();
		};
	});

	// Load vote data when tooltip becomes visible
	let hasLoadedVoteData = $state(false);

	$effect(() => {
		if (shouldShowVoting && !hasLoadedVoteData && !loadingVotes) {
			hasLoadedVoteData = true;
			loadVoteData().catch((error: unknown) => {
				logger.error('Failed to load vote data:', error);
			});
		}
	});

	// Refetch snapshots whenever the active flagged-outfit set changes
	$effect(() => {
		if (!flaggedOutfitNamesKey) return;
		void loadOutfitSnapshots();
	});

	// Anti-forgery watermark covering every user-visible zone of the tooltip
	$effect(() => {
		if (!activeStatus) return;

		const dataUri = renderWatermarkTile(
			sanitizedUserId,
			activeStatus.flagType,
			Math.floor(Date.now() / 1000),
			$effectiveTheme
		);

		const targets = [tooltipRef, stickyHeaderRef, profileHeaderRef].filter(
			(el): el is HTMLElement => !!el
		);
		const cleanups = targets.map((el) => guardWatermark(el, dataUri));

		return () => cleanups.forEach((fn) => fn());
	});

	// Setup and cleanup
	$effect(() => {
		if (isGroup) {
			groupInfo = getPageGroupInfo();
		} else {
			userInfo = getPageUserInfo();
		}

		if (isExpanded) {
			// Expanded tooltip setup
			if (tooltipRef) {
				const { originX, originY } = getTransformOrigin();
				tooltipRef.style.setProperty('--tooltip-origin-x', `${String(originX)}%`);
				tooltipRef.style.setProperty('--tooltip-origin-y', `${String(originY)}%`);
				tooltipRef.style.top = '50%';
				tooltipRef.style.left = '50%';
				tooltipRef.style.transform = 'translate(-50%, -50%) scale(0.05)';
				tooltipRef.style.opacity = '0';
			}

			document.addEventListener('keydown', handleKeydown);
			document.addEventListener('click', handleOptionsMenuClickOutside);

			// Animate to expanded state
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					if (overlayRef && tooltipRef) {
						overlayRef.classList.add('visible');
						tooltipRef.style.transform = 'translate(-50%, -50%) scale(1)';
						tooltipRef.style.opacity = '1';
					}
				});
			});

			return () => {
				document.removeEventListener('keydown', handleKeydown);
				document.removeEventListener('click', handleOptionsMenuClickOutside);
			};
		} else {
			// Preview tooltip setup
			previewPositionFrame = requestAnimationFrame(() => {
				previewPositionFrame = null;
				positionTooltip();
			});

			document.addEventListener('keydown', handleKeydown);
			document.addEventListener('click', handleClickOutside);
			window.addEventListener('resize', positionTooltip);

			return () => {
				if (previewPositionFrame !== null) {
					cancelAnimationFrame(previewPositionFrame);
					previewPositionFrame = null;
				}
				document.removeEventListener('keydown', handleKeydown);
				document.removeEventListener('click', handleClickOutside);
				window.removeEventListener('resize', positionTooltip);
			};
		}
	});
</script>

{#snippet hoverPopover()}
	{#if activeHoverPopover}
		<div
			bind:this={hoverPopoverRef}
			style:left={`${String(hoverPopoverPosition.left)}px`}
			style:top={`${String(hoverPopoverPosition.top)}px`}
			class="tooltip-hover-popover"
			class:cross-signal-popover={activeHoverPopover.kind === 'cross-signal'}
			class:outfit-only-popover={activeHoverPopover.kind === 'outfit-only'}
			class:source-info-popover={activeHoverPopover.kind.endsWith('-info')}
			onmouseenter={handleHoverPopoverEnter}
			onmouseleave={handleHoverPopoverLeave}
			role="tooltip"
		>
			{#if activeHoverPopover.kind === 'cross-signal'}
				<strong>{$_('tooltip_cross_signal_title')}</strong>
				<p>{$_('tooltip_cross_signal_message')}</p>
			{:else if activeHoverPopover.kind === 'outfit-only'}
				<strong>{$_('tooltip_outfit_title')}</strong>
				<p>{$_('tooltip_outfit_message')}</p>
			{:else if activeHoverPopover.kind === 'trap-info'}
				<strong>{$_('tooltip_trap_info_title')}</strong>
				<p>
					{$_('tooltip_trap_info_message')}
					<a
						href="https://rotector.com/blog/trap-game-detection-explained"
						onclick={(event) => event.stopPropagation()}
						rel="noopener noreferrer"
						target="_blank">{$_('tooltip_trap_info_link')}</a
					>
				</p>
			{:else if activeHoverPopover.kind === 'discord-info'}
				<strong>{$_('tooltip_discord_info_title')}</strong>
				<p>{$_('tooltip_discord_info_message')}</p>
				<ul class="source-info-list">
					<li class="source-info-list-item">
						<span><strong>Joined</strong> - {$_('tooltip_discord_info_joined')}</span>
					</li>
					<li class="source-info-list-item">
						<span><strong>First seen</strong> - {$_('tooltip_discord_info_first_seen')}</span>
					</li>
					<li class="source-info-list-item">
						<span><strong>Updated</strong> - {$_('tooltip_discord_info_updated')}</span>
					</li>
				</ul>
			{:else if activeHoverPopover.kind.endsWith('-info')}
				{@const entry = SOURCE_INFO_MAP[activeHoverPopover.kind.slice(0, -'-info'.length)]}
				{#if entry}
					<strong>{$_(entry.titleKey)}</strong>
					<p>{$_(entry.messageKey)}</p>
				{/if}
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet reviewerSection()}
	{#if reviewerInfo}
		{@const reviewer = reviewerInfo}
		{#if reviewer}
			<div class="reviewer-section">
				<User class="reviewer-icon" size={14} />
				<span class="reviewer-text">
					{$_('tooltip_reviewer_reviewed_by')}
					<span class="reviewer-name">
						{#if reviewer.displayName && reviewer.username && reviewer.displayName !== reviewer.username}
							{reviewer.displayName} (@{reviewer.username})
						{:else}
							{reviewer.displayName || reviewer.username}
						{/if}
					</span>
				</span>
				{#if reviewer.username === 'Anonymous' && reviewer.displayName === 'Anonymous'}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="reviewer-anonymous-indicator"
						class:info-hint-unseen={!hintsSeen.has('reviewer-anonymous')}
						onmouseenter={() => markInfoHintSeen('reviewer-anonymous')}
					>
						<Info size={12} />
						<div class="reviewer-anonymous-popover">
							<strong>{$_('tooltip_reviewer_anonymous_title')}</strong>
							<p>{$_('tooltip_reviewer_anonymous_message')}</p>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
{/snippet}

{#snippet metadataSection()}
	{@const metadata = metadataInfo}
	{#if metadata}
		<div class="tooltip-metadata">
			{#if metadata.queuedTime}
				<div class="tooltip-metadata-item" title={metadata.queuedExact}>
					<Clock class="tooltip-metadata-icon" size={10} strokeWidth={2} />
					<span class="tooltip-metadata-label">{$_('tooltip_metadata_queued')}</span>
					<span class="tooltip-metadata-value">{metadata.queuedTime}</span>
				</div>
			{/if}

			{#if metadata.duration}
				<div
					class="tooltip-metadata-item"
					class:processing={metadata.isProcessing}
					title={metadata.processedExact || $_('tooltip_metadata_processing_status')}
				>
					{#if metadata.isProcessing}
						<LoaderCircle class="tooltip-metadata-icon animate-spin" size={10} strokeWidth={2} />
					{:else}
						<Check class="tooltip-metadata-icon" size={10} strokeWidth={2} />
					{/if}
					<span class="tooltip-metadata-label">
						{#if metadata.isProcessing}{$_('tooltip_metadata_processing')}{:else}{$_(
								'tooltip_metadata_took'
							)}{/if}
					</span>
					<span class="tooltip-metadata-value">{metadata.duration}</span>
				</div>
			{/if}

			{#if metadata.lastUpdatedTime}
				<div class="tooltip-metadata-item" title={metadata.lastUpdatedExact}>
					<Clock class="tooltip-metadata-icon" size={10} strokeWidth={2} />
					<span class="tooltip-metadata-label">{$_('tooltip_metadata_last_updated')}</span>
					<span class="tooltip-metadata-value">{metadata.lastUpdatedTime}</span>
				</div>
			{/if}

			{#if isOutdated && !metadata.isProcessing}
				<button
					class="tooltip-metadata-reprocess"
					onclick={handleReprocessRequest}
					title={$_('tooltip_metadata_reprocess_title')}
					type="button"
				>
					<RefreshCw class="tooltip-metadata-icon" size={10} strokeWidth={2} />
					<span class="tooltip-metadata-label">{$_('tooltip_metadata_reprocess_button')}</span>
				</button>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet tabNavigation()}
	{#if tabs.length > 1}
		<div class="tooltip-tabs">
			{#each tabs as tab (tab.id)}
				{@const hasImage = !!tab.landscapeImageDataUrl}
				<button
					class="tooltip-tab"
					class:active={activeTab === tab.id}
					class:error={!hasImage && tab.error}
					class:loading={!hasImage && tab.loading}
					class:no-data={!hasImage && tab.noData}
					class:tooltipTabHasImage={hasImage}
					onclick={(e) => {
						e.stopPropagation();
						activeTab = tab.id;
						// Save tab preference for future tooltip opens
						updateSetting('lastSelectedCustomApiTab', tab.id).catch((error: unknown) => {
							logger.error('Failed to save tab preference:', error);
						});
					}}
					title={tab.name}
					type="button"
				>
					{#if hasImage}
						<img
							class="tooltip-tab-image"
							alt={tab.name}
							onerror={(e) => {
								const target = e.currentTarget as HTMLImageElement;
								target.style.display = 'none';
								const textSpan = target.nextElementSibling as HTMLSpanElement | null;
								if (textSpan) {
									textSpan.style.display = 'inline';
								}
							}}
							src={tab.landscapeImageDataUrl}
						/>
						<span class="tooltip-tab-name tooltip-tab-name-fallback">{tab.name}</span>
					{:else}
						<span class="tooltip-tab-name">{tab.name}</span>
						{#if tab.loading}
							<LoadingSpinner size="small" />
						{:else if tab.error}
							<CircleAlert class="tooltip-tab-error-indicator" size={12} />
						{/if}
					{/if}
				</button>
			{/each}
		</div>
	{/if}
{/snippet}

{#snippet customBadgesSection()}
	{#if customApiBadges.length > 0}
		<div class="custom-api-badges">
			{#each customApiBadges as badge (badge.text)}
				<span
					style:background-color={badge.color}
					style:color={badge.textColor}
					class="custom-api-badge"
				>
					{badge.text}
				</span>
			{/each}
		</div>
	{/if}
{/snippet}

{#snippet membershipBadgeSection()}
	{#if rotectorMembershipBadge}
		{@const tier = tierOf(rotectorMembershipBadge.tier)}
		<div class="mt-1.5">
			<MembershipPill
				badgeDesign={rotectorMembershipBadge.badgeDesign}
				iconDesign={rotectorMembershipBadge.iconDesign}
				textDesign={rotectorMembershipBadge.textDesign}
				{tier}
				tierName={tierNameOf(rotectorMembershipBadge.tier)}
			/>
		</div>
	{/if}
{/snippet}

{#snippet tooltipContent()}
	{#if effectivelyRestricted}
		<!-- Restricted access state -->
		<div class="restricted-access-notice">
			<Ban class="restricted-access-icon" size={24} />
			<div class="restricted-access-text">
				<strong>{$_('tooltip_restricted_title')}</strong>
				<p>{$_('tooltip_restricted_message')}</p>
				<a
					class="restricted-appeal-link"
					href="https://rotector.com"
					rel="noopener noreferrer"
					target="_blank"
				>
					{$_('tooltip_restricted_appeal')}
				</a>
			</div>
		</div>
	{:else if activeError}
		<!-- Error state -->
		<div class="error-details">
			{extractErrorMessage(activeError)}
		</div>
	{:else if activeLoading || !userStatus}
		<!-- Loading state -->
		<div class="flex items-center justify-center gap-2 py-2">
			<LoadingSpinner size="small" />
			<span class="text-xs">{$_('tooltip_loading_user_info')}</span>
		</div>
	{:else if !activeStatus}
		<!-- No-data state -->
	{:else}
		<!-- Status information -->
		<div>
			{#if isSafeUserWithQueueOnly}
				<!-- Expandable reasons for queued-safe users -->
				{#if isQueuedSafe}
					<button
						class="safe-reasons-toggle"
						onclick={(e) => {
							e.stopPropagation();
							showSafeReasons = !showSafeReasons;
						}}
						type="button"
					>
						<Info size={14} />
						<span class="leading-none">{$_('tooltip_safe_reasons_title')}</span>
						{#if showSafeReasons}
							<ChevronDown size={14} />
						{:else}
							<ChevronRight size={14} />
						{/if}
					</button>

					{#if showSafeReasons}
						{@const systemLimitsMsg = $_('tooltip_safe_reason_system_limits', {
							values: { 0: '|||LINK|||' }
						})}
						{@const parts = systemLimitsMsg.split('|||LINK|||')}
						<ul class="safe-reasons-list">
							<li class="safe-reasons-item">{$_('tooltip_safe_reason_external')}</li>
							<li class="safe-reasons-item">{$_('tooltip_safe_reason_threshold')}</li>
							<li class="safe-reasons-item">{$_('tooltip_safe_reason_outfit')}</li>
							<li class="safe-reasons-item">
								{$_('tooltip_safe_reason_profile_changed')}
							</li>
							<li class="safe-reasons-item">
								{$_('tooltip_safe_reason_throwaway_alt')}
							</li>
							<li class="safe-reasons-item">
								{$_('tooltip_safe_reason_condo_groups')}
							</li>
							<li class="safe-reasons-item">
								{parts[0]}<a
									class="safe-reasons-link"
									href="https://rotector.com"
									onclick={(e) => e.stopPropagation()}
									rel="noopener noreferrer"
									target="_blank">{$_('tooltip_safe_reason_contact_us')}</a
								>{parts[1]}
							</li>
						</ul>
					{/if}
				{/if}

				<!-- Queue button -->
				<div class="mt-2 flex gap-2">
					{#if queueCooldownInfo.isInCooldown}
						<button class="queue-button queue-button-disabled w-full" disabled type="button">
							{$_('tooltip_queue_cooldown', {
								values: { 0: queueCooldownInfo.daysRemaining.toString() }
							})}
						</button>
					{:else}
						<button
							class="queue-button w-full"
							onclick={(e) => {
								e.stopPropagation();
								handleQueueSubmit();
							}}
							type="button"
						>
							{$_('tooltip_queue_button')}
						</button>
					{/if}
				</div>

				<!-- Queue timing information -->
				{@render metadataSection()}
			{:else}
				<!-- Non-safe users -->

				<!-- Custom API Badges -->
				{@render customBadgesSection()}

				<!-- Voting widget for unsafe/pending users -->
				{#if shouldShowVoting}
					<VotingWidget
						confirmed={activeUserStatus?.flagType === STATUS.FLAGS.UNSAFE}
						error={voteError}
						loading={loadingVotes}
						onVote={handleVoteSubmit}
						{voteData}
					/>
				{/if}

				<!-- Reasons -->
				{#if reasonEntries.length > 0}
					<!-- Show divider if there's content above -->
					{#if shouldShowVoting || customApiBadges.length > 0}
						<div class="tooltip-divider"></div>
					{/if}

					<!-- Translation status/toggle -->
					{#if shouldAutoTranslate}
						{#if isTranslating}
							<!-- Loading state -->
							<div class="translate-status-container">
								<LoadingSpinner size="small" />
								<span class="translate-status-text">{$_('tooltip_translation_translating')}</span>
							</div>
						{:else if translationError}
							<!-- Error state -->
							<div class="translate-status-container">
								<span class="translate-error">{$_('tooltip_translation_failed')}</span>
							</div>
						{:else if hasActualTranslations}
							<!-- Toggle button -->
							<div class="translation-toggle-container">
								<button
									class="translation-toggle-button"
									onmousedown={(e) => {
										e.stopPropagation();
										e.preventDefault();
										showTranslated = !showTranslated;
									}}
									type="button"
								>
									{#if showTranslated}
										<FileText size={11} />
										<span>{$_('tooltip_translation_view_original')}</span>
									{:else}
										<Languages size={11} />
										<span>{$_('tooltip_translation_view_translated')}</span>
									{/if}
								</button>
							</div>
						{/if}
					{/if}

					<div class="reasons-container">
						{#each reasonEntries as reason (reason.typeName)}
							<div class="reason-item">
								<div class="reason-header">
									{reason.typeName} ({reason.confidence}%)
									{#if reason.typeName === 'User Profile' && badgeStatus.hasCrossSignal}
										<button
											class="cross-signal-indicator"
											class:info-hint-unseen={!hintsSeen.has('cross-signal')}
											aria-label={$_('tooltip_cross_signal_title')}
											onclick={(event) => event.stopPropagation()}
											onmouseenter={(event) =>
												handleHoverPopoverTriggerEnter('cross-signal', event)}
											onmouseleave={handleHoverPopoverTriggerLeave}
											type="button"
										>
											<Info size={14} />
										</button>
									{/if}
									{#if activeTab === ROTECTOR_API_ID && !isGroup}
										{#if reason.typeName === 'User Profile' && badgeStatus.isReportable}
											<a
												class="reportable-pill"
												href="https://www.roblox.com/report-abuse/?targetId={sanitizedUserId}&submitterId=0&abuseVector=userprofile&nl=true"
												onclick={(e) => e.stopPropagation()}
												rel="noopener noreferrer"
												target="_blank"
											>
												<Flag size={12} />
												{$_('tooltip_reportable_report_button')}
											</a>
										{/if}
										{#if reason.typeName === 'Avatar Outfit' && badgeStatus.isOutfitOnly}
											<button
												class="outfit-only-indicator"
												class:info-hint-unseen={!hintsSeen.has('outfit-only')}
												onclick={(event) => event.stopPropagation()}
												onmouseenter={(event) =>
													handleHoverPopoverTriggerEnter('outfit-only', event)}
												onmouseleave={handleHoverPopoverTriggerLeave}
												type="button"
											>
												<Shirt size={12} />
												{$_('tooltip_outfit_title')}
											</button>
										{/if}
									{/if}
								</div>
								{#if reason.message}
									{@const displayMessage = getDisplayText(reason.message)}
									{@const messageLines = displayMessage.split('\n').filter((l) => l.trim())}
									{@const grouped = groupSourceLines(messageLines)}
									{#if grouped.some((g) => g.kind === 'source')}
										<div class="reason-evidence">
											{#each grouped as group, i (i)}
												{#if group.kind === 'source'}
													{@const sourceInfo = SOURCE_INFO_MAP[group.source.toLowerCase()]}
													<div class="source-evidence-item">
														<div class="source-evidence-header">
															<span class="source-evidence-badge">{group.source}</span>
															{#if sourceInfo}
																<button
																	class="source-info-indicator"
																	class:info-hint-unseen={!hintsSeen.has(sourceInfo.kind)}
																	aria-label={$_(sourceInfo.titleKey)}
																	onclick={(event) => event.stopPropagation()}
																	onmouseenter={(event) =>
																		handleHoverPopoverTriggerEnter(sourceInfo.kind, event)}
																	onmouseleave={handleHoverPopoverTriggerLeave}
																	type="button"
																>
																	<Info size={12} />
																</button>
															{/if}
														</div>
														<div class="source-evidence-description">{group.description}</div>
														{#if group.subItems.length > 0}
															<div class="source-evidence-subitems">
																{#each group.subItems as subItem, si (si)}
																	<div class="source-evidence-subitem">{subItem}</div>
																{/each}
															</div>
														{/if}
													</div>
												{:else}
													<div class="evidence-item">{group.text}</div>
												{/if}
											{/each}
										</div>
									{:else}
										<div class="reason-message">{displayMessage}</div>
									{/if}
								{/if}
								{#if reason.evidence && reason.evidence.length > 0}
									{@const isCondoActivity = reason.typeName === 'Condo Activity'}
									{@const discordIdEvidence = isCondoActivity
										? reason.evidence.filter((e) => isDiscordIdEvidence(e.content))
										: []}
									{@const renderedEvidence = isCondoActivity
										? reason.evidence.filter((e) => !isDiscordIdEvidence(e.content))
										: reason.evidence}
									<div class="reason-evidence">
										{#if isCondoActivity}
											<DiscordAccountsEvidence
												fallbackEvidence={discordIdEvidence.map((e) =>
													getDisplayText(getDecodedContent(e.content))
												)}
												robloxUserId={parseInt(sanitizedUserId, 10)}
											/>
										{/if}
										{#each renderedEvidence as evidence, index (index)}
											{#if evidence.type === 'outfit' && evidence.outfitName && evidence.outfitReason}
												{@const outfitName = evidence.outfitName}
												{@const outfitReason = evidence.outfitReason}
												{@const outfitId = evidence.outfitId ?? null}
												{@const snapshot = resolveSnapshot(outfitName, outfitId)}
												{@const snapshotCount = snapshot?.rawUrls.length ?? 0}
												{@const primaryDataUrl = snapshot?.primaryDataUrl ?? null}
												{@const hasPrimary = primaryDataUrl !== null}
												{@const isMultiSnapshot = snapshotCount > 1}
												<div class="outfit-evidence-item">
													<button
														class="outfit-snapshot-thumb"
														class:outfit-snapshot-thumb-empty={!hasPrimary}
														disabled={!hasPrimary}
														onclick={(e) => {
															e.stopPropagation();
															openOutfitLightbox(
																outfitName,
																outfitReason,
																evidence.outfitConfidence ?? null,
																outfitId
															);
														}}
														type="button"
													>
														{#if loadingOutfitSnapshots && !outfitSnapshotMaps}
															<div class="outfit-snapshot-skeleton"></div>
														{:else if hasPrimary}
															<img
																class="outfit-snapshot-img"
																alt={getDisplayText(outfitName)}
																decoding="async"
																loading="lazy"
																src={primaryDataUrl}
															/>
															{#if isMultiSnapshot}
																<div class="outfit-snapshot-multi-overlay">
																	<span class="outfit-snapshot-count">
																		{snapshotCount}
																	</span>
																	<span class="outfit-snapshot-count-label">
																		{$_('tooltip_outfit_snapshot_count_label')}
																	</span>
																</div>
															{/if}
														{:else}
															<Shirt class="outfit-snapshot-placeholder-icon" size={20} />
														{/if}
													</button>
													<div class="outfit-evidence-body">
														<div class="outfit-evidence-header">
															<div class="outfit-evidence-name">
																{getDisplayText(outfitName)}
															</div>
															{#if evidence.outfitConfidence !== null}
																<div class="outfit-confidence-badge">
																	{evidence.outfitConfidence}
																	%
																</div>
															{/if}
														</div>
														<div class="outfit-reason">{getDisplayText(outfitReason)}</div>
													</div>
												</div>
											{:else}
												{@const decodeEntry = evidenceEncodingMap.get(evidence.content)}
												{#if decodeEntry}
													{@const isOriginalShown = expandedOriginals.has(evidence.content)}
													<div class="decoded-evidence-item">
														<div class="decoded-evidence-text">
															{getDisplayText(decodeEntry.decoded)}
														</div>
														<button
															class="decoded-evidence-chip"
															onmousedown={(e) => {
																e.stopPropagation();
																e.preventDefault();
																toggleOriginal(evidence.content);
															}}
															type="button"
														>
															{#if isOriginalShown}
																<Lock size={11} />
																<span>{getDetectedChipLabel(decodeEntry.encoding)}</span>
																<span class="decoded-evidence-action"
																	>{$_('tooltip_evidence_hide_original')}</span
																>
															{:else}
																<LockOpen size={11} />
																<span>{getDecodedChipLabel(decodeEntry.encoding)}</span>
																<span class="decoded-evidence-action"
																	>{$_('cipher_chip_show_original')}</span
																>
															{/if}
														</button>
														{#if isOriginalShown}
															<div class="decoded-evidence-original">{evidence.content}</div>
														{/if}
													</div>
												{:else}
													<div class="evidence-item">{getDisplayText(evidence.content)}</div>
												{/if}
											{/if}
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				<!-- Queue timing information -->
				{@render metadataSection()}
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet headerMessageSection(headerMessage: HeaderMessage)}
	{#if headerMessage.parts}
		{#each headerMessage.parts as part, i (i)}
			{#if part.class}
				<span class={part.class}>
					{part.text}
				</span>
			{:else}
				{part.text}
			{/if}
		{/each}
	{:else}
		{headerMessage.full}
	{/if}
{/snippet}

{#if isExpanded}
	<!-- Expanded tooltip structure -->
	<div
		bind:this={overlayRef}
		class="expanded-tooltip-overlay"
		aria-label={$_('tooltip_aria_close')}
		onclick={handleOverlayClick}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				handleOverlayClick(e);
			}
		}}
		role="button"
		tabindex="0"
	>
		<div
			bind:this={tooltipRef}
			style:width={tooltipDimensions.width ? `${String(tooltipDimensions.width)}px` : undefined}
			style:height={tooltipDimensions.height ? `${String(tooltipDimensions.height)}px` : undefined}
			style:max-width={tooltipDimensions.width ? `${String(tooltipDimensions.width)}px` : undefined}
			style:max-height={tooltipDimensions.height
				? `${String(tooltipDimensions.height)}px`
				: undefined}
			class="expanded-tooltip"
			class:has-tabs={tabs.length > 1}
			class:is-resizing={isResizing}
		>
			<!-- Tab Navigation -->
			{@render tabNavigation()}

			<!-- Tooltip content -->
			<div
				style:max-height={tooltipDimensions.height ? 'none' : undefined}
				class="expanded-tooltip-content"
			>
				<div bind:this={stickyHeaderRef} class="tooltip-sticky-header">
					<!-- Options Menu -->
					{#if activeTab === ROTECTOR_API_ID && !isGroup}
						<div bind:this={optionsMenuRef} class="tooltip-options-container">
							<button
								class="tooltip-options-button"
								aria-label={$_('tooltip_options_menu_aria')}
								onclick={toggleOptionsMenu}
								type="button"
							>
								<Ellipsis size={16} />
							</button>
							{#if showOptionsMenu}
								<div class="tooltip-options-menu">
									<button
										class="tooltip-options-item"
										onclick={handleCopyDiscordLink}
										type="button"
									>
										{#if copySuccess}
											<Check class="tooltip-options-icon success" size={15} />
										{:else}
											<Link class="tooltip-options-icon" size={15} />
										{/if}
										<span>{$_('tooltip_copy_link')}</span>
									</button>
									{#if onViewOutfits}
										<button class="tooltip-options-item" onclick={handleViewOutfits} type="button">
											<Shirt class="tooltip-options-icon" size={15} />
											<span>{$_('outfit_viewer_button')}</span>
										</button>
									{/if}
									{#if activeUserStatus?.engineVersion}
										<div class="tooltip-options-divider"></div>
										<div class="tooltip-options-engine">
											<span class="tooltip-options-engine-tag {engineVersionStatus}">
												{activeUserStatus.engineVersion} ·
												{#if engineVersionStatus === 'latest'}
													{$_('engine_status_latest')}
												{:else if engineVersionStatus === 'behind-minor'}
													{$_('engine_status_compatible')}
												{:else if engineVersionStatus === 'behind-major'}
													{$_('engine_status_outdated')}
												{:else if engineVersionStatus === 'deprecated'}
													{$_('engine_status_deprecated')}
												{:else}
													{$_('engine_status_unknown')}
												{/if}
											</span>
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/if}

					<!-- Profile Header -->
					{#if isGroup && groupInfo}
						<!-- Group Header -->
						<div
							bind:this={profileHeaderRef}
							class="tooltip-profile-header"
							class:compact={headerCompact}
						>
							<div class="tooltip-avatar">
								<img alt="" src={groupInfo.groupImageUrl} />
							</div>
							<div class="tooltip-user-info">
								<div class="tooltip-username">{groupInfo.groupName}</div>
								<div class="tooltip-user-id">
									{$_('tooltip_profile_group_id')}
									{sanitizedUserId}
								</div>
								{#if !effectivelyRestricted && !activeError && activeStatus}
									<div class="tooltip-status-badge {statusBadgeClass}">
										<span class="status-indicator"></span>
										{statusBadgeText}
									</div>
								{/if}
							</div>
							{#if showCompactColumns}
								<div class="tooltip-header-right">
									{#if activeStatus || isNoData}
										<div class="tooltip-inline-message">
											<div class="header-message">
												{@render headerMessageSection(headerMessage)}
											</div>
										</div>
									{/if}
									{@render reviewerSection()}
								</div>
							{/if}
						</div>
					{:else if !isGroup && userInfo}
						<!-- User Header -->
						<div
							bind:this={profileHeaderRef}
							class="tooltip-profile-header"
							class:compact={headerCompact}
						>
							<div class="tooltip-avatar">
								<img alt="" src={userInfo.avatarUrl} />
							</div>
							<div class="tooltip-user-info">
								<div class="tooltip-username">
									{userInfo.displayName ||
										(userInfo.username ? `@${userInfo.username}` : 'Unknown User')}
									{#if userInfo.username && userInfo.displayName && userInfo.username !== userInfo.displayName}
										<span class="tooltip-user-handle">@{userInfo.username}</span>
									{/if}
								</div>
								<div class="tooltip-user-id">{$_('tooltip_profile_id')} {sanitizedUserId}</div>
								{#if !effectivelyRestricted && !activeError && activeStatus}
									<div class="tooltip-status-badge {statusBadgeClass}">
										<span class="status-indicator"></span>
										{statusBadgeText}
									</div>
									{@render membershipBadgeSection()}
								{/if}
							</div>
							{#if showCompactColumns}
								<div class="tooltip-header-right">
									{#if activeStatus || isNoData}
										<div class="tooltip-inline-message">
											<div class="header-message">
												{@render headerMessageSection(headerMessage)}
											</div>
										</div>
									{/if}
									{@render reviewerSection()}
								</div>
							{/if}
						</div>
					{:else}
						<!-- Fallback header -->
						<div class="tooltip-header">
							<div>{@render headerMessageSection(headerMessage)}</div>
							<div class="tooltip-user-id">
								{isGroup ? $_('tooltip_entity_group') : $_('tooltip_profile_user')}
								{$_('tooltip_profile_id')}
								{sanitizedUserId}
							</div>
						</div>
					{/if}

					<!-- Header message and reviewer -->
					{#if !showCompactColumns}
						{#if (userInfo || groupInfo) && (activeStatus || isNoData)}
							<div class="tooltip-header">
								<div class="header-message">
									{@render headerMessageSection(headerMessage)}
								</div>
							</div>
						{/if}
						{@render reviewerSection()}
					{/if}

					<!-- Header Compact Toggle -->
					<button
						class="tooltip-header-toggle"
						aria-label={$_('tooltip_header_toggle_aria')}
						onclick={toggleHeaderCompact}
						type="button"
					></button>
				</div>

				<!-- Scrollable content -->
				<div
					bind:this={scrollContentRef}
					style:max-height={tooltipDimensions.height ? 'none' : undefined}
					class="tooltip-scrollable-content flex-1 px-5 py-4"
				>
					{@render tooltipContent()}
				</div>
			</div>

			<!-- Resize Handle -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="tooltip-resize-handle"
				aria-label={$_('tooltip_resize_handle_aria')}
				ondblclick={handleResizeReset}
				onmousedown={handleResizeStart}
				role="separator"
			></div>
		</div>
		{@render hoverPopover()}
	</div>
{:else}
	<!-- Preview tooltip structure -->
	<div
		bind:this={tooltipRef}
		style:width={tooltipDimensions.width ? `${String(tooltipDimensions.width)}px` : undefined}
		style:height={tooltipDimensions.height ? `${String(tooltipDimensions.height)}px` : undefined}
		style:max-width={tooltipDimensions.width ? `${String(tooltipDimensions.width)}px` : undefined}
		style:max-height={tooltipDimensions.height
			? `${String(tooltipDimensions.height)}px`
			: undefined}
		class="rtcr-tooltip-container"
		class:is-resizing={isResizing}
		aria-label={$_('tooltip_aria_expand')}
		aria-labelledby="tooltip-header"
		onclick={handleExpand}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				handleExpand();
			}
		}}
		onmouseenter={onMouseEnter}
		onmouseleave={() => {
			if (!isResizing) onMouseLeave?.();
		}}
		role="button"
		tabindex="0"
	>
		<!-- Tab Navigation -->
		{@render tabNavigation()}

		<!-- Sticky header -->
		<div bind:this={stickyHeaderRef} class="tooltip-sticky-header">
			<!-- Simple header -->
			<div id="tooltip-header" class="tooltip-header">
				<div class="header-message">
					{@render headerMessageSection(headerMessage)}
				</div>
			</div>

			<!-- Reviewer Section -->
			{@render reviewerSection()}
		</div>

		<!-- Content -->
		<div
			bind:this={scrollContentRef}
			style:max-height={tooltipDimensions.height ? 'none' : undefined}
			class="tooltip-scrollable-content px-3 py-2 text-left"
			class:flex-1={!!tooltipDimensions.height}
		>
			{@render tooltipContent()}
		</div>

		<!-- Resize Handle -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="tooltip-resize-handle"
			aria-label={$_('tooltip_resize_handle_aria')}
			onclick={(e) => e.stopPropagation()}
			ondblclick={handleResizeReset}
			onmousedown={handleResizeStart}
			role="separator"
		></div>
		{@render hoverPopover()}
	</div>
{/if}

{#if lightboxState}
	<OutfitSnapshotLightbox
		name={lightboxState.name}
		confidence={lightboxState.confidence}
		isOpen={true}
		onClose={() => (lightboxState = null)}
		primaryDataUrl={lightboxState.primaryDataUrl}
		rawUrls={lightboxState.rawUrls}
		reason={lightboxState.reason}
	/>
{/if}
