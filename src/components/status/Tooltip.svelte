<script lang="ts">
  import { STATUS, MESSAGES, INTEGRATION_SOURCE_NAMES } from '../../lib/types/constants';
  import type { UserStatus, VoteData, ReviewerInfo } from '../../lib/types/api';
  import { logger } from '../../lib/utils/logger';
  import { extractErrorMessage, sanitizeUserId } from '../../lib/utils/sanitizer';
  import { calculateStatusBadges } from '../../lib/utils/status-utils';
  import { apiClient } from '../../lib/services/api-client';
  import { voteDataService } from '../../lib/services/vote-data-service';
  import { formatViolationReasons, type FormattedReasonEntry } from '../../lib/utils/violation-formatter';
  import { detectPageContext, extractUserInfo, type UserInfo } from '../../lib/utils/page-detection';
  import { calculateTooltipPosition, calculateTransformOrigin, applyTooltipPosition } from '../../lib/utils/tooltip-positioning';
  import LoadingSpinner from '../ui/LoadingSpinner.svelte';
  import VotingWidget from './VotingWidget.svelte';
  import EngineVersionIndicator from './EngineVersionIndicator.svelte';

  interface Props {
    userId: string | number;
    status?: UserStatus | null;
    error?: string | null;
    anchorElement: HTMLElement;
    mode?: 'preview' | 'expanded';
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

  // Computed values
  const sanitizedUserId = $derived(() => {
    const id = sanitizeUserId(userId);
    return id ? id.toString() : '';
  });

  const shouldShowVoting = $derived(() => 
    status && (status.flagType === STATUS.FLAGS.UNSAFE || status.flagType === STATUS.FLAGS.PENDING || status.flagType === STATUS.FLAGS.INTEGRATION)
  );

  const isSafeUserWithQueueOnly = $derived(() => 
    status && status.flagType === STATUS.FLAGS.SAFE
  );

  const isExpanded = $derived(() => mode === 'expanded');

  // Get header message from flag and confidence
  function getHeaderMessageFromFlag(flag: number, confidence = 0): string {
    switch (flag) {
      case STATUS.FLAGS.UNSAFE:
        return MESSAGES.STATUS.UNSAFE;
      case STATUS.FLAGS.PENDING: {
        const confidencePercent = Math.round(confidence * 100);
        return MESSAGES.STATUS.PENDING.replace(
          "confidence level",
          `${confidencePercent}% confidence`
        );
      }
      case STATUS.FLAGS.QUEUED:
        return MESSAGES.STATUS.QUEUED;
      case STATUS.FLAGS.INTEGRATION:
        return MESSAGES.STATUS.INTEGRATION;
      case STATUS.FLAGS.SAFE:
        return MESSAGES.STATUS.SAFE;
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
      default:
        return 'error';
    }
  });

  const statusBadgeText = $derived(() => {
    if (!status) return 'Unknown';
    
    switch (status.flagType) {
      case STATUS.FLAGS.SAFE:
        return 'Safe';
      case STATUS.FLAGS.UNSAFE:
        return 'Unsafe';
      case STATUS.FLAGS.PENDING:
        return 'Under Review';
      case STATUS.FLAGS.QUEUED:
        return 'Queued';
      case STATUS.FLAGS.INTEGRATION:
        return 'Integration';
      default:
        return 'Unknown';
    }
  });

  const reasonEntries = $derived((): FormattedReasonEntry[] => {
    if (!status?.reasons || status.flagType === STATUS.FLAGS.SAFE) return [];
    return formatViolationReasons(status.reasons, status.integrationSources);
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

    const { pageType, container } = detectPageContext(anchorElement);
    return extractUserInfo(userId, pageType, container);
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

  // Handle avatar image error
  function handleAvatarError(event: Event) {
    const target = event.target as HTMLImageElement;
    const fallbackSvg = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23aaa\' d=\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z\'/%3E%3C/svg%3E';
    target.src = fallbackSvg;
  }

  // Handle clicks outside tooltip
  function handleClickOutside(event: MouseEvent) {
    if (tooltipRef && 
        !tooltipRef.contains(event.target as Node) && 
        !anchorElement.contains(event.target as Node) &&
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
      loadVoteData();
    }
  });

  // Setup and cleanup
  $effect(() => {
    element = tooltipRef;
    userInfo = getPageUserInfo();
    
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
    {@const reviewer = reviewerInfo()!}
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
            onclick={(e) => { e.stopPropagation(); handleQueueSubmit(); }}
          >
            Queue for Review
          </button>
        </div>
      {:else}
        <!-- Non-safe users: Show full content -->
        <!-- Status badges -->
        {#if badgeStatus().isReportable || status.isQueued || badgeStatus().isOutfitOnly || shouldShowIntegrationBadge()}
          <div class="flex gap-1.5 mb-2 justify-center flex-wrap">
            {#if badgeStatus().isReportable}
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
            {#if badgeStatus().isOutfitOnly}
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

        <!-- Reportable notice -->
        {#if badgeStatus().isReportable}
          <div class="tooltip-divider"></div>
          <div class="reportable-notice">
            <div class="reportable-icon"></div>
            <div class="reportable-text">
              <strong>Reportable to Roblox</strong>
              <p>This user has clear evidence of inappropriate content that is visible to Roblox moderators.</p>
              <a 
                class="report-button"
                href="https://www.roblox.com/report-abuse/?targetId={sanitizedUserId()}&submitterId=0&abuseVector=userprofile&nl=true" 
                onclick={(e) => e.stopPropagation()}
                target="_blank"
              >
                Report to Roblox
              </a>
            </div>
          </div>
        {/if}

        <!-- Outfit notice -->
        {#if badgeStatus().isOutfitOnly}
          <div class="tooltip-divider"></div>
          <div class="outfit-notice">
            <div class="outfit-icon"></div>
            <div class="outfit-text">
              <strong>Flagged for Outfit Only</strong>
              <p>This user was flagged solely based on their avatar outfit. Outfit detection can have false positives, so please use your own judgment when evaluating this user.</p>
            </div>
          </div>
        {/if}

        <!-- Reasons -->
        {#if reasonEntries().length > 0}
          <div class="tooltip-divider"></div>
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
                              <div class="outfit-confidence-badge">{evidence.outfitConfidence}%</div>
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
          {#if userInfo}
            <div class="tooltip-profile-header">
              <div class="tooltip-avatar">
                <img 
                  alt="" 
                  onerror={handleAvatarError}
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
                User ID: {sanitizedUserId()}
              </div>
            </div>
          {/if}

          <!-- Header message -->
          {#if userInfo && status}
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