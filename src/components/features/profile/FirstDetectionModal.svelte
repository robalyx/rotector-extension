<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Ban, Check, ChevronRight, X } from '@lucide/svelte';
	import AckCheckbox from '@/components/ui/AckCheckbox.svelte';
	import Modal from '../../ui/Modal.svelte';
	import StatusIcon from '@/components/icons/StatusIcon.svelte';
	import { firstDetectionContext, markFirstDetectionSeen } from '@/lib/stores/first-detection';
	import { getCurrentAvatarInfo } from '@/lib/services/roblox/api';
	import { getFlagDisplay } from '@/lib/utils/status/status-config';
	import { logger } from '@/lib/utils/logging/logger';

	let isOpen = $state(true);
	let ackChecked = $state(false);
	let userInfo = $state<{ username: string; thumbnailUrl: string | null } | null>(null);
	let lookupFailed = $state(false);

	const ctx = $derived($firstDetectionContext);
	const flagDisplay = $derived(ctx ? getFlagDisplay(ctx.flagType) : null);

	const fallbackName = $derived(ctx ? `User ${ctx.userId}` : '');
	const displayName = $derived(userInfo?.username ?? fallbackName);

	const roleRows = [
		{ labelKey: 'first_detection_role_yes_1', kind: 'yes' },
		{ labelKey: 'first_detection_role_yes_2', kind: 'yes' },
		{ labelKey: 'first_detection_role_no_1', kind: 'no' },
		{ labelKey: 'first_detection_role_no_2', kind: 'no' }
	] as const;

	const doRowsKey = [
		'first_detection_worried_1',
		'first_detection_worried_2',
		'first_detection_worried_3'
	] as const;

	const dontRowsKey = [
		'first_detection_norms_1',
		'first_detection_norms_2',
		'first_detection_norms_3'
	] as const;

	const mythRows = [
		{ titleKey: 'first_detection_myth_q1', messageKey: 'first_detection_myth_a1' },
		{ titleKey: 'first_detection_myth_q2', messageKey: 'first_detection_myth_a2' },
		{ titleKey: 'first_detection_myth_q3', messageKey: 'first_detection_myth_a3' },
		{ titleKey: 'first_detection_myth_q4', messageKey: 'first_detection_myth_a4' }
	] as const;

	// Lazy-fetch the triggering user's avatar and username
	$effect(() => {
		const userId = ctx?.userId;
		if (!userId) return;

		let cancelled = false;
		userInfo = null;
		lookupFailed = false;

		getCurrentAvatarInfo(userId)
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
				{#each roleRows as row (row.labelKey)}
					<li class="first-detection-row">
						<span
							class:first-detection-row-icon-no={row.kind === 'no'}
							class:first-detection-row-icon-yes={row.kind === 'yes'}
							aria-hidden="true"
						>
							{#if row.kind === 'yes'}
								<Check size={16} strokeWidth={2.5} />
							{:else}
								<X size={16} strokeWidth={2.5} />
							{/if}
						</span>
						<span>{$_(row.labelKey)}</span>
					</li>
				{/each}
			</ul>
		</div>

		<div class="modal-section">
			<div class="first-detection-do-dont">
				<div class="first-detection-do-dont-col">
					<span class="first-detection-do-dont-label-do">
						{$_('first_detection_label_do')}
					</span>
					<ul class="first-detection-row-list">
						{#each doRowsKey as key (key)}
							<li class="first-detection-row">
								<span class="first-detection-row-icon-action" aria-hidden="true">
									<ChevronRight size={16} strokeWidth={2.5} />
								</span>
								<span>{$_(key)}</span>
							</li>
						{/each}
					</ul>
				</div>
				<div class="first-detection-do-dont-col">
					<span class="first-detection-do-dont-label-dont">
						{$_('first_detection_label_dont')}
					</span>
					<ul class="first-detection-row-list">
						{#each dontRowsKey as key (key)}
							<li class="first-detection-row">
								<span class="first-detection-row-icon-deny" aria-hidden="true">
									<Ban size={16} strokeWidth={2.5} />
								</span>
								<span>{$_(key)}</span>
							</li>
						{/each}
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
				{#each mythRows as row (row.titleKey)}
					<li class="first-detection-myth">
						<span class="first-detection-myth-q">{$_(row.titleKey)}</span>
						<span class="first-detection-myth-a">{$_(row.messageKey)}</span>
					</li>
				{/each}
			</ul>
		</div>

		<div class="modal-section">
			<AckCheckbox bind:checked={ackChecked}>
				{#snippet label()}
					{$_('first_detection_ack_label')}
				{/snippet}
			</AckCheckbox>
		</div>
	</Modal>
{/if}
