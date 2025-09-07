<script lang="ts">
    import {INTEGRATION_SOURCE_NAMES, STATUS} from '@/lib/types/constants';
    import type {ReviewerInfo, UserStatus, VoteData} from '@/lib/types/api';
    import {logger} from '@/lib/utils/logger';
    import {extractErrorMessage, sanitizeEntityId} from '@/lib/utils/sanitizer';
    import {calculateStatusBadges} from '@/lib/utils/status-utils';
    import {apiClient} from '@/lib/services/api-client';
    import {voteDataService} from '@/lib/services/vote-data-service';
    import {type FormattedReasonEntry, formatViolationReasons} from '@/lib/utils/violation-formatter';
    import {
        detectPageContext,
        extractGroupInfo,
        extractUserInfo,
        type GroupInfo,
        type UserInfo
    } from '@/lib/utils/page-detection';
    import {
        applyTooltipPosition,
        calculateTooltipPosition,
        calculateTransformOrigin
    } from '@/lib/utils/tooltip-positioning';
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
        onQueue?: () => void;
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

    const shouldShowVoting = $derived(() =>
        !isGroup() && status && (status.flagType === STATUS.FLAGS.UNSAFE || status.flagType === STATUS.FLAGS.PENDING || status.flagType === STATUS.FLAGS.INTEGRATION)
    );

    const isSafeUserWithQueueOnly = $derived(() =>
        !isGroup() && status && status.flagType === STATUS.FLAGS.SAFE
    );

    const isExpanded = $derived(() => mode === 'expanded');

    // Get header message from flag and confidence
    function getHeaderMessageFromFlag(flag: number, confidence = 0): string {
        // Handle mixed status for groups
        if (isGroup() && flag === STATUS.FLAGS.MIXED) {
            return "This group contains a mix of appropriate and inappropriate members.";
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
                return `This ${entityType} was flagged after being added to the queue but has not yet been officially confirmed by our system.`;
            case STATUS.FLAGS.INTEGRATION:
                return `This ${entityType} has been flagged by a third-party content analysis system.`;
            case STATUS.FLAGS.SAFE:
                return `This ${entityType} has not been reviewed yet.`;
            default:
                return "Status information unavailable.";
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
                return getHeaderMessageFromFlag(status.flagType, confidence);
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
            case STATUS.FLAGS.QUEUED:
                return 'pending';
            case STATUS.FLAGS.INTEGRATION:
                return 'integration';
            case STATUS.FLAGS.MIXED:
                return 'unsafe';
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
                return 'Queued';
            case STATUS.FLAGS.INTEGRATION:
                return 'Integration';
            case STATUS.FLAGS.MIXED:
                return 'Mixed';
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

    // Check if a reason comes from an integration source
    function isIntegrationReason(reason: FormattedReasonEntry): boolean {
        if (!status?.integrationSources) return false;

        return Object.values(INTEGRATION_SOURCE_NAMES).some(integrationName =>
            reason.typeName.includes(integrationName)
        );
    }

    // Extract user info from the page DOM
    function getPageUserInfo(): UserInfo | null {
        if (!anchorElement) return null;

        const userId = sanitizedUserId();
        if (!userId) return null;

        const {pageType, container} = detectPageContext(anchorElement);
        return extractUserInfo(userId, pageType, container);
    }

    // Extract group info from the page DOM
    function getPageGroupInfo(): GroupInfo | null {
        if (!anchorElement) return null;

        const groupId = sanitizedUserId();
        if (!groupId) return null;

        const {pageType, container} = detectPageContext(anchorElement);
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
        return anchorElement ? calculateTransformOrigin(anchorElement) : {originX: 50, originY: 50};
    }

    // Load vote data if needed
    async function loadVoteData() {
        if (!shouldShowVoting() || loadingVotes || isSafeUserWithQueueOnly()) return;

        loadingVotes = true;
        voteError = null;

        try {
            const votes = await voteDataService.getVoteData(sanitizedUserId());
            voteData = votes;
            logger.debug('Loaded vote data for user', {userId: sanitizedUserId(), votes});
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
        if (tooltipRef && event.target instanceof Node &&
            !tooltipRef.contains(event.target) &&
            !anchorElement.contains(event.target) &&
            onClose) {
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

        const {originX, originY} = getTransformOrigin();
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
            loadVoteData().catch(error => {
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
                const {originX, originY} = getTransformOrigin();
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
        <span class="reviewer-icon"></span>
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

{#snippet tooltipContent()}
  {#if error}
    <!-- Error state -->
    <div class="error-details">
      {extractErrorMessage(error)}
    </div>
  {:else if !status}
    <!-- Loading state -->
    <div class="flex items-center gap-2 justify-center py-2">
      <LoadingSpinner size="small"/>
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
              onclick={(e) => { e.stopPropagation(); handleQueueSubmit(); }}
              type="button"
          >
            Queue for Review
          </button>
        </div>
      {:else}
        <!-- Non-safe users: Show full content -->
        <!-- Status badges -->
        {#if (!isGroup() && (badgeStatus().isReportable || badgeStatus().isOutfitOnly)) || status.isQueued || shouldShowIntegrationBadge()}
          <div class="flex gap-1.5 mb-2 justify-center flex-wrap">
            {#if !isGroup() && badgeStatus().isReportable}
              <span class="tooltip-badge tooltip-badge-reportable">
                Reportable
              </span>
            {/if}
            {#if status.isQueued}
              <span class="tooltip-badge tooltip-badge-queued">
                Queued
              </span>
            {/if}
            {#if shouldShowIntegrationBadge()}
              <span class="tooltip-badge tooltip-badge-integration">
                {integrationCount() === 1 ? 'Integration' : `Integration (${integrationCount()})`}
              </span>
            {/if}
            {#if !isGroup() && badgeStatus().isOutfitOnly}
              <span class="tooltip-badge tooltip-badge-outfit">
                Outfit Only
              </span>
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
            <div class="reportable-icon"></div>
            <div class="reportable-text">
              <strong>Reportable to Roblox</strong>
              <p>This user has clear evidence of inappropriate content that is visible to Roblox
                moderators.</p>
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
            <div class="outfit-icon"></div>
            <div class="outfit-text">
              <strong>Flagged for Outfit Only</strong>
              <p>This user was flagged solely based on their avatar outfit. Outfit detection can have
                false positives, so please use your own judgment when evaluating this user.</p>
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
                              <div class="outfit-confidence-badge">{evidence.outfitConfidence}
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
    <div
        bind:this={tooltipRef}
        class="expanded-tooltip"
    >
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
            <EngineVersionIndicator position="inline" {status}/>
          {/if}

          <!-- Profile Header -->
          {#if isGroup() && groupInfo}
            <!-- Group Header -->
            <div class="tooltip-profile-header">
              <div class="tooltip-avatar">
                <img
                    alt=""
                    src={groupInfo.groupImageUrl}
                />
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
                <img
                    alt=""
                    src={userInfo.avatarUrl}
                />
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