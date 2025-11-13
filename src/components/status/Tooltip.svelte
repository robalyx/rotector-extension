<script lang="ts">
	import { STATUS } from '@/lib/types/constants';
	import type { ReviewerInfo, UserStatus, VoteData } from '@/lib/types/api';
	import { logger } from '@/lib/utils/logger';
	import { extractErrorMessage, sanitizeEntityId } from '@/lib/utils/sanitizer';
	import { calculateStatusBadges } from '@/lib/utils/status-utils';
	import { apiClient } from '@/lib/services/api-client';
	import { voteDataService } from '@/lib/services/vote-data-service';
	import {
		type FormattedReasonEntry,
		formatViolationReasons
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
	import {
		User,
		AlertCircle,
		Shirt,
		Clock,
		Loader2,
		Check,
		RefreshCw,
		Languages,
		FileText
	} from 'lucide-svelte';
	import LoadingSpinner from '../ui/LoadingSpinner.svelte';
	import VotingWidget from './VotingWidget.svelte';
	import EngineVersionIndicator from './EngineVersionIndicator.svelte';
	import { get } from 'svelte/store';
	import { t, getCurrentLanguage } from '@/lib/stores/i18n';
	import { SETTINGS_KEYS } from '@/lib/types/settings';

	import type { CombinedStatus } from '@/lib/types/custom-api';
	import { ROTECTOR_API_ID } from '@/lib/services/unified-query-service';
	import { settings, updateSetting } from '@/lib/stores/settings';

	interface Props {
		userId: string | number;
		userStatus?: CombinedStatus | null;
		error?: string | null;
		anchorElement: HTMLElement;
		mode?: 'preview' | 'expanded';
		entityType?: 'user' | 'group';
		onQueue?: (isReprocess?: boolean, userStatus?: UserStatus | null) => void;
		onClose?: () => void;
		onExpand?: () => void;
		element?: HTMLElement;
		onMouseEnter?: () => void;
		onMouseLeave?: () => void;
	}

	let {
		userId,
		userStatus = null,
		error = null,
		anchorElement,
		mode = 'preview',
		entityType = 'user',
		onQueue,
		onClose,
		onExpand,
		element = $bindable(),
		onMouseEnter,
		onMouseLeave
	}: Props = $props();

	// Local state
	let tooltipRef = $state<HTMLElement>();
	let overlayRef = $state<HTMLElement>();
	let voteData: VoteData | null = $state(null);
	let loadingVotes = $state(false);
	let voteError = $state<string | null>(null);
	let userInfo: UserInfo | null = $state(null);
	let groupInfo: GroupInfo | null = $state(null);
	let activeTab = $state<string>(ROTECTOR_API_ID);

	// Translation state
	let translationsMap = $state<Record<string, string>>({});
	let isTranslating = $state(false);
	let translationError = $state<string | null>(null);
	let showTranslated = $state(true); // Toggle between original and translated text
	let translationAttempted = $state(false); // Track if we've tried translating

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

		const apiResult = userStatus.customApis.get(activeTab);
		return apiResult?.data ?? null;
	});

	// Get active error based on selected tab
	const activeError = $derived.by(() => {
		if (!userStatus) return error;

		const apiResult = userStatus.customApis.get(activeTab);
		return apiResult?.error ?? error ?? null;
	});

	// Get active loading state based on selected tab
	const activeLoading = $derived.by(() => {
		if (!userStatus) return false;

		const apiResult = userStatus.customApis.get(activeTab);
		return apiResult?.loading ?? false;
	});

	// Get ordered tabs
	const tabs = $derived.by(() => {
		if (!userStatus) return [];

		return Array.from(userStatus.customApis.entries(), ([apiId, result]) => ({
			id: apiId,
			name: result.apiName,
			loading: result.loading,
			error: !!result.error && !result.data,
			landscapeImageDataUrl: result.landscapeImageDataUrl
		}));
	});

	// Set default active tab
	$effect(() => {
		if (!userStatus) return;

		// First priority: Check if user has a preferred tab and if it exists in current results
		const preferredTab = get(settings).lastSelectedCustomApiTab;
		if (preferredTab && userStatus.customApis.has(preferredTab)) {
			activeTab = preferredTab;
			return;
		}

		// Second priority: If Rotector returns Safe (flagType 0) and custom APIs exist
		const rotector = userStatus.customApis.get(ROTECTOR_API_ID);
		const allApisSafe = Array.from(userStatus.customApis.values()).every(
			(result) => !result.data || result.data.flagType === STATUS.FLAGS.SAFE
		);

		if (rotector?.data?.flagType === STATUS.FLAGS.SAFE && userStatus.customApis.size > 1) {
			// If ALL APIs are safe, show Rotector tab
			if (allApisSafe) {
				activeTab = ROTECTOR_API_ID;
				return;
			}

			// Or else open first custom API that detected something
			const firstCustomWithDetection = Array.from(userStatus.customApis.entries()).find(
				([id, result]) =>
					id !== ROTECTOR_API_ID && result.data && result.data.flagType !== STATUS.FLAGS.SAFE
			);

			if (firstCustomWithDetection) {
				activeTab = firstCustomWithDetection[0];
				return;
			}
		}

		// Third priority: Open Rotector tab
		activeTab = ROTECTOR_API_ID;
	});

	// Computed values
	const sanitizedUserId = $derived.by(() => {
		const id = sanitizeEntityId(userId);
		return id ? id.toString() : '';
	});

	const isGroup = $derived(entityType === 'group');

	// Type guard for UserStatus properties
	const activeUserStatus = $derived.by(() => {
		const status = activeStatus;
		return !isGroup && status ? (status as UserStatus) : null;
	});

	const shouldShowVoting = $derived(
		!isGroup &&
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
				activeUserStatus.flagType === STATUS.FLAGS.PAST_OFFENDER ||
				(activeUserStatus.flagType === STATUS.FLAGS.QUEUED && activeUserStatus.processed === true))
	);

	const isExpanded = $derived(mode === 'expanded');

	// Get custom API badges for active tab
	const customApiBadges = $derived.by(() => {
		if (activeTab === ROTECTOR_API_ID || isGroup || !userStatus) return [];

		const data = userStatus.customApis.get(activeTab)?.data;
		return data && 'badges' in data ? (data.badges ?? []) : [];
	});

	// Get header message from flag and confidence
	function getHeaderMessageFromFlag(
		flag: number,
		confidence = 0,
		currentStatus?: UserStatus | null
	): string {
		const entityType = t(isGroup ? 'tooltip_entity_group' : 'tooltip_entity_user');

		switch (flag) {
			case STATUS.FLAGS.UNSAFE:
				return t('tooltip_header_unsafe', [entityType]);
			case STATUS.FLAGS.PENDING: {
				const confidencePercent = Math.round(confidence * 100);
				return t('tooltip_header_pending', [entityType, confidencePercent.toString()]);
			}
			case STATUS.FLAGS.QUEUED:
				// Check if processed to determine message
				if (currentStatus?.processed === true) {
					return t('tooltip_header_queued_safe', [entityType]);
				} else {
					return t('tooltip_header_queued_processing', [entityType]);
				}
			case STATUS.FLAGS.INTEGRATION:
				return t('tooltip_header_integration', [entityType]);
			case STATUS.FLAGS.MIXED:
				if (isGroup) {
					return t('tooltip_header_mixed_group');
				} else {
					return t('tooltip_header_mixed_user');
				}
			case STATUS.FLAGS.PAST_OFFENDER:
				return t('tooltip_header_past_offender', [entityType]);
			case STATUS.FLAGS.SAFE:
				return t('tooltip_header_safe', [entityType]);
			default:
				return t('tooltip_header_unavailable');
		}
	}

	const headerMessage = $derived.by(() => {
		if (activeError) return t('tooltip_error_details');
		if (!activeStatus) return t('tooltip_loading');

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
				return getHeaderMessageFromFlag(currentStatus.flagType, confidence, currentStatus);
			default:
				return t('tooltip_header_unknown');
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
				return !isGroup && (currentStatus as UserStatus).processed === true
					? 'likely-safe'
					: 'pending';
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
		const currentStatus = activeStatus;
		if (!currentStatus) return t('tooltip_status_unknown');

		switch (currentStatus.flagType) {
			case STATUS.FLAGS.SAFE:
				return t('tooltip_status_not_flagged');
			case STATUS.FLAGS.UNSAFE:
				return t('tooltip_status_unsafe');
			case STATUS.FLAGS.PENDING:
				return t('tooltip_status_under_review');
			case STATUS.FLAGS.QUEUED:
				return !isGroup && (currentStatus as UserStatus).processed === true
					? t('tooltip_status_likely_safe')
					: t('tooltip_status_checking');
			case STATUS.FLAGS.INTEGRATION:
				return t('tooltip_status_integration');
			case STATUS.FLAGS.MIXED:
				return t('tooltip_status_mixed');
			case STATUS.FLAGS.PAST_OFFENDER:
				return t('tooltip_status_past_offender');
			default:
				return t('tooltip_status_unknown');
		}
	});

	const reasonEntries = $derived.by((): FormattedReasonEntry[] => {
		const currentStatus = activeStatus;
		if (!currentStatus?.reasons || currentStatus.flagType === STATUS.FLAGS.SAFE) return [];
		return formatViolationReasons(currentStatus.reasons, entityType);
	});

	// Check if auto-translation should be enabled
	const shouldAutoTranslate = $derived.by(() => {
		const translateEnabled = $settings[SETTINGS_KEYS.TRANSLATE_VIOLATIONS_ENABLED];
		const hasReasons = reasonEntries.length > 0;
		return translateEnabled && hasReasons;
	});

	// Get text to display (original or translated)
	function getDisplayText(originalText: string): string {
		if (!showTranslated) return originalText;
		return translationsMap[originalText] || originalText;
	}

	const reviewerInfo = $derived.by((): ReviewerInfo | null => {
		if (isGroup) return null;
		const currentStatus = activeUserStatus;
		if (!currentStatus?.reviewer) return null;
		return currentStatus.reviewer;
	});

	const badgeStatus = $derived.by(() => calculateStatusBadges(activeUserStatus));

	const isOutdated = $derived.by(() => {
		if (isGroup) return false;
		const currentStatus = activeUserStatus;
		if (!currentStatus?.lastUpdated) return false;
		const daysSince = getDaysSinceTimestamp(currentStatus.lastUpdated);
		return daysSince >= 7;
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

	// Extract user info from the page DOM
	function getPageUserInfo(): UserInfo | null {
		if (!anchorElement) return null;

		const userId = sanitizedUserId;
		if (!userId) return null;

		const { pageType, container } = detectPageContext(anchorElement);
		return extractUserInfo(userId, pageType, container);
	}

	// Extract group info from the page DOM
	function getPageGroupInfo(): GroupInfo | null {
		if (!anchorElement) return null;

		const groupId = sanitizedUserId;
		if (!groupId) return null;

		const { pageType, container } = detectPageContext(anchorElement);
		return extractGroupInfo(groupId, pageType, container);
	}

	// Positioning for preview tooltips
	function positionTooltip() {
		if (!tooltipRef || !anchorElement || isExpanded) return;

		const position = calculateTooltipPosition(tooltipRef, anchorElement);
		applyTooltipPosition(tooltipRef, position);
	}

	// Calculate transform-origin for expanded tooltip animation
	function getTransformOrigin() {
		return anchorElement ? calculateTransformOrigin(anchorElement) : { originX: 50, originY: 50 };
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
			voteError = 'Failed to load voting data';
			logger.error('Failed to load vote data:', err);
		} finally {
			loadingVotes = false;
		}
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
			onQueue(true, activeStatus);
		}
	}

	// Handle expand tooltip click
	function handleExpand() {
		if (!isExpanded && onExpand) {
			onExpand();
		}
	}

	// Reset translation state when switching tabs
	$effect(() => {
		void activeTab;
		translationsMap = {};
		translationError = null;
		translationAttempted = false;
		showTranslated = true;
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

			const currentLanguage = getCurrentLanguage();
			const isEnglishUser = currentLanguage.split('-')[0].toLowerCase() === 'en';

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
							textsForReason.push(evidence.content);
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
		if (
			tooltipRef &&
			event.target instanceof Node &&
			!tooltipRef.contains(event.target) &&
			!anchorElement.contains(event.target) &&
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
		if (!overlayRef || !tooltipRef || !anchorElement) {
			onClose?.();
			return;
		}

		const { originX, originY } = getTransformOrigin();
		tooltipRef.style.setProperty('--tooltip-origin-x', `${originX}%`);
		tooltipRef.style.setProperty('--tooltip-origin-y', `${originY}%`);

		overlayRef.classList.remove('visible');
		tooltipRef.style.transform = 'translate(-50%, -50%) scale(0.05)';
		tooltipRef.style.opacity = '0';

		setTimeout(() => {
			onClose?.();
		}, 350);
	}

	// Load vote data when tooltip becomes visible
	let hasLoadedVoteData = $state(false);

	$effect(() => {
		if (shouldShowVoting && !hasLoadedVoteData && !loadingVotes) {
			hasLoadedVoteData = true;
			loadVoteData().catch((error) => {
				logger.error('Failed to load vote data:', error);
			});
		}
	});

	// Setup and cleanup
	$effect(() => {
		element = tooltipRef;

		if (isGroup) {
			groupInfo = getPageGroupInfo();
		} else {
			userInfo = getPageUserInfo();
		}

		if (isExpanded) {
			// Expanded tooltip setup
			if (anchorElement && tooltipRef) {
				const { originX, originY } = getTransformOrigin();
				tooltipRef.style.setProperty('--tooltip-origin-x', `${originX}%`);
				tooltipRef.style.setProperty('--tooltip-origin-y', `${originY}%`);
				tooltipRef.style.top = '50%';
				tooltipRef.style.left = '50%';
				tooltipRef.style.transform = 'translate(-50%, -50%) scale(0.05)';
				tooltipRef.style.opacity = '0';
			}

			document.addEventListener('keydown', handleKeydown);

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
			};
		} else {
			// Preview tooltip setup
			requestAnimationFrame(() => {
				positionTooltip();
			});

			document.addEventListener('keydown', handleKeydown);
			document.addEventListener('click', handleClickOutside);
			window.addEventListener('resize', positionTooltip);

			return () => {
				document.removeEventListener('keydown', handleKeydown);
				document.removeEventListener('click', handleClickOutside);
				window.removeEventListener('resize', positionTooltip);
			};
		}
	});
</script>

{#snippet reviewerSection()}
	{#if reviewerInfo}
		{@const reviewer = reviewerInfo}
		{#if reviewer}
			<div class="reviewer-section">
				<User class="reviewer-icon" size={14} />
				<span class="reviewer-text">
					{t('tooltip_reviewer_reviewed_by')}
					<span class="reviewer-name">
						{#if reviewer.displayName && reviewer.username && reviewer.displayName !== reviewer.username}
							{reviewer.displayName} (@{reviewer.username})
						{:else}
							{reviewer.displayName || reviewer.username}
						{/if}
					</span>
				</span>
			</div>
		{/if}
	{/if}
{/snippet}

{#snippet metadataSection()}
	{@const metadata = metadataInfo}
	{#if metadata}
		<div class="tooltip-metadata">
			{#if metadata?.queuedTime}
				<div class="tooltip-metadata-item" title={metadata?.queuedExact}>
					<Clock class="tooltip-metadata-icon" size={10} strokeWidth={2} />
					<span class="tooltip-metadata-label">{t('tooltip_metadata_queued')}</span>
					<span class="tooltip-metadata-value">{metadata?.queuedTime}</span>
				</div>
			{/if}

			{#if metadata?.duration}
				<div
					class="tooltip-metadata-item"
					class:processing={metadata?.isProcessing}
					title={metadata?.processedExact || t('tooltip_metadata_processing_status')}
				>
					{#if metadata?.isProcessing}
						<Loader2 class="tooltip-metadata-icon animate-spin" size={10} strokeWidth={2} />
					{:else}
						<Check class="tooltip-metadata-icon" size={10} strokeWidth={2} />
					{/if}
					<span class="tooltip-metadata-label">
						{#if metadata?.isProcessing}{t('tooltip_metadata_processing')}{:else}{t(
								'tooltip_metadata_took'
							)}{/if}
					</span>
					<span class="tooltip-metadata-value">{metadata?.duration}</span>
				</div>
			{/if}

			{#if metadata?.lastUpdatedTime}
				<div class="tooltip-metadata-item" title={metadata?.lastUpdatedExact}>
					<Clock class="tooltip-metadata-icon" size={10} strokeWidth={2} />
					<span class="tooltip-metadata-label">{t('tooltip_metadata_last_updated')}</span>
					<span class="tooltip-metadata-value">{metadata?.lastUpdatedTime}</span>
				</div>
			{/if}

			{#if isOutdated && !metadata?.isProcessing}
				<button
					class="tooltip-metadata-reprocess"
					onclick={handleReprocessRequest}
					title={t('tooltip_metadata_reprocess_title')}
					type="button"
				>
					<RefreshCw class="tooltip-metadata-icon" size={10} strokeWidth={2} />
					<span class="tooltip-metadata-label">{t('tooltip_metadata_reprocess_button')}</span>
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
					class:has-image={hasImage}
					class:loading={!hasImage && tab.loading}
					onclick={(e) => {
						e.stopPropagation();
						activeTab = tab.id;
						// Save tab preference for future tooltip opens
						updateSetting('lastSelectedCustomApiTab', tab.id).catch((error) => {
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
								const textSpan = target.nextElementSibling as HTMLSpanElement;
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
							<AlertCircle class="tooltip-tab-error-indicator" size={12} />
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

{#snippet tooltipContent()}
	{#if activeError}
		<!-- Error state -->
		<div class="error-details">
			{extractErrorMessage(activeError)}
		</div>
	{:else if activeLoading}
		<!-- Loading state -->
		<div class="flex items-center gap-2 justify-center py-2">
			<LoadingSpinner size="small" />
			<span class="text-xs">{t('tooltip_loading_user_info')}</span>
		</div>
	{:else if !activeStatus}
		<!-- No data state -->
		<div class="error-details">{t('tooltip_no_data_available')}</div>
	{:else}
		<!-- Status information -->
		<div>
			{#if isSafeUserWithQueueOnly}
				<!-- Safe users: Only show queue button -->
				<div class="flex gap-2">
					<button
						class="queue-button w-full"
						onclick={(e) => {
							e.stopPropagation();
							handleQueueSubmit();
						}}
						type="button"
					>
						{t('tooltip_queue_button')}
					</button>
				</div>

				<!-- Queue timing information -->
				{@render metadataSection()}
			{:else}
				<!-- Non-safe users -->

				<!-- Custom API Badges -->
				{@render customBadgesSection()}

				<!-- Status badges -->
				{#if activeTab === ROTECTOR_API_ID && ((!isGroup && (badgeStatus.isReportable || badgeStatus.isOutfitOnly)) || activeStatus?.isQueued)}
					<div class="flex gap-1.5 mb-2 justify-center flex-wrap">
						{#if !isGroup && badgeStatus.isReportable}
							<span class="tooltip-badge tooltip-badge-reportable">
								{t('tooltip_badge_reportable')}
							</span>
						{/if}
						{#if activeStatus?.isQueued}
							<span class="tooltip-badge tooltip-badge-queued"> {t('tooltip_badge_queued')} </span>
						{/if}
						{#if !isGroup && badgeStatus.isOutfitOnly}
							<span class="tooltip-badge tooltip-badge-outfit"> {t('tooltip_badge_outfit')} </span>
						{/if}
					</div>
				{/if}

				<!-- Voting widget for unsafe/pending users -->
				{#if shouldShowVoting}
					<VotingWidget
						error={voteError}
						loading={loadingVotes}
						onVote={handleVoteSubmit}
						{voteData}
					/>
				{/if}

				<!-- Reportable notice -->
				{#if activeTab === ROTECTOR_API_ID && !isGroup && badgeStatus.isReportable}
					<div class="tooltip-divider"></div>
					<div class="reportable-notice">
						<AlertCircle class="reportable-icon" size={24} />
						<div class="reportable-text">
							<strong>{t('tooltip_reportable_title')}</strong>
							<p>
								{t('tooltip_reportable_message')}
							</p>
							<a
								class="report-button"
								href="https://www.roblox.com/report-abuse/?targetId={sanitizedUserId}&submitterId=0&abuseVector=userprofile&nl=true"
								onclick={(e) => e.stopPropagation()}
								rel="noopener noreferrer"
								target="_blank"
							>
								{t('tooltip_reportable_report_button')}
							</a>
						</div>
					</div>
				{/if}

				<!-- Outfit notice -->
				{#if activeTab === ROTECTOR_API_ID && !isGroup && badgeStatus.isOutfitOnly}
					<div class="tooltip-divider"></div>
					<div class="outfit-notice">
						<Shirt class="outfit-icon" size={24} />
						<div class="outfit-text">
							<strong>{t('tooltip_outfit_title')}</strong>
							<p>
								{t('tooltip_outfit_message')}
							</p>
						</div>
					</div>
				{/if}

				<!-- Reasons -->
				{#if reasonEntries.length > 0}
					<!-- Show divider if there's content above -->
					{#if shouldShowVoting || (activeTab === ROTECTOR_API_ID && !isGroup && (badgeStatus.isReportable || badgeStatus.isOutfitOnly)) || customApiBadges.length > 0}
						<div class="tooltip-divider"></div>
					{/if}

					<!-- Translation status/toggle -->
					{#if shouldAutoTranslate}
						{#if isTranslating}
							<!-- Loading state -->
							<div class="translate-status-container">
								<LoadingSpinner size="small" />
								<span class="translate-status-text">{t('tooltip_translation_translating')}</span>
							</div>
						{:else if translationError}
							<!-- Error state -->
							<div class="translate-status-container">
								<span class="translate-error">{t('tooltip_translation_failed')}</span>
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
										<span>{t('tooltip_translation_view_original')}</span>
									{:else}
										<Languages size={11} />
										<span>{t('tooltip_translation_view_translated')}</span>
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
								</div>
								{#if reason.message}
									<div class="reason-message">
										{getDisplayText(reason.message)}
									</div>
								{/if}
								{#if reason.evidence && reason.evidence.length > 0}
									<div class="reason-evidence">
										{#each reason.evidence as evidence, index (index)}
											{#if evidence.type === 'outfit' && evidence.outfitName && evidence.outfitReason}
												<div class="evidence-item outfit-evidence-item">
													<div class="outfit-evidence-header">
														<div class="outfit-name">{getDisplayText(evidence.outfitName)}</div>
														{#if evidence.outfitConfidence !== null}
															<div class="outfit-confidence-badge">
																{evidence.outfitConfidence}
																%
															</div>
														{/if}
													</div>
													<div class="outfit-reason">{getDisplayText(evidence.outfitReason)}</div>
												</div>
											{:else}
												<div class="evidence-item">{getDisplayText(evidence.content)}</div>
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

{#if isExpanded}
	<!-- Expanded tooltip structure -->
	<div
		bind:this={overlayRef}
		class="expanded-tooltip-overlay"
		aria-label={t('tooltip_aria_close')}
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
		<div bind:this={tooltipRef} class="expanded-tooltip" class:has-tabs={tabs.length > 1}>
			<!-- Tab Navigation -->
			{@render tabNavigation()}

			<!-- Tooltip content -->
			<div class="expanded-tooltip-content">
				<div class="tooltip-sticky-header">
					<!-- Engine Version -->
					{#if activeUserStatus?.engineVersion}
						<EngineVersionIndicator position="inline" status={activeUserStatus} />
					{/if}

					<!-- Profile Header -->
					{#if isGroup && groupInfo}
						<!-- Group Header -->
						<div class="tooltip-profile-header">
							<div class="tooltip-avatar">
								<img alt="" src={groupInfo.groupImageUrl} />
							</div>
							<div class="tooltip-user-info">
								<div class="tooltip-username">{groupInfo.groupName}</div>
								<div class="tooltip-user-id">{t('tooltip_profile_group_id')} {sanitizedUserId}</div>
								<div class="tooltip-status-badge {statusBadgeClass}">
									<span class="status-indicator"></span>
									{statusBadgeText}
								</div>
							</div>
						</div>
					{:else if !isGroup && userInfo}
						<!-- User Header -->
						<div class="tooltip-profile-header">
							<div class="tooltip-avatar">
								<img alt="" src={userInfo.avatarUrl} />
							</div>
							<div class="tooltip-user-info">
								<div class="tooltip-username">{userInfo.username}</div>
								<div class="tooltip-user-id">{t('tooltip_profile_id')} {sanitizedUserId}</div>
								<div class="tooltip-status-badge {statusBadgeClass}">
									<span class="status-indicator"></span>
									{statusBadgeText}
								</div>
							</div>
						</div>
					{:else}
						<!-- Fallback header -->
						<div class="tooltip-header">
							<div>{error ? t('tooltip_error_details') : t('tooltip_loading')}</div>
							<div class="tooltip-user-id">
								{isGroup ? t('tooltip_entity_group') : t('tooltip_profile_user')}
								{t('tooltip_profile_id')}
								{sanitizedUserId}
							</div>
						</div>
					{/if}

					<!-- Header message -->
					{#if (userInfo || groupInfo) && activeStatus}
						<div class="tooltip-header">
							<div>{headerMessage}</div>
						</div>
					{/if}

					<!-- Reviewer Section -->
					{@render reviewerSection()}
				</div>

				<!-- Scrollable content -->
				<div class="tooltip-scrollable-content px-5 py-4 flex-1">
					{@render tooltipContent()}
				</div>
			</div>
		</div>
	</div>
{:else}
	<!-- Preview tooltip structure -->
	<div
		bind:this={tooltipRef}
		class="rtcr-tooltip-container"
		aria-label={t('tooltip_aria_expand')}
		aria-labelledby="tooltip-header"
		onclick={handleExpand}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				handleExpand();
			}
		}}
		onmouseenter={onMouseEnter}
		onmouseleave={onMouseLeave}
		role="button"
		tabindex="0"
	>
		<!-- Tab Navigation -->
		{@render tabNavigation()}

		<!-- Sticky header -->
		<div class="tooltip-sticky-header">
			<!-- Simple header -->
			<div id="tooltip-header" class="tooltip-header">
				<div>{headerMessage}</div>
			</div>

			<!-- Reviewer Section -->
			{@render reviewerSection()}
		</div>

		<!-- Content -->
		<div class="tooltip-scrollable-content px-3 py-2 text-left">
			{@render tooltipContent()}
		</div>
	</div>
{/if}
