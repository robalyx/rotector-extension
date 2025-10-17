<script lang="ts">
	import { INTEGRATION_SOURCE_NAMES, STATUS } from '@/lib/types/constants';
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
	import { User, AlertCircle, Shirt, Clock, Loader2, Check, RefreshCw } from 'lucide-svelte';
	import LoadingSpinner from '../ui/LoadingSpinner.svelte';
	import VotingWidget from './VotingWidget.svelte';
	import EngineVersionIndicator from './EngineVersionIndicator.svelte';

	interface Props {
		userId: string | number;
		status?: UserStatus | null;
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
		status = null,
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

	// Computed values
	const sanitizedUserId = $derived(() => {
		const id = sanitizeEntityId(userId);
		return id ? id.toString() : '';
	});

	const isGroup = $derived(() => entityType === 'group');

	const shouldShowVoting = $derived(
		() =>
			!isGroup() &&
			status &&
			(status.flagType === STATUS.FLAGS.UNSAFE ||
				status.flagType === STATUS.FLAGS.PENDING ||
				status.flagType === STATUS.FLAGS.INTEGRATION ||
				(status.flagType === STATUS.FLAGS.QUEUED && status.processed === true))
	);

	const isSafeUserWithQueueOnly = $derived(
		() =>
			!isGroup() &&
			status &&
			(status.flagType === STATUS.FLAGS.SAFE ||
				status.flagType === STATUS.FLAGS.PAST_OFFENDER ||
				(status.flagType === STATUS.FLAGS.QUEUED && status.processed === true))
	);

	const isExpanded = $derived(() => mode === 'expanded');

	// Get header message from flag and confidence
	function getHeaderMessageFromFlag(
		flag: number,
		confidence = 0,
		currentStatus?: UserStatus | null
	): string {
		// Handle mixed status for groups
		if (isGroup() && flag === STATUS.FLAGS.MIXED) {
			return 'This group contains a mix of appropriate and inappropriate members.';
		}

		const entityType = isGroup() ? 'group' : 'user';

		switch (flag) {
			case STATUS.FLAGS.UNSAFE:
				return `This ${entityType} has been verified as inappropriate by Rotector's human moderators.`;
			case STATUS.FLAGS.PENDING: {
				const confidencePercent = Math.round(confidence * 100);
				return `This ${entityType} has been flagged by AI with ${confidencePercent}% confidence.`;
			}
			case STATUS.FLAGS.QUEUED:
				// Check if processed to determine message
				if (currentStatus?.processed === true) {
					return `This ${entityType} has been reviewed by our AI system and appears to be safe. If this is a false positive, you can requeue for further review.`;
				} else {
					return `This ${entityType} is currently being checked by our system. This may take a few minutes.`;
				}
			case STATUS.FLAGS.INTEGRATION:
				return `This ${entityType} has been flagged by a third-party content analysis system.`;
			case STATUS.FLAGS.PAST_OFFENDER:
				return `This ${entityType} had inappropriate content previously but their account currently appears clean and can be requeued for verification.`;
			case STATUS.FLAGS.SAFE:
				return `This ${entityType} has not been reviewed yet.`;
			default:
				return 'Status information unavailable.';
		}
	}

	const headerMessage = $derived(() => {
		if (error) return 'Error Details';
		if (!status) return 'Loading...';

		const confidence = status.confidence || 0;

		switch (status.flagType) {
			case STATUS.FLAGS.SAFE:
			case STATUS.FLAGS.UNSAFE:
			case STATUS.FLAGS.PENDING:
			case STATUS.FLAGS.QUEUED:
			case STATUS.FLAGS.INTEGRATION:
			case STATUS.FLAGS.MIXED:
				return getHeaderMessageFromFlag(status.flagType, confidence, status);
			default:
				return 'Unknown Status';
		}
	});

	const statusBadgeClass = $derived(() => {
		if (!status) return 'error';

		switch (status.flagType) {
			case STATUS.FLAGS.SAFE:
				return 'safe';
			case STATUS.FLAGS.UNSAFE:
				return 'unsafe';
			case STATUS.FLAGS.PENDING:
				return 'pending';
			case STATUS.FLAGS.QUEUED:
				return status.processed === true ? 'likely-safe' : 'pending';
			case STATUS.FLAGS.INTEGRATION:
				return 'integration';
			case STATUS.FLAGS.MIXED:
				return 'unsafe';
			case STATUS.FLAGS.PAST_OFFENDER:
				return 'past-offender';
			default:
				return 'error';
		}
	});

	const statusBadgeText = $derived(() => {
		if (!status) return 'Unknown';

		switch (status.flagType) {
			case STATUS.FLAGS.SAFE:
				return 'Not Flagged';
			case STATUS.FLAGS.UNSAFE:
				return 'Unsafe';
			case STATUS.FLAGS.PENDING:
				return 'Under Review';
			case STATUS.FLAGS.QUEUED:
				return status.processed === true ? 'Likely Safe' : 'Checking...';
			case STATUS.FLAGS.INTEGRATION:
				return 'Integration';
			case STATUS.FLAGS.MIXED:
				return 'Mixed';
			case STATUS.FLAGS.PAST_OFFENDER:
				return 'Past Offender';
			default:
				return 'Unknown';
		}
	});

	const reasonEntries = $derived((): FormattedReasonEntry[] => {
		if (!status?.reasons || status.flagType === STATUS.FLAGS.SAFE) return [];
		return formatViolationReasons(status.reasons, status.integrationSources, entityType);
	});

	const reviewerInfo = $derived((): ReviewerInfo | null => {
		if (!status?.reviewer) return null;
		return status.reviewer;
	});

	const badgeStatus = $derived(() => calculateStatusBadges(status));

	const integrationCount = $derived(() => {
		return status?.integrationSources ? Object.keys(status.integrationSources).length : 0;
	});

	const shouldShowIntegrationBadge = $derived(() => {
		return integrationCount() > 0 && status?.flagType !== STATUS.FLAGS.INTEGRATION;
	});

	const isOutdated = $derived(() => {
		if (!status?.lastUpdated) return false;
		const daysSince = getDaysSinceTimestamp(status.lastUpdated);
		return daysSince >= 7;
	});

	// Metadata information for processed users
	const metadataInfo = $derived(() => {
		if (!status) return null;

		const queuedAt = status.queuedAt;
		const processedAt = status.processedAt;
		const lastUpdated = status.lastUpdated;

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

	// Check if a reason comes from an integration source
	function isIntegrationReason(reason: FormattedReasonEntry): boolean {
		if (!status?.integrationSources) return false;

		return Object.values(INTEGRATION_SOURCE_NAMES).some((integrationName) =>
			reason.typeName.includes(integrationName)
		);
	}

	// Extract user info from the page DOM
	function getPageUserInfo(): UserInfo | null {
		if (!anchorElement) return null;

		const userId = sanitizedUserId();
		if (!userId) return null;

		const { pageType, container } = detectPageContext(anchorElement);
		return extractUserInfo(userId, pageType, container);
	}

	// Extract group info from the page DOM
	function getPageGroupInfo(): GroupInfo | null {
		if (!anchorElement) return null;

		const groupId = sanitizedUserId();
		if (!groupId) return null;

		const { pageType, container } = detectPageContext(anchorElement);
		return extractGroupInfo(groupId, pageType, container);
	}

	// Positioning for preview tooltips
	function positionTooltip() {
		if (!tooltipRef || !anchorElement || isExpanded()) return;

		const position = calculateTooltipPosition(tooltipRef, anchorElement);
		applyTooltipPosition(tooltipRef, position);
	}

	// Calculate transform-origin for expanded tooltip animation
	function getTransformOrigin() {
		return anchorElement ? calculateTransformOrigin(anchorElement) : { originX: 50, originY: 50 };
	}

	// Load vote data if needed
	async function loadVoteData() {
		if (!shouldShowVoting() || loadingVotes || isSafeUserWithQueueOnly()) return;

		loadingVotes = true;
		voteError = null;

		try {
			const votes = await voteDataService.getVoteData(sanitizedUserId());
			voteData = votes;
			logger.debug('Loaded vote data for user', { userId: sanitizedUserId(), votes });
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

			const result = await apiClient.submitVote(sanitizedUserId(), voteType as 1 | -1);
			voteData = result.newVoteData;

			voteDataService.updateCachedVoteData(sanitizedUserId(), result.newVoteData);

			logger.userAction('vote_submitted', {
				userId: sanitizedUserId(),
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
			onQueue(true, status);
		}
	}

	// Handle expand tooltip click
	function handleExpand() {
		if (!isExpanded() && onExpand) {
			onExpand();
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
		if (shouldShowVoting() && !hasLoadedVoteData && !loadingVotes) {
			hasLoadedVoteData = true;
			loadVoteData().catch((error) => {
				logger.error('Failed to load vote data:', error);
			});
		}
	});

	// Setup and cleanup
	$effect(() => {
		element = tooltipRef;

		if (isGroup()) {
			groupInfo = getPageGroupInfo();
		} else {
			userInfo = getPageUserInfo();
		}

		if (isExpanded()) {
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
	{#if reviewerInfo()}
		{@const reviewer = reviewerInfo()}
		{#if reviewer}
			<div class="reviewer-section">
				<User class="reviewer-icon" color="#777" size={14} />
				<span class="reviewer-text">
					Reviewed by <span class="reviewer-name">
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
	{@const metadata = metadataInfo()}
	{#if metadata}
		<div class="tooltip-metadata">
			{#if metadata.queuedTime}
				<div class="tooltip-metadata-item" title={metadata.queuedExact}>
					<Clock class="tooltip-metadata-icon" size={10} strokeWidth={2} />
					<span class="tooltip-metadata-label">Queued</span>
					<span class="tooltip-metadata-value">{metadata.queuedTime}</span>
				</div>
			{/if}

			{#if metadata.duration}
				<div
					class="tooltip-metadata-item"
					class:processing={metadata.isProcessing}
					title={metadata.processedExact || 'Processing...'}
				>
					{#if metadata.isProcessing}
						<Loader2 class="tooltip-metadata-icon animate-spin" size={10} strokeWidth={2} />
					{:else}
						<Check class="tooltip-metadata-icon" size={10} strokeWidth={2} />
					{/if}
					<span class="tooltip-metadata-label">
						{#if metadata.isProcessing}Processing{:else}Took{/if}
					</span>
					<span class="tooltip-metadata-value">{metadata.duration}</span>
				</div>
			{/if}

			{#if metadata.lastUpdatedTime}
				<div class="tooltip-metadata-item" title={metadata.lastUpdatedExact}>
					<Clock class="tooltip-metadata-icon" size={10} strokeWidth={2} />
					<span class="tooltip-metadata-label">Last Updated</span>
					<span class="tooltip-metadata-value">{metadata.lastUpdatedTime}</span>
				</div>
			{/if}

			{#if isOutdated()}
				<button
					class="tooltip-metadata-reprocess"
					onclick={handleReprocessRequest}
					title="This user's data is outdated. Click to requeue for analysis."
					type="button"
				>
					<RefreshCw class="tooltip-metadata-icon" size={10} strokeWidth={2} />
					<span class="tooltip-metadata-label">Reprocess?</span>
				</button>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet tooltipContent()}
	{#if error}
		<!-- Error state -->
		<div class="error-details">
			{extractErrorMessage(error)}
		</div>
	{:else if !status}
		<!-- Loading state -->
		<div class="flex items-center gap-2 justify-center py-2">
			<LoadingSpinner size="small" />
			<span class="text-xs">Loading user information...</span>
		</div>
	{:else}
		<!-- Status information -->
		<div>
			{#if isSafeUserWithQueueOnly()}
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
						Queue for Review
					</button>
				</div>

				<!-- Queue timing information -->
				{@render metadataSection()}
			{:else}
				<!-- Non-safe users: Show full content -->
				<!-- Status badges -->
				{#if (!isGroup() && (badgeStatus().isReportable || badgeStatus().isOutfitOnly)) || status.isQueued || shouldShowIntegrationBadge()}
					<div class="flex gap-1.5 mb-2 justify-center flex-wrap">
						{#if !isGroup() && badgeStatus().isReportable}
							<span class="tooltip-badge tooltip-badge-reportable"> Reportable </span>
						{/if}
						{#if status.isQueued}
							<span class="tooltip-badge tooltip-badge-queued"> Queued </span>
						{/if}
						{#if shouldShowIntegrationBadge()}
							<span class="tooltip-badge tooltip-badge-integration">
								{integrationCount() === 1 ? 'Integration' : `Integration (${integrationCount()})`}
							</span>
						{/if}
						{#if !isGroup() && badgeStatus().isOutfitOnly}
							<span class="tooltip-badge tooltip-badge-outfit"> Outfit Only </span>
						{/if}
					</div>
				{/if}

				<!-- Voting widget for unsafe/pending users -->
				{#if shouldShowVoting()}
					<VotingWidget
						error={voteError}
						loading={loadingVotes}
						onVote={handleVoteSubmit}
						{voteData}
					/>
				{/if}

				<!-- Reportable notice (only for users) -->
				{#if !isGroup() && badgeStatus().isReportable}
					<div class="tooltip-divider"></div>
					<div class="reportable-notice">
						<AlertCircle class="reportable-icon" color="#ff4444" size={24} />
						<div class="reportable-text">
							<strong>Reportable to Roblox</strong>
							<p>
								This user has clear evidence of inappropriate content that is visible to Roblox
								moderators.
							</p>
							<a
								class="report-button"
								href="https://www.roblox.com/report-abuse/?targetId={sanitizedUserId()}&submitterId=0&abuseVector=userprofile&nl=true"
								onclick={(e) => e.stopPropagation()}
								rel="noopener noreferrer"
								target="_blank"
							>
								Report to Roblox
							</a>
						</div>
					</div>
				{/if}

				<!-- Outfit notice (only for users) -->
				{#if !isGroup() && badgeStatus().isOutfitOnly}
					<div class="tooltip-divider"></div>
					<div class="outfit-notice">
						<Shirt class="outfit-icon" color="white" size={24} />
						<div class="outfit-text">
							<strong>Flagged for Outfit Only</strong>
							<p>
								This user was flagged solely based on their avatar outfit. Outfit detection can have
								false positives, so please use your own judgment when evaluating this user.
							</p>
						</div>
					</div>
				{/if}

				<!-- Reasons -->
				{#if reasonEntries().length > 0}
					<!-- Only show divider if there's content above (voting, badges, or notices) -->
					{#if shouldShowVoting() || (!isGroup() && (badgeStatus().isReportable || badgeStatus().isOutfitOnly))}
						<div class="tooltip-divider"></div>
					{/if}
					<div class="reasons-container">
						{#each reasonEntries() as reason (reason.typeName)}
							<div class="reason-item">
								<div class="reason-header" class:integration={isIntegrationReason(reason)}>
									{reason.typeName} ({reason.confidence}%)
								</div>
								{#if reason.message}
									<div class="reason-message">
										{reason.message}
									</div>
								{/if}
								{#if reason.evidence && reason.evidence.length > 0}
									<div class="reason-evidence">
										{#each reason.evidence as evidence, index (index)}
											{#if evidence.type === 'outfit' && evidence.outfitName && evidence.outfitReason}
												<div class="evidence-item outfit-evidence-item">
													<div class="outfit-evidence-header">
														<div class="outfit-name">{evidence.outfitName}</div>
														{#if evidence.outfitConfidence !== null}
															<div class="outfit-confidence-badge">
																{evidence.outfitConfidence}
																%
															</div>
														{/if}
													</div>
													<div class="outfit-reason">{evidence.outfitReason}</div>
												</div>
											{:else}
												<div class="evidence-item">{evidence.content}</div>
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

{#if isExpanded()}
	<!-- Expanded tooltip structure -->
	<div
		bind:this={overlayRef}
		class="expanded-tooltip-overlay"
		aria-label="Click to close tooltip"
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
		<div bind:this={tooltipRef} class="expanded-tooltip">
			<!-- Close button -->
			<button
				class="expanded-tooltip-close"
				aria-label="Close"
				onclick={closeWithAnimation}
				type="button"
			>
				×
			</button>

			<!-- Tooltip content -->
			<div class="expanded-tooltip-content">
				<div class="tooltip-sticky-header">
					<!-- Engine Version -->
					{#if status?.engineVersion}
						<EngineVersionIndicator position="inline" {status} />
					{/if}

					<!-- Profile Header -->
					{#if isGroup() && groupInfo}
						<!-- Group Header -->
						<div class="tooltip-profile-header">
							<div class="tooltip-avatar">
								<img alt="" src={groupInfo.groupImageUrl} />
							</div>
							<div class="tooltip-user-info">
								<div class="tooltip-username">{groupInfo.groupName}</div>
								<div class="tooltip-user-id">Group ID: {sanitizedUserId()}</div>
								<div class="tooltip-status-badge {statusBadgeClass()}">
									<span class="status-indicator"></span>
									{statusBadgeText()}
								</div>
							</div>
						</div>
					{:else if !isGroup() && userInfo}
						<!-- User Header -->
						<div class="tooltip-profile-header">
							<div class="tooltip-avatar">
								<img alt="" src={userInfo.avatarUrl} />
							</div>
							<div class="tooltip-user-info">
								<div class="tooltip-username">{userInfo.username}</div>
								<div class="tooltip-user-id">ID: {sanitizedUserId()}</div>
								<div class="tooltip-status-badge {statusBadgeClass()}">
									<span class="status-indicator"></span>
									{statusBadgeText()}
								</div>
							</div>
						</div>
					{:else}
						<!-- Fallback header -->
						<div class="tooltip-header">
							<div>{error ? 'Error Details' : 'Loading...'}</div>
							<div class="tooltip-user-id">
								{isGroup() ? 'Group' : 'User'} ID: {sanitizedUserId()}
							</div>
						</div>
					{/if}

					<!-- Header message -->
					{#if (userInfo || groupInfo) && status}
						<div class="tooltip-header">
							<div>{headerMessage()}</div>
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
		aria-label="Click to expand tooltip"
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
		<!-- Sticky header -->
		<div class="tooltip-sticky-header">
			<!-- Simple header -->
			<div class="tooltip-header">
				<div>{headerMessage()}</div>
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
