<script lang="ts">
  import { STATUS, MESSAGES, PROFILE_SELECTORS, FRIENDS_SELECTORS, GROUPS_SELECTORS } from '../../lib/types/constants';
  import type { UserStatus, VoteData, ReviewerInfo } from '../../lib/types/api';
  import { logger } from '../../lib/utils/logger';
  import { extractErrorMessage, sanitizeUserId } from '../../lib/utils/sanitizer';
  import { calculateStatusBadges } from '../../lib/utils/status-utils';
  import { apiClient } from '../../lib/services/api-client';
  import { voteDataService } from '../../lib/services/vote-data-service';
  import { formatViolationReasons, type FormattedReasonEntry } from '../../lib/utils/violation-formatter';
  import LoadingSpinner from '../ui/LoadingSpinner.svelte';
  import VotingWidget from './VotingWidget.svelte';
  import EngineVersionIndicator from './EngineVersionIndicator.svelte';

  interface Props {
    userId: string | number;
    status?: UserStatus | null;
    error?: string | null;
    anchorElement: HTMLElement;
    onQueue?: () => void;
    onClose?: () => void;
    onExpand?: () => void;
    element?: HTMLElement;
    isExpanded?: boolean;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  }

  interface UserInfo {
    userId: string;
    username: string;
    avatarUrl?: string;
  }

  let {
    userId,
    status = null,
    error = null,
    anchorElement,
    onQueue,
    onClose,
    onExpand,
    element = $bindable(),
    isExpanded = false,
    onMouseEnter,
    onMouseLeave
  }: Props = $props();

  // Local state
  let tooltipRef = $state<HTMLElement>();
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
    status && (status.flagType === STATUS.FLAGS.UNSAFE || status.flagType === STATUS.FLAGS.PENDING)
  );

  const isSafeUserWithQueueOnly = $derived(() => 
    status && status.flagType === STATUS.FLAGS.SAFE
  );

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
      case STATUS.FLAGS.SAFE: {
        return getHeaderMessageFromFlag(status.flagType, confidence);
      }
      case STATUS.FLAGS.UNSAFE: {
        return getHeaderMessageFromFlag(status.flagType, confidence);
      }
      case STATUS.FLAGS.PENDING: {
        return getHeaderMessageFromFlag(status.flagType, confidence);
      }
      case STATUS.FLAGS.QUEUED: {
        return getHeaderMessageFromFlag(status.flagType, confidence);
      }
      default:
        return 'Unknown Status';
    }
  });

  const statusBadgeClass = $derived(() => {
    if (!status) return 'error';
    
    let badgeClass: string;
    switch (status.flagType) {
      case STATUS.FLAGS.SAFE:
        badgeClass = 'safe';
        break;
      case STATUS.FLAGS.UNSAFE:
        badgeClass = 'unsafe';
        break;
      case STATUS.FLAGS.PENDING:
        badgeClass = 'pending';
        break;
      case STATUS.FLAGS.QUEUED:
        badgeClass = 'pending';
        break;
      default:
        badgeClass = 'error';
        break;
    }
    return badgeClass;
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
      default:
        return 'Unknown';
    }
  });

  const reasonEntries = $derived((): FormattedReasonEntry[] => {
    if (!status?.reasons || status.flagType === STATUS.FLAGS.SAFE) return [];
    
    return formatViolationReasons(status.reasons);
  });

  // Get reviewer info from status
  const reviewerInfo = $derived((): ReviewerInfo | null => {
    if (!status?.reviewer) return null;
    return status.reviewer;
  });

  // Compute badge status
  const badgeStatus = $derived(() => calculateStatusBadges(status));

  // Extract user info from the page DOM
  function extractUserInfo(): UserInfo | null {
    if (!anchorElement) return null;

    const userId = sanitizedUserId();
    if (!userId) return null;

    let username = 'Unknown User';
    let avatarUrl: string | undefined;

    const isCarouselTile = anchorElement.closest('.friends-carousel-tile');
    const isFriendsPage = anchorElement.closest('.avatar-card');
    const isGroupsPage = anchorElement.closest('.member');
    const isProfilePage = window.location.pathname.includes('/users/');
    
    if (isCarouselTile) {
      const container = anchorElement.closest('.friends-carousel-tile');

      if (container) {
        // Try to find username
        const usernameEl = container.querySelector('[class*="username"], [class*="name"], [class*="display-name"]') ||
                           container.querySelector('a[href*="/users/"] span, .text-overflow');
        if (usernameEl) {
          let text = usernameEl.textContent?.trim() || '';
          // Remove @ symbol if present
          if (text.startsWith('@')) text = text.substring(1);
          if (text) username = text;
        }

        // Try to find avatar
        const avatarEl = container.querySelector('img[src*="rbxcdn"], img[src*="roblox"]') as HTMLImageElement;
        if (avatarEl?.src) {
          avatarUrl = avatarEl.src;
        }
      }
    } else if (isFriendsPage) {
      const container = anchorElement.closest('.avatar-card');

      if (container) {
        // Use friends page specific selectors
        const usernameEl = container.querySelector(FRIENDS_SELECTORS.CARD.USERNAME);
        if (usernameEl) {
          let text = usernameEl.textContent?.trim() || '';
          // Remove @ symbol if present
          if (text.startsWith('@')) text = text.substring(1);
          if (text) username = text;
        }

        // Try to find avatar using friends page selector
        const avatarEl = container.querySelector(FRIENDS_SELECTORS.CARD.AVATAR_IMG) as HTMLImageElement;
        if (avatarEl?.src) {
          avatarUrl = avatarEl.src;
        }
      }
    } else if (isGroupsPage) {
      const container = anchorElement.closest('.member');

      if (container) {
        // Use groups page specific selectors
        const usernameEl = container.querySelector(GROUPS_SELECTORS.USERNAME);
        if (usernameEl) {
          let text = usernameEl.textContent?.trim() || '';
          // Remove @ symbol if present
          if (text.startsWith('@')) text = text.substring(1);
          if (text) username = text;
        }

        // Try to find avatar using groups page selector
        const avatarEl = container.querySelector(GROUPS_SELECTORS.AVATAR_IMG) as HTMLImageElement;
        if (avatarEl?.src) {
          avatarUrl = avatarEl.src;
        }
      }
    } else if (isProfilePage) {
      const profileHeader = document.querySelector(`${PROFILE_SELECTORS.PROFILE_HEADER_MAIN}`);
      if (profileHeader) {
        // Get username from profile username element
        const usernameElement = profileHeader.querySelector(`${PROFILE_SELECTORS.USERNAME}`);
        if (usernameElement) {
          let text = usernameElement.textContent?.trim() || '';
          // Remove @ symbol if present
          if (text.startsWith('@')) text = text.substring(1);
          if (text) username = text;
        }
        
        // Get avatar image
        const avatarImg = profileHeader.querySelector(`${PROFILE_SELECTORS.AVATAR_IMG}`);
        if (avatarImg) {
          avatarUrl = (avatarImg as HTMLImageElement).src;
        }
      }
    }

    return { userId, username, avatarUrl };
  }

  // Position tooltip relative to anchor with arrow
  function positionTooltip() {
    if (!tooltipRef || !anchorElement || isExpanded) return;

    // Get element dimensions and viewport info
    const anchorRect = anchorElement.getBoundingClientRect();
    const tooltipRect = tooltipRef.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate initial position (centered below anchor with arrow spacing)
    const intendedLeft = anchorRect.left + (anchorRect.width / 2) - (tooltipRect.width / 2);
    let left = intendedLeft;
    let top = anchorRect.bottom + 8; // 8px accounts for arrow height
    let isPositionedAbove = false;
    
    // Define edge padding to prevent tooltips from touching viewport edges
    const edgePadding = 16;

    // Ensure tooltip stays within viewport horizontally with edge padding
    if (left < edgePadding) {
      left = edgePadding;
    }
    if (left + tooltipRect.width > viewportWidth - edgePadding) {
      left = viewportWidth - tooltipRect.width - edgePadding;
    }

    // Calculate positioning factors for smart vertical placement
    const anchorVerticalPosition = anchorRect.top / viewportHeight; // 0 = top, 1 = bottom
    const minimumOverflowToTriggerAbove = 20; // Must overflow by at least 20px to consider above
    const maximumViewportPositionForAbove = 0.5; // Only consider above if anchor is in bottom 50%
    
    // Check if tooltip would overflow below viewport
    const overflowBelow = (top + tooltipRect.height) - (viewportHeight - edgePadding);
    const wouldOverflow = overflowBelow > minimumOverflowToTriggerAbove;
    
    // Check if anchor is low enough in viewport to justify positioning above
    const anchorIsInLowerPortion = anchorVerticalPosition > maximumViewportPositionForAbove;
    
    // Only position above if BOTH conditions are met:
    // 1. Anchor is in the bottom 50% of viewport AND
    // 2. Tooltip would overflow by more than 20px below
    if (anchorIsInLowerPortion && wouldOverflow) {
      const positionAbove = anchorRect.top - tooltipRect.height - 8; // 8px for arrow
      
      // Only position above if there's adequate space (prevent cramming at top)
      if (positionAbove >= edgePadding) {
        top = positionAbove;
        isPositionedAbove = true;
      }
      // If not enough space above, keep below and accept partial clipping
    }

    // Calculate horizontal offset for bridge and arrow positioning
    const horizontalOffset = left - intendedLeft;

    // Apply final positioning
    tooltipRef.style.left = `${left}px`;
    tooltipRef.style.top = `${top}px`;
    
    // Set CSS custom properties for bridge offset
    tooltipRef.style.setProperty('--bridge-offset-x', `${-horizontalOffset}px`);
    tooltipRef.style.setProperty('--tooltip-positioned-above', isPositionedAbove ? '1' : '0');
  }

  // Load vote data if needed using centralized service
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
      
      // Update centralized cache with new vote data
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
    if (!isExpanded && onExpand) {
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

  // Load vote data when tooltip becomes visible
  let hasLoadedVoteData = $state(false);
  
  $effect(() => {
    // Only load vote data once when component is mounted and should show voting
    if (shouldShowVoting() && !hasLoadedVoteData && !loadingVotes) {
      hasLoadedVoteData = true;
      loadVoteData();
    }
  });


  // Setup and cleanup
  $effect(() => {
    element = tooltipRef;
    userInfo = extractUserInfo();
    
    // Position tooltip for preview mode
    if (!isExpanded) {
      requestAnimationFrame(() => {
        positionTooltip();
      });
    }

    // Add event listeners for preview tooltips
    if (!isExpanded) {
      document.addEventListener('keydown', handleKeydown);
      document.addEventListener('click', handleClickOutside);
      window.addEventListener('resize', positionTooltip);
    }

    return () => {
      if (!isExpanded) {
        document.removeEventListener('keydown', handleKeydown);
        document.removeEventListener('click', handleClickOutside);
        window.removeEventListener('resize', positionTooltip);
      }
    };
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
        {#if badgeStatus().isReportable || status.isQueued || badgeStatus().isOutfitOnly}
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
                href="https://www.roblox.com/abusereport/UserProfile?id={sanitizedUserId()}&redirectUrl=https%3a%2f%2fwww.roblox.com%2fusers%2f{sanitizedUserId()}%2fprofile" 
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
                <div class="reason-header">
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

{#if isExpanded}
  <!-- Expanded tooltip structure -->
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