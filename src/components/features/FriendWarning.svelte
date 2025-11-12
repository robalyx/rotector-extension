<script lang="ts">
	import { t } from '@/lib/stores/i18n';
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

	const warningConfig = $derived(() => {
		const rotector = userStatus?.customApis.get(ROTECTOR_API_ID);
		const rawConfidence = rotector?.data?.confidence ?? 0;
		const confidence = Math.round(rawConfidence * 100);

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
	blockText={t('friend_warning_block_button')}
	cancelText={t('friend_warning_cancel_button')}
	confirmText={t('friend_warning_proceed_button')}
	confirmVariant="danger"
	icon="warning"
	modalType="friend-warning"
	onBlock={handleBlock}
	onCancel={handleCancel}
	onConfirm={handleProceed}
	showBlock={true}
	title={t('friend_warning_title')}
	bind:isOpen
>
	<div>
		<!-- User information -->
		<div class="friend-warning-user-info">
			<div class="friend-warning-user-info-avatar">
				{#if userInfo?.avatarUrl}
					<img alt={t('friend_warning_avatar_alt', [userInfo.username])} src={userInfo.avatarUrl} />
				{/if}
			</div>
			<div class="friend-warning-user-info-details">
				<div class="friend-warning-user-info-name">
					{userInfo?.username || displayName()}
				</div>
				<div class="friend-warning-user-info-id">
					{t('friend_warning_user_id_label', [sanitizedUserId()])}
				</div>
			</div>
		</div>

		<!-- Risk assessment -->
		<div class="friend-warning-risk-assessment">
			<div class="friend-warning-risk-title">
				{t('friend_warning_risk_title')}
			</div>
			<div class="friend-warning-risk-message">
				{t('friend_warning_risk_message')}
			</div>
			{#if warningConfig().confidence > 0}
				<div class="friend-warning-risk-confidence">
					{t('friend_warning_confidence_label', [String(warningConfig().confidence)])}
				</div>
			{/if}
		</div>

		<!-- Why this matters section -->
		<div class="friend-warning-why-matters">
			<h3 class="friend-warning-why-matters-heading">
				<AlertTriangle class="friend-warning-why-matters-icon" size={20} />
				{t('friend_warning_why_matters_heading')}
			</h3>
			<ul class="friend-warning-why-matters-list">
				<li class="friend-warning-why-matters-item">
					{t('friend_warning_why_matters_item1')}
				</li>
				<li class="friend-warning-why-matters-item">
					{t('friend_warning_why_matters_item2')}
				</li>
				<li class="friend-warning-why-matters-item">
					{t('friend_warning_why_matters_item3')}
				</li>
				<li class="friend-warning-why-matters-item">
					{t('friend_warning_why_matters_item4')}
				</li>
			</ul>
		</div>

		<!-- Recommended actions section -->
		<div class="friend-warning-recommendations">
			<h3 class="friend-warning-recommendations-heading">
				<Lightbulb class="friend-warning-recommendations-icon" size={20} />
				{t('friend_warning_recommendations_heading')}
			</h3>
			<ul class="friend-warning-recommendations-list">
				<li class="friend-warning-recommendations-item">
					{t('friend_warning_recommendations_item1')}
				</li>
				<li class="friend-warning-recommendations-item">
					{t('friend_warning_recommendations_item2')}
				</li>
				<li class="friend-warning-recommendations-item">
					{t('friend_warning_recommendations_item3')}
				</li>
			</ul>
		</div>

		<!-- Warning message -->
		<div class="friend-warning-high-risk-warning">
			<div class="friend-warning-high-risk-text">
				{t('friend_warning_high_risk_message')}
			</div>
		</div>
	</div>
</Modal>
