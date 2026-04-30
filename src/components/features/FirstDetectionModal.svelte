<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Ban, Check, ChevronRight, X } from '@lucide/svelte';
	import Modal from '../ui/Modal.svelte';
	import StatusIcon from '@/lib/components/icons/StatusIcon.svelte';
	import { firstDetectionContext, markFirstDetectionSeen } from '@/lib/stores/first-detection';
	import { robloxApiService } from '@/lib/services/roblox-api-service';
	import { getFlagDisplay } from '@/lib/utils/status-config';
	import type { StatusFlag } from '@/lib/types/constants';
	import { logger } from '@/lib/utils/logger';

	let isOpen = $state(true);
	let ackChecked = $state(false);
	let userInfo = $state<{ username: string; thumbnailUrl: string | null } | null>(null);
	let lookupFailed = $state(false);

	const ctx = $derived($firstDetectionContext);
	const flagDisplay = $derived(ctx ? getFlagDisplay(ctx.flagType as StatusFlag) : null);

	const fallbackName = $derived(ctx ? `User ${ctx.userId}` : '');
	const displayName = $derived(userInfo?.username ?? fallbackName);

	// Lazy-fetch the triggering user's avatar and username
	$effect(() => {
		const userId = ctx?.userId;
		if (!userId) return;

		let cancelled = false;
		userInfo = null;
		lookupFailed = false;

		robloxApiService
			.getCurrentAvatarInfo(userId)
			.then((info) => {
				if (cancelled) return;
				if (info) userInfo = info;
				else lookupFailed = true;
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				logger.warn('First-detection user lookup failed:', error);
				lookupFailed = true;
			});

		return () => {
			cancelled = true;
		};
	});

	// Persist the seen flag and let the parent unmount the modal
	async function handleConfirm() {
		try {
			await markFirstDetectionSeen();
		} catch (error) {
			logger.error('Failed to persist first-detection seen flag:', error);
		}
	}
</script>

{#if ctx && flagDisplay}
	<Modal
		confirmDisabled={!ackChecked}
		confirmText={$_('first_detection_confirm')}
		onConfirm={handleConfirm}
		showCancel={false}
		showClose={false}
		status="warning"
		title={$_('first_detection_title')}
		bind:isOpen
	>
		<div class="modal-user-card">
			<div class="modal-user-card-avatar">
				{#if userInfo?.thumbnailUrl}
					<img alt="" src={userInfo.thumbnailUrl} />
				{/if}
			</div>
			<div class="modal-user-card-meta">
				<div class="modal-user-card-name">{displayName}</div>
				{#if userInfo?.username}
					<div class="modal-user-card-handle">@{userInfo.username}</div>
				{:else if lookupFailed}
					<div class="modal-user-card-handle">ID {ctx.userId}</div>
				{/if}
			</div>
			<span style:color={flagDisplay.iconColor} class="modal-user-card-chip">
				<StatusIcon name={flagDisplay.iconName} color={flagDisplay.iconColor} size={14} />
				{flagDisplay.textContent}
			</span>
		</div>

		<div class="first-detection-hero mt-3">
			<p class="first-detection-hero-text">{$_('first_detection_hero')}</p>
		</div>

		<p class="modal-paragraph mt-3">{$_('first_detection_intro_p1')}</p>
		<p class="modal-paragraph">{$_('first_detection_intro_p2')}</p>

		<div class="modal-section">
			<header class="modal-section-head">
				<h3 class="modal-section-title">
					{$_('first_detection_section_role_title')}
				</h3>
			</header>
			<ul class="first-detection-row-list">
				<li class="first-detection-row">
					<span class="first-detection-row-icon-yes" aria-hidden="true">
						<Check size={16} strokeWidth={2.5} />
					</span>
					<span>{$_('first_detection_role_yes_1')}</span>
				</li>
				<li class="first-detection-row">
					<span class="first-detection-row-icon-yes" aria-hidden="true">
						<Check size={16} strokeWidth={2.5} />
					</span>
					<span>{$_('first_detection_role_yes_2')}</span>
				</li>
				<li class="first-detection-row">
					<span class="first-detection-row-icon-no" aria-hidden="true">
						<X size={16} strokeWidth={2.5} />
					</span>
					<span>{$_('first_detection_role_no_1')}</span>
				</li>
				<li class="first-detection-row">
					<span class="first-detection-row-icon-no" aria-hidden="true">
						<X size={16} strokeWidth={2.5} />
					</span>
					<span>{$_('first_detection_role_no_2')}</span>
				</li>
			</ul>
		</div>

		<div class="modal-section">
			<div class="first-detection-do-dont">
				<div class="first-detection-do-dont-col">
					<span class="first-detection-do-dont-label-do">
						{$_('first_detection_label_do')}
					</span>
					<ul class="first-detection-row-list">
						<li class="first-detection-row">
							<span class="first-detection-row-icon-action" aria-hidden="true">
								<ChevronRight size={16} strokeWidth={2.5} />
							</span>
							<span>{$_('first_detection_worried_1')}</span>
						</li>
						<li class="first-detection-row">
							<span class="first-detection-row-icon-action" aria-hidden="true">
								<ChevronRight size={16} strokeWidth={2.5} />
							</span>
							<span>{$_('first_detection_worried_2')}</span>
						</li>
						<li class="first-detection-row">
							<span class="first-detection-row-icon-action" aria-hidden="true">
								<ChevronRight size={16} strokeWidth={2.5} />
							</span>
							<span>{$_('first_detection_worried_3')}</span>
						</li>
					</ul>
				</div>
				<div class="first-detection-do-dont-col">
					<span class="first-detection-do-dont-label-dont">
						{$_('first_detection_label_dont')}
					</span>
					<ul class="first-detection-row-list">
						<li class="first-detection-row">
							<span class="first-detection-row-icon-deny" aria-hidden="true">
								<Ban size={16} strokeWidth={2.5} />
							</span>
							<span>{$_('first_detection_norms_1')}</span>
						</li>
						<li class="first-detection-row">
							<span class="first-detection-row-icon-deny" aria-hidden="true">
								<Ban size={16} strokeWidth={2.5} />
							</span>
							<span>{$_('first_detection_norms_2')}</span>
						</li>
						<li class="first-detection-row">
							<span class="first-detection-row-icon-deny" aria-hidden="true">
								<Ban size={16} strokeWidth={2.5} />
							</span>
							<span>{$_('first_detection_norms_3')}</span>
						</li>
					</ul>
				</div>
			</div>
		</div>

		<div class="modal-section">
			<header class="modal-section-head">
				<h3 class="modal-section-title">
					{$_('first_detection_section_myths_title')}
				</h3>
			</header>
			<ul class="first-detection-myth-list">
				<li class="first-detection-myth">
					<span class="first-detection-myth-q">{$_('first_detection_myth_q1')}</span>
					<span class="first-detection-myth-a">{$_('first_detection_myth_a1')}</span>
				</li>
				<li class="first-detection-myth">
					<span class="first-detection-myth-q">{$_('first_detection_myth_q2')}</span>
					<span class="first-detection-myth-a">{$_('first_detection_myth_a2')}</span>
				</li>
				<li class="first-detection-myth">
					<span class="first-detection-myth-q">{$_('first_detection_myth_q3')}</span>
					<span class="first-detection-myth-a">{$_('first_detection_myth_a3')}</span>
				</li>
				<li class="first-detection-myth">
					<span class="first-detection-myth-q">{$_('first_detection_myth_q4')}</span>
					<span class="first-detection-myth-a">{$_('first_detection_myth_a4')}</span>
				</li>
			</ul>
		</div>

		<div class="modal-section">
			<label class="queue-ack-item">
				<input class="queue-ack-checkbox" type="checkbox" bind:checked={ackChecked} />
				<span class="queue-ack-checkmark" class:checked={ackChecked}>
					{#if ackChecked}
						<Check aria-hidden="true" size={14} strokeWidth={3} />
					{/if}
				</span>
				<span class="queue-ack-text">{$_('first_detection_ack_label')}</span>
			</label>
		</div>
	</Modal>
{/if}
