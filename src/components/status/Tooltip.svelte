<script lang="ts">
	import { ENTITY_TYPES, REASON_KEYS, STATUS, type VoteType } from '@/lib/types/constants';
	import { MIXED_GROUP, STATUS_FLAG_PRESENTATION } from '@/lib/utils/status/status-config';
	import type { ReviewerInfo, UserStatus, VoteData } from '@/lib/types/api';
	import { asApiError } from '@/lib/utils/api/api-error';
	import { logger } from '@/lib/utils/logging/logger';
	import { extractErrorMessage, sanitizeEntityId } from '@/lib/utils/dom/sanitizer';
	import { calculateStatusBadges } from '@/lib/utils/status/status-utils';
	import { ENGINE_STATUS_BY_COMPAT, ENGINE_STATUS_KEY } from '@/lib/utils/status/engine-status';
	import { apiClient } from '@/lib/services/rotector/api-client';
	import {
		outfitSnapshotService,
		type SnapshotKey,
		type SnapshotMaps
	} from '@/lib/services/rotector/outfit-snapshot';
	import { pickDefaultTab } from '@/lib/services/rotector/unified-query';
	import {
		getRotectorMembershipBadge,
		getRotectorOutfitEvidence
	} from '@/lib/utils/status/status-projection';
	import { getVoteData, updateCachedVoteData } from '@/lib/services/third-party/vote-data';
	import { useTooltipTranslation } from './useTooltipTranslation.svelte';
	import { restrictedAccessStore } from '@/lib/stores/restricted-access';
	import { getLoggedInUserId } from '@/lib/utils/client-id';
	import {
		type FormattedReasonEntry,
		formatViolationReasons,
		groupSourceLines
	} from '@/lib/utils/status/violation-formatter';
	import {
		detectPageContext,
		extractGroupInfo,
		extractUserInfo,
		type GroupInfo,
		type UserInfo
	} from '@/lib/utils/dom/page-detection';
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
	} from './tooltip-positioning';
	import { detectEncoding, makeDecoder } from '@/lib/services/cipher/encoding-detector';
	import type { EncodingResult } from '@/lib/services/cipher/encoding-detector';
	import ExtLink from '@/components/ui/ExtLink.svelte';
	import MembershipPill from '@/components/ui/membership/MembershipPill.svelte';
	import { tierNameOf, tierOf } from '@/lib/utils/membership-designs';
	import {
		User,
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
		Info,
		ChevronRight,
		ChevronDown,
		Lock,
		LockOpen,
		ImageDown,
		Copy
	} from '@lucide/svelte';
	import LoadingSpinner from '../ui/LoadingSpinner.svelte';
	import VotingWidget from './VotingWidget.svelte';
	import DiscordAccountsEvidence from './DiscordAccountsEvidence.svelte';
	import OutfitSnapshotLightbox from '../features/outfit/OutfitSnapshotLightbox.svelte';
	import TooltipTabs from './TooltipTabs.svelte';
	import HoverPopover from './HoverPopover.svelte';
	import {
		SOURCE_INFO_MAP,
		type HoverPopoverInstance,
		type HoverPopoverKind
	} from './hover-popover-types';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { tick } from 'svelte';
	import { get } from 'svelte/store';
	import { _ } from 'svelte-i18n';
	import { SETTINGS_KEYS } from '@/lib/types/settings';

	import type { CombinedStatus } from '@/lib/types/custom-api';
	import { ROTECTOR_API_ID } from '@/lib/stores/custom-apis';
	import { settings, updateSetting, removeSetting } from '@/lib/stores/settings';
	import { themeManager } from '@/lib/utils/theme';
	import { guardWatermark, renderWatermarkTile } from './watermark';
	import {
		exportTooltipImage,
		type ExportFormat,
		type ExportMode
	} from '@/lib/utils/tooltip-export';

	const SAVE_AS_FORMATS: { format: ExportFormat; labelKey: string }[] = [
		{ format: 'png', labelKey: 'tooltip_export_save_png' },
		{ format: 'jpg', labelKey: 'tooltip_export_save_jpg' },
		{ format: 'webp', labelKey: 'tooltip_export_save_webp' },
		{ format: 'svg', labelKey: 'tooltip_export_save_svg' }
	];

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

	interface EvidenceDecodeEntry {
		encoding: EncodingResult;
		decoded: string;
	}

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

	let tooltipRef = $state<HTMLElement>();
	let expandedCardRef = $state<HTMLElement>();
	let overlayRef = $state<HTMLElement>();
	let scrollContentRef = $state<HTMLElement>();
	let stickyHeaderRef = $state<HTMLElement>();
	let profileHeaderRef = $state<HTMLElement>();
	let hoverPopover: HoverPopoverInstance | undefined = $state();
	let voteData: VoteData | null = $state(null);
	let loadingVotes = $state(false);
	let voteError = $state<string | null>(null);
	let voteAccessDenied = $state(false);
	let userInfo: UserInfo | null = $state(null);
	let groupInfo: GroupInfo | null = $state(null);
	let activeTab = $state<string>(ROTECTOR_API_ID);
	let lastSelectedForUserId = $state<string | number | null>(null);

	const hintsSeen = $derived(new Set<string>($settings[SETTINGS_KEYS.INFO_POPOVER_HINTS_SEEN]));

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

	let expandedOriginals = new SvelteSet<string>();

	let optionsMenuRef = $state<HTMLElement>();
	let exportRowRef = $state<HTMLElement>();
	let exportSubmenuRef = $state<HTMLElement>();
	let showOptionsMenu = $state(false);
	let showExportSubmenu = $state(false);
	let submenuOpenTimer: ReturnType<typeof setTimeout> | null = null;
	let submenuCloseTimer: ReturnType<typeof setTimeout> | null = null;
	let activeExportMode = $state<ExportMode | null>(null);
	let exportSuccessMode = $state<ExportMode | null>(null);

	let isResizing = $state(false);
	let resizeStartPos = $state<{ x: number; y: number } | null>(null);
	let resizeStartSize = $state<{ width: number; height: number } | null>(null);
	let customWidth = $state<number | undefined>(undefined);
	let customHeight = $state<number | undefined>(undefined);
	let measuredCardWidth = $state<number | undefined>(undefined);
	let headerCompact = $state(false);
	let previewPositionFrame: number | null = null;

	const engineVersionStatus = $derived.by(() => {
		const compat = activeUserStatus?.versionCompatibility;
		return (compat && ENGINE_STATUS_BY_COMPAT[compat]) || 'unknown';
	});

	const activeApiResult = $derived(userStatus?.get(activeTab) ?? null);
	const activeStatus = $derived(activeApiResult?.data ?? null);
	const activeError = $derived(activeApiResult?.error ?? error ?? null);
	const activeLoading = $derived(activeApiResult?.loading ?? false);

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

	$effect(() => {
		if (!userStatus) return;
		if (lastSelectedForUserId === userId) return;

		const preferred = get(settings).lastSelectedCustomApiTab;
		const next = pickDefaultTab(userStatus, preferred);
		if (next === null) return; // some APIs still loading

		activeTab = next;
		lastSelectedForUserId = userId;
	});

	const sanitizedUserId = $derived(sanitizeEntityId(userId) ?? '');

	const isGroup = $derived(entityType === ENTITY_TYPES.GROUP);

	const activeUserStatus = $derived.by(() => {
		const status = activeStatus;
		return !isGroup && status ? (status as UserStatus) : null;
	});

	const flaggedOutfitLookups = $derived.by<SnapshotKey[]>(() => {
		if (isGroup) return [];
		const flagged = getRotectorOutfitEvidence(userStatus);
		if (!flagged) return [];
		return flagged.map((info) =>
			info.outfitId !== null ? { kind: 'id', id: info.outfitId } : { kind: 'name', name: info.name }
		);
	});

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
				activeUserStatus.flagType === STATUS.FLAGS.MIXED)
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

	// Minimal tooltip entities skip saved height
	const isMinimalEntity = $derived(
		activeTab === ROTECTOR_API_ID &&
			activeStatus &&
			(activeStatus.flagType === STATUS.FLAGS.SAFE ||
				activeStatus.flagType === STATUS.FLAGS.QUEUED ||
				activeStatus.flagType === STATUS.FLAGS.PROVISIONAL ||
				activeStatus.flagType === STATUS.FLAGS.REDACTED)
	);

	let showSafeReasons = $state(false);

	// 3-day cooldown after processing
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

	const isRestricted = $derived($restrictedAccessStore.isRestricted);

	const isSelfLookup = $derived.by(() => {
		if (isGroup) return false;
		const clientId = getLoggedInUserId();
		return clientId !== null && clientId === sanitizedUserId;
	});

	const effectivelyRestricted = $derived(
		activeError === 'restricted_access' ||
			(isRestricted && !isSelfLookup && !activeStatus && !activeLoading && !activeError)
	);

	// Batch resolved with this user omitted from the response
	const isNoData = $derived(
		!!userStatus && !activeLoading && !activeError && !effectivelyRestricted && !activeStatus
	);

	const customApiBadges = $derived.by(() => {
		if (activeTab === ROTECTOR_API_ID || isGroup || !userStatus) return [];

		const data = userStatus.get(activeTab)?.data;
		return data && 'badges' in data ? (data.badges ?? []) : [];
	});

	// Read from the Rotector entry directly so the membership pill stays visible
	// even when the user has a non-Rotector tab active
	const rotectorMembershipBadge = $derived(isGroup ? null : getRotectorMembershipBadge(userStatus));

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
						{ text: `${$_('tooltip_entity_moderators')}${suffix}`, class: 'moderators-text' }
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
				return {
					full: $_(
						currentStatus?.processed === true
							? 'tooltip_header_queued_safe'
							: 'tooltip_header_queued_processing',
						{ values: { 0: entityType } }
					)
				};
			case STATUS.FLAGS.PROVISIONAL:
				return { full: $_('tooltip_header_provisional') };
			case STATUS.FLAGS.REDACTED:
				return { full: $_('tooltip_header_redacted') };
			case STATUS.FLAGS.MIXED:
				return { full: $_(isGroup ? 'tooltip_header_mixed_group' : 'tooltip_header_mixed_user') };
			case STATUS.FLAGS.PAST_OFFENDER:
				return { full: $_('tooltip_header_past_offender', { values: { 0: entityType } }) };
			case STATUS.FLAGS.SAFE:
				return { full: $_('tooltip_header_safe', { values: { 0: entityType } }) };
			case STATUS.FLAGS.UNKNOWN:
				return { full: $_('tooltip_header_update_required', { values: { 0: entityType } }) };
			default:
				return { full: $_('tooltip_header_unavailable') };
		}
	}

	const headerMessage = $derived.by(() => {
		if (effectivelyRestricted) return { full: $_('tooltip_restricted_header') };
		if (activeError) return { full: $_('tooltip_error_details') };
		if (activeLoading || !userStatus) return { full: $_('tooltip_loading') };
		if (!activeStatus) return { full: $_('tooltip_no_data_available') };

		return getHeaderMessageFromFlag(
			activeStatus.flagType,
			activeStatus.confidence || 0,
			activeUserStatus
		);
	});

	const statusBadgeClass = $derived.by(() => {
		if (!activeStatus) return 'error';
		if (activeStatus.flagType === STATUS.FLAGS.QUEUED && activeUserStatus?.processed === true)
			return STATUS_FLAG_PRESENTATION[STATUS.FLAGS.SAFE].badgeClass;
		if (activeStatus.flagType === STATUS.FLAGS.MIXED && isGroup) return MIXED_GROUP.badgeClass;
		return STATUS_FLAG_PRESENTATION[activeStatus.flagType].badgeClass;
	});

	const statusBadgeText = $derived.by(() => {
		if (effectivelyRestricted) return $_('tooltip_restricted_title');
		if (!activeStatus) return $_('tooltip_status_unknown');
		if (activeStatus.flagType === STATUS.FLAGS.QUEUED && activeUserStatus?.processed === true)
			return $_('tooltip_status_not_flagged');
		return $_(STATUS_FLAG_PRESENTATION[activeStatus.flagType].textKey);
	});

	const reasonEntries = $derived.by((): FormattedReasonEntry[] => {
		if (
			!activeStatus?.reasons ||
			activeStatus.flagType === STATUS.FLAGS.SAFE ||
			activeStatus.flagType === STATUS.FLAGS.PROVISIONAL ||
			activeStatus.flagType === STATUS.FLAGS.REDACTED ||
			activeStatus.flagType === STATUS.FLAGS.UNKNOWN
		)
			return [];
		return formatViolationReasons(activeStatus.reasons);
	});

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

	const shouldAutoTranslate = $derived.by(() => {
		const translateEnabled = $settings[SETTINGS_KEYS.TRANSLATE_VIOLATIONS_ENABLED];
		const hasReasons = reasonEntries.length > 0;
		return translateEnabled && hasReasons;
	});

	function getResizeConfig() {
		if (isExpanded) {
			return {
				minWidth: TOOLTIP_SIZE.MIN_WIDTH,
				minHeight: TOOLTIP_SIZE.MIN_HEIGHT,
				maxWidth: window.innerWidth * TOOLTIP_SIZE.MAX_WIDTH_RATIO,
				maxHeight: window.innerHeight * TOOLTIP_SIZE.MAX_HEIGHT_RATIO,
				widthKey: SETTINGS_KEYS.EXPANDED_TOOLTIP_WIDTH,
				heightKey: SETTINGS_KEYS.EXPANDED_TOOLTIP_HEIGHT,
				sensitivity: 2
			};
		}
		return {
			minWidth: PREVIEW_TOOLTIP_SIZE.MIN_WIDTH,
			minHeight: PREVIEW_TOOLTIP_SIZE.MIN_HEIGHT,
			maxWidth: PREVIEW_TOOLTIP_SIZE.MAX_WIDTH,
			maxHeight: PREVIEW_TOOLTIP_SIZE.MAX_HEIGHT,
			widthKey: SETTINGS_KEYS.PREVIEW_TOOLTIP_WIDTH,
			heightKey: SETTINGS_KEYS.PREVIEW_TOOLTIP_HEIGHT,
			sensitivity: 1
		};
	}

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

	const showCompactColumns = $derived(
		headerCompact && (measuredCardWidth ?? COMPACT_HEADER_MIN_WIDTH) >= COMPACT_HEADER_MIN_WIDTH
	);

	function getDecodedContent(content: string): string {
		return evidenceEncodingMap.get(content)?.decoded ?? content;
	}

	// Match Rotector's "Discord User ID: <id>" evidence lines
	function isDiscordIdEvidence(content: string): boolean {
		return getDecodedContent(content).trim().startsWith('Discord User ID');
	}

	const DETECTED_CHIP_KEYS: Record<EncodingResult['type'], string> = {
		caesar: 'cipher_chip_detected',
		morse: 'cipher_chip_detected_morse',
		'morse+caesar': 'cipher_chip_detected_morse_caesar',
		binary: 'cipher_chip_detected_binary'
	};

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

	function toggleOriginal(content: string) {
		if (expandedOriginals.has(content)) {
			expandedOriginals.delete(content);
		} else {
			expandedOriginals.add(content);
		}
	}

	const reviewerInfo = $derived.by((): ReviewerInfo | null => {
		if (isGroup) return null;
		if (!activeUserStatus?.reviewer) return null;
		return activeUserStatus.reviewer;
	});

	const badgeStatus = $derived.by(() => calculateStatusBadges(activeUserStatus));

	const isOutdated = $derived.by(() => {
		if (isGroup) return false;
		if (!activeUserStatus?.lastUpdated) return false;
		const daysSince = getDaysSinceTimestamp(activeUserStatus.lastUpdated);
		return daysSince >= 7;
	});

	const isReviewed = $derived.by(() => {
		if (!activeStatus || activeStatus.flagType !== STATUS.FLAGS.UNSAFE) return false;
		return isGroup || !!activeUserStatus?.reviewer;
	});

	const metadataInfo = $derived.by(() => {
		if (isGroup || activeTab !== ROTECTOR_API_ID) return null;
		if (!activeUserStatus) return null;

		const queuedAt = activeUserStatus.queuedAt;
		const processedAt = activeUserStatus.processedAt;
		const lastUpdated = activeUserStatus.lastUpdated;

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

	function getPageGroupInfo(): GroupInfo | null {
		const groupId = sanitizedUserId;
		if (!groupId) return null;

		const { pageType, container } = detectPageContext(anchorElement);
		return extractGroupInfo(groupId, pageType, container);
	}

	// Closes the tooltip if the anchor element has been removed, otherwise computes and applies its preview position
	function positionTooltip() {
		if (!tooltipRef || isExpanded) return;

		if (!anchorElement.isConnected) {
			onClose?.();
			return;
		}

		const position = calculateTooltipPosition(tooltipRef, anchorElement);
		applyTooltipPosition(tooltipRef, position);
	}

	function handleHoverPopoverTriggerEnter(kind: HoverPopoverKind, event: MouseEvent) {
		const anchor = event.currentTarget;
		if (!(anchor instanceof HTMLElement)) return;
		hoverPopover?.show(anchor, kind);
	}

	function scheduleHoverPopoverClose() {
		hoverPopover?.scheduleClose();
	}

	function getTransformOrigin() {
		return calculateTransformOrigin(anchorElement);
	}

	function getResizeElement() {
		return isExpanded ? expandedCardRef : tooltipRef;
	}

	async function loadVoteData() {
		if (!shouldShowVoting || loadingVotes) return;

		loadingVotes = true;
		voteError = null;

		try {
			const votes = await getVoteData(sanitizedUserId);
			voteData = votes;
			logger.debug('Loaded vote data for user', { userId: sanitizedUserId, votes });
		} catch (err) {
			if (asApiError(err).type === 'AbuseDetectionError') {
				voteAccessDenied = true;
				return;
			}
			voteError = 'Failed to load voting data';
			logger.error('Failed to load vote data:', err);
		} finally {
			loadingVotes = false;
		}
	}

	// A newer load supersedes any in-flight fetch so stale results never overwrite the maps
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

	async function handleVoteSubmit(voteType: VoteType) {
		if (loadingVotes) return;

		try {
			loadingVotes = true;
			voteError = null;

			const result = await apiClient.submitVote(sanitizedUserId, voteType);
			voteData = result.newVoteData;

			updateCachedVoteData(sanitizedUserId, result.newVoteData);

			logger.userAction('vote_submitted', {
				userId: sanitizedUserId,
				voteType,
				success: true
			});
		} catch (err) {
			if (asApiError(err).type === 'AbuseDetectionError') {
				voteAccessDenied = true;
				return;
			}
			logger.error('Failed to submit vote:', err);
			voteError = 'Failed to submit vote';
		} finally {
			loadingVotes = false;
		}
	}

	function handleQueueSubmit() {
		onQueue?.();
	}

	function handleReprocessRequest(event: MouseEvent) {
		event.stopPropagation();
		onQueue?.(true, activeUserStatus);
	}

	function toggleOptionsMenu(event: MouseEvent) {
		event.stopPropagation();
		showOptionsMenu = !showOptionsMenu;
	}

	// Captures the starting pointer and tooltip size then attaches document-level move and up listeners for the drag
	function handleResizeStart(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();

		const resizeElement = getResizeElement();
		if (!resizeElement) return;

		isResizing = true;
		resizeStartPos = { x: event.clientX, y: event.clientY };

		const rect = resizeElement.getBoundingClientRect();
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

		if (!isExpanded) {
			requestAnimationFrame(() => positionTooltip());
		}
	}

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

	function handleViewOutfits(event: MouseEvent) {
		event.stopPropagation();
		showOptionsMenu = false;
		onViewOutfits?.();
	}

	async function handleExportTooltip(event: MouseEvent, mode: ExportMode) {
		event.stopPropagation();
		if (!expandedCardRef || activeExportMode !== null) return;
		activeExportMode = mode;
		const prevShowSafeReasons = showSafeReasons;
		showSafeReasons = true;
		await tick();
		try {
			const success = await exportTooltipImage(expandedCardRef, {
				mode,
				kind: isGroup ? 'group' : 'user',
				identifier: sanitizedUserId,
				engineStatus: engineVersionStatus
			});
			if (success) {
				exportSuccessMode = mode;
				setTimeout(() => {
					if (exportSuccessMode === mode) exportSuccessMode = null;
				}, 2000);
			}
		} finally {
			activeExportMode = null;
			showSafeReasons = prevShowSafeReasons;
		}
	}

	function cancelSubmenuTimers() {
		if (submenuOpenTimer !== null) {
			clearTimeout(submenuOpenTimer);
			submenuOpenTimer = null;
		}
		if (submenuCloseTimer !== null) {
			clearTimeout(submenuCloseTimer);
			submenuCloseTimer = null;
		}
	}

	function scheduleSubmenuOpen() {
		if (submenuCloseTimer !== null) {
			clearTimeout(submenuCloseTimer);
			submenuCloseTimer = null;
		}
		if (showExportSubmenu || submenuOpenTimer !== null) return;
		submenuOpenTimer = setTimeout(() => {
			submenuOpenTimer = null;
			showExportSubmenu = true;
		}, 120);
	}

	function scheduleSubmenuClose() {
		if (submenuOpenTimer !== null) {
			clearTimeout(submenuOpenTimer);
			submenuOpenTimer = null;
		}
		if (!showExportSubmenu || submenuCloseTimer !== null) return;
		submenuCloseTimer = setTimeout(() => {
			submenuCloseTimer = null;
			showExportSubmenu = false;
		}, 280);
	}

	function toggleExportSubmenu(event: MouseEvent) {
		event.stopPropagation();
		cancelSubmenuTimers();
		showExportSubmenu = !showExportSubmenu;
	}

	async function focusFirstSubmenuItem() {
		await tick();
		exportSubmenuRef?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
	}

	async function handleExportRowKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			event.stopPropagation();
			cancelSubmenuTimers();
			showExportSubmenu = true;
			await focusFirstSubmenuItem();
		} else if (event.key === 'ArrowLeft' || event.key === 'Escape') {
			if (!showExportSubmenu) return;
			event.preventDefault();
			event.stopPropagation();
			cancelSubmenuTimers();
			showExportSubmenu = false;
		}
	}

	function handleSubmenuKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft' || event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			cancelSubmenuTimers();
			showExportSubmenu = false;
			exportRowRef?.focus();
		}
	}

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

	function handleExpand() {
		if (isResizing) return;
		if (!isExpanded) onExpand?.();
	}

	$effect(() => {
		void activeTab;
		void reasonEntries;
		showOptionsMenu = false;
		expandedOriginals.clear();
	});

	$effect(() => {
		if (showOptionsMenu) return;
		showExportSubmenu = false;
		cancelSubmenuTimers();
	});

	$effect(() => {
		return () => {
			cancelSubmenuTimers();
		};
	});

	const translation = useTooltipTranslation({
		reasonEntries: () => reasonEntries,
		shouldAutoTranslate: () => shouldAutoTranslate,
		getDecodedContent,
		resetKey: () => [activeTab, reasonEntries]
	});

	function getDisplayText(t: string): string {
		return translation.getDisplayText(t);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && onClose) {
			onClose();
		}
	}

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

	function handleOverlayClick(event: MouseEvent | KeyboardEvent) {
		if (event.target === overlayRef && onClose) {
			closeWithAnimation();
		}
	}

	// Animates the tooltip back into the anchor's transform origin then calls onClose after the 350ms transition
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

	$effect(() => {
		function handleWindowResize() {
			const config = getResizeConfig();
			if (customWidth && customWidth > config.maxWidth) customWidth = config.maxWidth;
			if (customHeight && customHeight > config.maxHeight) customHeight = config.maxHeight;
		}

		window.addEventListener('resize', handleWindowResize);
		return () => window.removeEventListener('resize', handleWindowResize);
	});

	$effect(() => {
		return () => {
			if (isResizing) {
				document.removeEventListener('mousemove', handleResizeMove);
				document.removeEventListener('mouseup', handleResizeEnd);
			}
		};
	});

	let hasLoadedVoteData = $state(false);

	$effect(() => {
		if (shouldShowVoting && !hasLoadedVoteData && !loadingVotes) {
			hasLoadedVoteData = true;
			loadVoteData().catch((error: unknown) => {
				logger.error('Failed to load vote data:', error);
			});
		}
	});

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

		const rootElement = isExpanded ? expandedCardRef : tooltipRef;
		const targets = [rootElement, stickyHeaderRef, profileHeaderRef].filter(
			(el): el is HTMLElement => !!el
		);
		const cleanups = targets.map((el) => guardWatermark(el, dataUri));

		return () => cleanups.forEach((fn) => fn());
	});

	$effect(() => {
		if (isGroup) {
			groupInfo = getPageGroupInfo();
		} else {
			userInfo = getPageUserInfo();
		}

		if (isExpanded) {
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

{#snippet compactHeaderRight()}
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
{/snippet}

{#snippet reviewerSection()}
	{#if reviewerInfo}
		<div class="reviewer-section">
			<User class="reviewer-icon" size={14} />
			<span class="reviewer-text">
				{$_('tooltip_reviewer_reviewed_by')}
				<span class="reviewer-name">
					{#if reviewerInfo.displayName && reviewerInfo.username && reviewerInfo.displayName !== reviewerInfo.username}
						{reviewerInfo.displayName} (@{reviewerInfo.username})
					{:else}
						{reviewerInfo.displayName || reviewerInfo.username}
					{/if}
				</span>
			</span>
			{#if reviewerInfo.username === 'Anonymous' && reviewerInfo.displayName === 'Anonymous'}
				<button
					class="reviewer-anonymous-indicator"
					class:info-hint-unseen={!hintsSeen.has('reviewer-anonymous')}
					aria-label={$_('tooltip_reviewer_anonymous_title')}
					onclick={(event) => event.stopPropagation()}
					onmouseenter={(event) => handleHoverPopoverTriggerEnter('reviewer-anonymous', event)}
					onmouseleave={scheduleHoverPopoverClose}
					type="button"
				>
					<Info size={12} />
				</button>
			{/if}
		</div>
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
				<ExtLink class="restricted-appeal-link" href="https://rotector.com">
					{$_('tooltip_restricted_appeal')}
				</ExtLink>
			</div>
		</div>
	{:else if activeError}
		<div class="error-details">
			{extractErrorMessage(activeError)}
		</div>
	{:else if activeLoading || !userStatus}
		<div class="flex items-center justify-center gap-2 py-2">
			<LoadingSpinner size="small" />
			<span class="text-xs">{$_('tooltip_loading_user_info')}</span>
		</div>
	{:else if !activeStatus}
		<!-- No-data state -->
	{:else}
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
								{parts[0]}<ExtLink
									class="safe-reasons-link"
									href="https://rotector.com"
									onclick={(e: MouseEvent) => e.stopPropagation()}
									>{$_('tooltip_safe_reason_contact_us')}</ExtLink
								>{parts[1]}
							</li>
						</ul>
					{/if}
				{/if}

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

				{#if reasonEntries.length > 0}
					<!-- Show divider if there's content above -->
					{#if shouldShowVoting || customApiBadges.length > 0}
						<div class="tooltip-divider"></div>
					{/if}

					<!-- Translation status/toggle -->
					{#if shouldAutoTranslate}
						{#if translation.isTranslating}
							<div class="translate-status-container">
								<LoadingSpinner size="small" />
								<span class="translate-status-text">{$_('tooltip_translation_translating')}</span>
							</div>
						{:else if translation.translationError}
							<div class="translate-status-container">
								<span class="translate-error">{$_('tooltip_translation_failed')}</span>
							</div>
						{:else if translation.hasActualTranslations}
							<div class="translation-toggle-container">
								<button
									class="translation-toggle-button"
									onmousedown={(e) => {
										e.stopPropagation();
										e.preventDefault();
										translation.showTranslated = !translation.showTranslated;
									}}
									type="button"
								>
									{#if translation.showTranslated}
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
									{#if reason.typeName === REASON_KEYS.USER_PROFILE && badgeStatus.hasCrossSignal}
										<button
											class="cross-signal-indicator"
											class:info-hint-unseen={!hintsSeen.has('cross-signal')}
											aria-label={$_('tooltip_cross_signal_title')}
											onclick={(event) => event.stopPropagation()}
											onmouseenter={(event) =>
												handleHoverPopoverTriggerEnter('cross-signal', event)}
											onmouseleave={scheduleHoverPopoverClose}
											type="button"
										>
											<Info size={14} />
										</button>
									{/if}
									{#if activeTab === ROTECTOR_API_ID && !isGroup}
										{#if reason.typeName === REASON_KEYS.USER_PROFILE && badgeStatus.isReportable}
											<ExtLink
												class="reportable-pill"
												href="https://www.roblox.com/report-abuse/?targetId={sanitizedUserId}&submitterId=0&abuseVector=userprofile&nl=true"
												onclick={(e: MouseEvent) => e.stopPropagation()}
											>
												<Flag size={12} />
												{$_('tooltip_reportable_report_button')}
											</ExtLink>
										{/if}
										{#if reason.typeName === REASON_KEYS.AVATAR_OUTFIT && badgeStatus.isOutfitOnly}
											<button
												class="outfit-only-indicator"
												class:info-hint-unseen={!hintsSeen.has('outfit-only')}
												onclick={(event) => event.stopPropagation()}
												onmouseenter={(event) =>
													handleHoverPopoverTriggerEnter('outfit-only', event)}
												onmouseleave={scheduleHoverPopoverClose}
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
																	onmouseleave={scheduleHoverPopoverClose}
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
													<div
														class="decoded-evidence-item"
														data-encoded-original={evidence.content}
													>
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
																<span>{$_(DETECTED_CHIP_KEYS[decodeEntry.encoding.type])}</span>
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
			<span class={part.class}>
				{part.text}
			</span>
		{/each}
	{:else}
		{headerMessage.full}
	{/if}
{/snippet}

{#if isExpanded}
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
			style:--tooltip-width={tooltipDimensions.width
				? `${String(tooltipDimensions.width)}px`
				: undefined}
			style:--tooltip-max-width={tooltipDimensions.width
				? `${String(tooltipDimensions.width)}px`
				: undefined}
			class="expanded-tooltip-positioner"
			class:is-resizing={isResizing}
		>
			<div
				bind:this={expandedCardRef}
				style:--tooltip-height={tooltipDimensions.height
					? `${String(tooltipDimensions.height)}px`
					: undefined}
				style:--tooltip-max-height={tooltipDimensions.height
					? `${String(tooltipDimensions.height)}px`
					: undefined}
				class="expanded-tooltip"
				class:has-tabs={tabs.length > 1}
				bind:clientWidth={measuredCardWidth}
			>
				<TooltipTabs {tabs} bind:activeTab />

				<div
					style:max-height={tooltipDimensions.height ? 'none' : undefined}
					class="expanded-tooltip-content"
				>
					<div bind:this={stickyHeaderRef} class="tooltip-sticky-header">
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
									{#if onViewOutfits}
										<button class="tooltip-options-item" onclick={handleViewOutfits} type="button">
											<Shirt class="tooltip-options-icon" size={15} />
											<span>{$_('outfit_viewer_button')}</span>
										</button>
									{/if}
									<div
										class="tooltip-options-export-wrapper"
										onmouseenter={scheduleSubmenuOpen}
										onmouseleave={scheduleSubmenuClose}
										role="presentation"
									>
										<button
											bind:this={exportRowRef}
											class="tooltip-options-item"
											aria-expanded={showExportSubmenu}
											aria-haspopup="menu"
											onclick={toggleExportSubmenu}
											onkeydown={handleExportRowKeydown}
											type="button"
										>
											<ImageDown class="tooltip-options-icon" size={15} />
											<span>{$_('tooltip_export_action')}</span>
											<ChevronRight class="tooltip-options-chevron" size={14} />
										</button>
										{#if showExportSubmenu}
											<div
												bind:this={exportSubmenuRef}
												class="tooltip-options-submenu"
												onkeydown={handleSubmenuKeydown}
												onmouseenter={cancelSubmenuTimers}
												onmouseleave={scheduleSubmenuClose}
												role="menu"
												tabindex="-1"
											>
												<button
													class="tooltip-options-item"
													disabled={activeExportMode !== null}
													onclick={(e) => handleExportTooltip(e, 'clipboard')}
													role="menuitem"
													type="button"
												>
													{#if exportSuccessMode === 'clipboard'}
														<Check class="tooltip-options-icon success" size={15} />
													{:else if activeExportMode === 'clipboard'}
														<LoaderCircle class="tooltip-options-icon animate-spin" size={15} />
													{:else}
														<Copy class="tooltip-options-icon" size={15} />
													{/if}
													<span>{$_('tooltip_export_copy_clipboard')}</span>
												</button>
												<div class="tooltip-options-divider"></div>
												{#each SAVE_AS_FORMATS as { format, labelKey } (format)}
													<button
														class="tooltip-options-item"
														disabled={activeExportMode !== null}
														onclick={(e) => handleExportTooltip(e, format)}
														role="menuitem"
														type="button"
													>
														{#if exportSuccessMode === format}
															<Check class="tooltip-options-icon success" size={15} />
														{:else if activeExportMode === format}
															<LoaderCircle class="tooltip-options-icon animate-spin" size={15} />
														{:else}
															<ImageDown class="tooltip-options-icon" size={15} />
														{/if}
														<span>{$_(labelKey)}</span>
														<span class="tooltip-options-item-suffix">.{format}</span>
													</button>
												{/each}
											</div>
										{/if}
									</div>
									{#if activeUserStatus?.engineVersion}
										<div class="tooltip-options-divider"></div>
										<div class="tooltip-options-engine">
											<span class="tooltip-options-engine-tag {engineVersionStatus}">
												{activeUserStatus.engineVersion} ·
												{$_(ENGINE_STATUS_KEY[engineVersionStatus])}
											</span>
										</div>
									{/if}
								</div>
							{/if}
						</div>

						{#if isGroup && groupInfo}
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
								<div class="tooltip-compact-header-right" class:is-visible={showCompactColumns}>
									{@render compactHeaderRight()}
								</div>
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
								<div class="tooltip-compact-header-right" class:is-visible={showCompactColumns}>
									{@render compactHeaderRight()}
								</div>
							</div>
						{/if}

						<!-- Header message and reviewer -->
						<div class="tooltip-standard-header" class:is-hidden={showCompactColumns}>
							{#if (userInfo || groupInfo) && (activeStatus || isNoData)}
								<div class="tooltip-header">
									<div class="header-message">
										{@render headerMessageSection(headerMessage)}
									</div>
								</div>
							{/if}
							{@render reviewerSection()}
						</div>

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
		</div>
		<HoverPopover bind:this={hoverPopover} scrollContent={scrollContentRef} />
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
		<TooltipTabs {tabs} bind:activeTab />

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
		<HoverPopover bind:this={hoverPopover} scrollContent={scrollContentRef} />
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
