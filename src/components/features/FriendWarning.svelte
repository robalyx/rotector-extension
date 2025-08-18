<script lang="ts">
    import {PROFILE_SELECTORS, STATUS} from '@/lib/types/constants';
    import type {UserStatus} from '@/lib/types/api';
    import {logger} from '@/lib/utils/logger';
    import {sanitizeUserId} from '@/lib/utils/sanitizer';
    import Modal from '../ui/Modal.svelte';

    interface Props {
        isOpen: boolean;
        userId: string | number;
        username?: string | null;
        status?: UserStatus | null;
        onProceed?: () => void;
        onCancel?: () => void;
        onBlock?: () => void;
    }

    interface UserInfo {
        userId: string;
        username: string;
        avatarUrl?: string;
    }

    let {
        isOpen = $bindable(),
        userId,
        username = null,
        status = null,
        onProceed,
        onCancel,
        onBlock
    }: Props = $props();

    // Local state
    let userInfo: UserInfo | null = $state(null);

    // Computed values
    const sanitizedUserId = $derived(() => {
        const id = sanitizeUserId(userId);
        return id ? id.toString() : '';
    });

    const displayName = $derived(() => {
        return username || `User ${sanitizedUserId()}`;
    });

    const riskLevel = $derived(() => {
        if (!status) return 'unknown';

        switch (status.flagType) {
            case STATUS.FLAGS.UNSAFE:
                return 'high';
            case STATUS.FLAGS.PENDING:
                return 'medium';
            case STATUS.FLAGS.SAFE:
                return 'low';
            default:
                return 'unknown';
        }
    });

    const riskConfig = $derived(() => {
        const confidence = status ? Math.round(status.confidence * 100) : 0;
        const risk = riskLevel();

        switch (risk) {
            case 'high':
                return {
                    icon: '🚨',
                    title: 'High Risk User',
                    message: 'This user has been flagged as unsafe by our detection system.',
                    colorClass: 'border-red-500 bg-red-50 dark:bg-red-900/20',
                    iconColor: 'text-red-600 dark:text-red-400',
                    textColor: 'text-red-800 dark:text-red-200',
                    confidence
                };
            case 'medium':
                return {
                    icon: '⚠️',
                    title: 'Potentially Risky User',
                    message: 'This user is pending review and may have concerning content.',
                    colorClass: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
                    iconColor: 'text-yellow-600 dark:text-yellow-400',
                    textColor: 'text-yellow-800 dark:text-yellow-200',
                    confidence
                };
            case 'low':
                return {
                    icon: '✅',
                    title: 'Low Risk User',
                    message: 'This user appears to be safe based on our analysis.',
                    colorClass: 'border-green-500 bg-green-50 dark:bg-green-900/20',
                    iconColor: 'text-green-600 dark:text-green-400',
                    textColor: 'text-green-800 dark:text-green-200',
                    confidence
                };
            default:
                return {
                    icon: '❓',
                    title: 'Unknown User',
                    message: 'Unable to determine the safety status of this user.',
                    colorClass: 'border-gray-500 bg-gray-50 dark:bg-gray-800',
                    iconColor: 'text-gray-600 dark:text-gray-400',
                    textColor: 'text-gray-800 dark:text-gray-200',
                    confidence: 0
                };
        }
    });

    // Handle proceed with friend request
    function handleProceed() {
        logger.userAction('friend_warning_proceed', {
            userId: sanitizedUserId(),
            riskLevel: riskLevel(),
            statusFlag: status?.flagType
        });

        if (onProceed) {
            onProceed();
        }

        isOpen = false;
    }

    // Handle cancel friend request
    function handleCancel() {
        logger.userAction('friend_warning_cancel', {
            userId: sanitizedUserId(),
            riskLevel: riskLevel(),
            statusFlag: status?.flagType
        });

        if (onCancel) {
            onCancel();
        }

        isOpen = false;
    }

    // Handle block user
    function handleBlock() {
        logger.userAction('friend_warning_block', {
            userId: sanitizedUserId(),
            riskLevel: riskLevel(),
            statusFlag: status?.flagType
        });

        if (onBlock) {
            onBlock();
        }

        isOpen = false;
    }

    // Extract user info from the page DOM
    function extractUserInfo(): UserInfo | null {
        const userId = sanitizedUserId();
        if (!userId) return null;

        let username = 'Unknown User';
        let avatarUrl: string | undefined;

        // Check if we're on a profile page
        const isProfilePage = window.location.pathname.includes('/users/');

        if (isProfilePage) {
            const profileHeader = document.querySelector(`${PROFILE_SELECTORS.PROFILE_HEADER_MAIN}`);
            if (profileHeader) {
                // Get username from profile username element
                const usernameElement = profileHeader.querySelector(`${PROFILE_SELECTORS.USERNAME}`);
                if (usernameElement) {
                    let text = usernameElement.textContent?.trim() || '';
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

        return {userId, username, avatarUrl};
    }

    // Update user info when component mounts
    $effect(() => {
        if (isOpen) {
            userInfo = extractUserInfo();
        }
    });
</script>

<Modal
    actionsLayout="horizontal"
    blockText="Block User"
    cancelText="Cancel Request"
    confirmText="Proceed Anyway"
    confirmVariant={riskLevel() === 'high' ? 'danger' : 'primary'}
    icon="warning"
    modalType="friend-warning"
    onBlock={handleBlock}
    onCancel={handleCancel}
    onConfirm={handleProceed}
    showBlock={true}
    title="Warning: Unsafe User"
    bind:isOpen
>
  <div>
    <!-- User information -->
    <div class="friend-warning-user-info">
      <div class="friend-warning-user-info-avatar">
        {#if userInfo?.avatarUrl}
          <img
              alt="{userInfo.username}'s avatar"
              src={userInfo.avatarUrl}
          />
        {/if}
      </div>
      <div class="friend-warning-user-info-details">
        <div class="friend-warning-user-info-name">
          {userInfo?.username || displayName()}
        </div>
        <div class="friend-warning-user-info-id">
          User ID: {sanitizedUserId()}
        </div>
      </div>
    </div>

    <!-- Risk assessment -->
    <div class="friend-warning-risk-assessment">
      <div class="friend-warning-risk-title">
        {riskConfig().title}
      </div>
      <div class="friend-warning-risk-message">
        {riskConfig().message}
      </div>
      {#if riskConfig().confidence > 0}
        <div class="friend-warning-risk-confidence">
          Confidence: {riskConfig().confidence}%
        </div>
      {/if}
    </div>

    <!-- Why this matters section -->
    <div class="friend-warning-why-matters">
      <h3 class="friend-warning-why-matters-heading">
        <span class="friend-warning-why-matters-icon"></span>
        Why this matters
      </h3>
      <ul class="friend-warning-why-matters-list">
        <li class="friend-warning-why-matters-item">This user may engage in inappropriate conversations or
          behaviors
        </li>
        <li class="friend-warning-why-matters-item">Your account may be associated with inappropriate users in
          our system
        </li>
        <li class="friend-warning-why-matters-item">You could be exposing yourself to unwanted or harmful
          content
        </li>
        <li class="friend-warning-why-matters-item">This user has clear evidence of violating Roblox's Terms of
          Service
        </li>
      </ul>
    </div>

    <!-- Recommended actions section -->
    <div class="friend-warning-recommendations">
      <h3 class="friend-warning-recommendations-heading">
        <span class="friend-warning-recommendations-icon"></span>
        Recommended actions
      </h3>
      <ul class="friend-warning-recommendations-list">
        <li class="friend-warning-recommendations-item">Review their profile information more carefully</li>
        <li class="friend-warning-recommendations-item">Report them to Roblox if you see inappropriate content
        </li>
        <li class="friend-warning-recommendations-item">Connect only with users you know and trust</li>
      </ul>
    </div>

    <!-- Warning message for high-risk users -->
    {#if riskLevel() === 'high'}
      <div class="friend-warning-high-risk-warning">
        <div class="friend-warning-high-risk-text">
          Proceeding with this friend request may expose you to inappropriate content or harmful interactions.
        </div>
      </div>
    {/if}
  </div>
</Modal> 