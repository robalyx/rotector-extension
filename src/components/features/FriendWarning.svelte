<script lang="ts">
	import { PROFILE_SELECTORS } from '@/lib/types/constants';
	import type { CombinedStatus } from '@/lib/types/custom-api';
	import { ROTECTOR_API_ID } from '@/lib/services/unified-query-service';
	import { logger } from '@/lib/utils/logger';
	import { sanitizeEntityId } from '@/lib/utils/sanitizer';
	import { AlertTriangle, Lightbulb } from 'lucide-svelte';
	import Modal from '../ui/Modal.svelte';

	interface Props {
		isOpen: boolean;
		userId: string | number;
		username?: string | null;
		userStatus?: CombinedStatus | null;
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
		userStatus = null,
		onProceed,
		onCancel,
		onBlock
	}: Props = $props();

	// Local state
	let userInfo: UserInfo | null = $state(null);

	// Computed values
	const sanitizedUserId = $derived(() => {
		const id = sanitizeEntityId(userId);
		return id ? id.toString() : '';
	});

	const displayName = $derived(() => {
		return username || `User ${sanitizedUserId()}`;
	});

	const isRisky = $derived(() => {
		if (!userStatus) return false;
		return Array.from(userStatus.customApis.values()).some(
			(result) => result.data && result.data.flagType > 0
		);
	});

	const warningConfig = $derived(() => {
		const rotector = userStatus?.customApis.get(ROTECTOR_API_ID);
		const confidence = rotector?.data ? Math.round(rotector.data.confidence * 100) : 0;

		return {
			title: 'Potentially Inappropriate User',
			message:
				'This user has been flagged by our detection system. Please review their profile before accepting this friend request.',
			colorClass: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
			iconColor: 'text-yellow-600 dark:text-yellow-400',
			textColor: 'text-yellow-800 dark:text-yellow-200',
			confidence
		};
	});

	// Handle proceed with friend request
	function handleProceed() {
		const rotector = userStatus?.customApis.get(ROTECTOR_API_ID);
		logger.userAction('friend_warning_proceed', {
			userId: sanitizedUserId(),
			isRisky: isRisky(),
			statusFlag: rotector?.data?.flagType
		});

		if (onProceed) {
			onProceed();
		}

		isOpen = false;
	}

	// Handle cancel friend request
	function handleCancel() {
		const rotector = userStatus?.customApis.get(ROTECTOR_API_ID);
		logger.userAction('friend_warning_cancel', {
			userId: sanitizedUserId(),
			isRisky: isRisky(),
			statusFlag: rotector?.data?.flagType
		});

		if (onCancel) {
			onCancel();
		}

		isOpen = false;
	}

	// Handle block user
	function handleBlock() {
		const rotector = userStatus?.customApis.get(ROTECTOR_API_ID);
		logger.userAction('friend_warning_block', {
			userId: sanitizedUserId(),
			isRisky: isRisky(),
			statusFlag: rotector?.data?.flagType
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
				if (avatarImg instanceof HTMLImageElement && avatarImg.src) {
					avatarUrl = avatarImg.src;
				}
			}
		}

		return { userId, username, avatarUrl };
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
	confirmVariant="danger"
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
					<img alt="{userInfo.username}'s avatar" src={userInfo.avatarUrl} />
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
				{warningConfig().title}
			</div>
			<div class="friend-warning-risk-message">
				{warningConfig().message}
			</div>
			{#if warningConfig().confidence > 0}
				<div class="friend-warning-risk-confidence">
					Confidence: {warningConfig().confidence}%
				</div>
			{/if}
		</div>

		<!-- Why this matters section -->
		<div class="friend-warning-why-matters">
			<h3 class="friend-warning-why-matters-heading">
				<AlertTriangle class="friend-warning-why-matters-icon" size={20} />
				Why this matters
			</h3>
			<ul class="friend-warning-why-matters-list">
				<li class="friend-warning-why-matters-item">
					This user may engage in inappropriate conversations or behaviors
				</li>
				<li class="friend-warning-why-matters-item">
					Your account may be associated with inappropriate users in our system
				</li>
				<li class="friend-warning-why-matters-item">
					You could be exposing yourself to unwanted or harmful content
				</li>
				<li class="friend-warning-why-matters-item">
					This user has clear evidence of violating Roblox's Terms of Service
				</li>
			</ul>
		</div>

		<!-- Recommended actions section -->
		<div class="friend-warning-recommendations">
			<h3 class="friend-warning-recommendations-heading">
				<Lightbulb class="friend-warning-recommendations-icon" size={20} />
				Recommended actions
			</h3>
			<ul class="friend-warning-recommendations-list">
				<li class="friend-warning-recommendations-item">
					Review their profile information more carefully
				</li>
				<li class="friend-warning-recommendations-item">
					Report them to Roblox if you see inappropriate content
				</li>
				<li class="friend-warning-recommendations-item">
					Connect only with users you know and trust
				</li>
			</ul>
		</div>

		<!-- Warning message -->
		<div class="friend-warning-high-risk-warning">
			<div class="friend-warning-high-risk-text">
				Proceeding with this friend request may expose you to inappropriate content or harmful
				interactions.
			</div>
		</div>
	</div>
</Modal>
