<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Check, CircleX, Copy, ExternalLink, RotateCcw, TriangleAlert } from '@lucide/svelte';
	import type { RobloxAuthChallenge } from '@/lib/types/api';
	import { asApiError, getErrorDetailCode } from '@/lib/utils/api/api-error';
	import { confirmChallenge, requestChallenge } from '@/lib/stores/roblox-auth';
	import { showError, showSuccess } from '@/lib/stores/toast';
	import { logger } from '@/lib/utils/logging/logger';
	import LoadingSpinner from '../../../ui/LoadingSpinner.svelte';
	import Modal from '../../../ui/Modal.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	let { isOpen = $bindable(), onClose }: Props = $props();

	type VerifyStep = 'enter-id' | 'show-phrase' | 'fatal';

	let step = $state<VerifyStep>('enter-id');
	let userIdInput = $state('');
	let challenge = $state<RobloxAuthChallenge | null>(null);
	let challengeLoading = $state(false);
	let verifyLoading = $state(false);
	let inlineError = $state<{ kind: 'warning' | 'muted'; message: string } | null>(null);
	let fatalMessage = $state<string | null>(null);
	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | null = null;
	let secondsRemaining = $state(0);
	let countdownTimer: ReturnType<typeof setInterval> | null = null;

	const expiryClock = $derived.by(() => {
		const total = Math.max(0, secondsRemaining);
		const m = Math.floor(total / 60);
		const s = total % 60;
		return `${String(m)}:${String(s).padStart(2, '0')}`;
	});

	function resetState() {
		step = 'enter-id';
		userIdInput = '';
		challenge = null;
		challengeLoading = false;
		verifyLoading = false;
		inlineError = null;
		fatalMessage = null;
		copied = false;
		if (copyTimer) {
			clearTimeout(copyTimer);
			copyTimer = null;
		}
		if (countdownTimer) {
			clearInterval(countdownTimer);
			countdownTimer = null;
		}
		secondsRemaining = 0;
	}

	function startCountdown(expiresAt: number) {
		if (countdownTimer) clearInterval(countdownTimer);
		const tick = () => {
			secondsRemaining = Math.max(0, Math.ceil(expiresAt - Date.now() / 1000));
			if (secondsRemaining === 0 && countdownTimer) {
				clearInterval(countdownTimer);
				countdownTimer = null;
			}
		};
		tick();
		countdownTimer = setInterval(tick, 1000);
	}

	$effect(() => () => {
		if (copyTimer) clearTimeout(copyTimer);
		if (countdownTimer) clearInterval(countdownTimer);
	});

	$effect(() => {
		if (!isOpen) resetState();
	});

	async function handleRequestChallenge() {
		const trimmed = userIdInput.trim();
		if (!/^[1-9]\d*$/.test(trimmed)) {
			showError($_('roblox_auth_invalid_user_id'));
			return;
		}
		const parsed = Number(trimmed);
		challengeLoading = true;
		inlineError = null;
		fatalMessage = null;
		try {
			const result = await requestChallenge(parsed);
			// Modal may have closed while the request was in flight; discard the
			// stale response so the next open doesn't reveal a phrase the user
			// dismissed.
			if (!isOpen) return;
			challenge = result;
			startCountdown(result.expires_at);
			step = 'show-phrase';
		} catch (error) {
			logger.error('Roblox auth challenge failed:', error);
			if (isOpen) {
				showError(asApiError(error).message || $_('roblox_auth_challenge_failed'));
			}
		} finally {
			challengeLoading = false;
		}
	}

	async function handleCopyPhrase() {
		if (!challenge) return;
		try {
			await navigator.clipboard.writeText(challenge.phrase);
			copied = true;
			if (copyTimer) clearTimeout(copyTimer);
			copyTimer = setTimeout(() => {
				copied = false;
			}, 1500);
		} catch (error) {
			logger.error('Copy phrase failed:', error);
		}
	}

	async function handleVerify() {
		if (!challenge) return;
		verifyLoading = true;
		try {
			await confirmChallenge(challenge.challenge_id);
			showSuccess($_('roblox_auth_verify_success'));
			isOpen = false;
			onClose();
		} catch (error) {
			logger.error('Roblox auth verify failed:', error);
			applyVerifyError(error);
		} finally {
			verifyLoading = false;
		}
	}

	function applyVerifyError(error: unknown) {
		const err = asApiError(error);
		const detailCode = getErrorDetailCode(err);

		if (detailCode === 'VERIFICATION_PHRASE_NOT_FOUND') {
			inlineError = { kind: 'warning', message: $_('roblox_auth_phrase_not_found') };
			return;
		}
		if (detailCode === 'CHALLENGE_INVALID') {
			inlineError = { kind: 'warning', message: $_('roblox_auth_challenge_invalid') };
			challenge = null;
			step = 'enter-id';
			return;
		}
		if (detailCode === 'ROBLOX_USER_BANNED') {
			fatalMessage = $_('roblox_auth_user_banned');
			step = 'fatal';
			return;
		}
		if (detailCode === 'ROBLOX_API_UNAVAILABLE') {
			inlineError = { kind: 'muted', message: $_('roblox_auth_roblox_unavailable') };
			return;
		}
		fatalMessage = err.message || $_('roblox_auth_verify_failed');
		step = 'fatal';
	}

	function openRobloxProfile() {
		void browser.tabs.create({ url: 'https://www.roblox.com/users/profile' });
	}

	function handleBack() {
		step = 'enter-id';
		challenge = null;
		inlineError = null;
		fatalMessage = null;
	}
</script>

<Modal
	{...step === 'fatal' ? { status: 'error' as const } : {}}
	onClose={() => {
		resetState();
		onClose();
	}}
	size="small"
	title={$_('roblox_auth_modal_title')}
	bind:isOpen
>
	{#if step === 'enter-id'}
		<div class="membership-verify-stack">
			<span class="membership-verify-step-eyebrow">{$_('roblox_auth_step1_eyebrow')}</span>
			<p class="modal-paragraph">{$_('roblox_auth_step1_body')}</p>
			<div class="membership-modal-field">
				<label class="membership-modal-label" for="roblox-auth-user-id">
					{$_('roblox_auth_user_id_label')}
				</label>
				<input
					id="roblox-auth-user-id"
					class="membership-modal-input"
					autocomplete="off"
					inputmode="numeric"
					placeholder={$_('roblox_auth_user_id_placeholder')}
					spellcheck="false"
					type="text"
					bind:value={userIdInput}
				/>
			</div>
			<button class="membership-inline-link" onclick={openRobloxProfile} type="button">
				{$_('roblox_auth_open_profile_link')}
			</button>
		</div>
	{:else if step === 'show-phrase' && challenge}
		<div class="membership-verify-stack">
			<span class="membership-verify-step-eyebrow">{$_('roblox_auth_step2_eyebrow')}</span>
			<p class="modal-paragraph">{$_('roblox_auth_step2_intro')}</p>

			<span class="membership-verify-step-eyebrow">{$_('roblox_auth_phrase_label')}</span>
			<div class="membership-verify-phrase">
				<span class="membership-verify-phrase-words">{challenge.phrase}</span>
				<button
					class="membership-verify-copy-button"
					class:copied
					onclick={handleCopyPhrase}
					type="button"
				>
					{#if copied}<Check size={13} />{$_('membership_verify_copied')}{:else}<Copy
							size={13}
						/>{$_('membership_verify_copy_button')}{/if}
				</button>
			</div>

			{#if inlineError}
				<div
					class="membership-inline-banner"
					class:muted={inlineError.kind === 'muted'}
					class:warning={inlineError.kind === 'warning'}
				>
					{#if inlineError.kind === 'warning'}
						<TriangleAlert class="membership-inline-banner-icon" size={14} />
					{:else}
						<RotateCcw class="membership-inline-banner-icon" size={14} />
					{/if}
					<p class="membership-inline-banner-text">{inlineError.message}</p>
				</div>
			{/if}

			<span class="membership-verify-step-eyebrow">{$_('roblox_auth_steps_heading')}</span>
			<ol class="membership-steps-list">
				<li>
					{$_('roblox_auth_steps_open_profile_prefix')}
					<button class="membership-inline-link" onclick={openRobloxProfile} type="button">
						{$_('roblox_auth_steps_open_profile_link')}
					</button>
				</li>
				<li>{$_('roblox_auth_steps_edit')}</li>
				<li>{$_('roblox_auth_steps_paste')}</li>
				<li>{$_('roblox_auth_steps_return')}</li>
			</ol>

			{#if secondsRemaining > 0}
				<span class="roblox-auth-expiry-line">
					{$_('roblox_auth_expires_in', { values: { clock: expiryClock } })}
				</span>
			{:else}
				<span class="roblox-auth-expiry-line warning">
					{$_('roblox_auth_expired')}
				</span>
			{/if}
		</div>
	{:else}
		<div class="membership-verify-stack">
			<div class="membership-inline-banner error">
				<CircleX class="membership-inline-banner-icon" size={14} />
				<p class="membership-inline-banner-text">{fatalMessage ?? ''}</p>
			</div>
			<p class="modal-paragraph">{$_('roblox_auth_fatal_guidance')}</p>
		</div>
	{/if}

	{#snippet actions()}
		{#if step === 'enter-id'}
			<button class="modal-button-cancel" onclick={() => (isOpen = false)} type="button">
				{$_('roblox_auth_cancel')}
			</button>
			<button
				class="modal-button-primary"
				disabled={challengeLoading || !userIdInput.trim()}
				onclick={handleRequestChallenge}
				type="button"
			>
				{#if challengeLoading}<LoadingSpinner size="small" />{:else}{$_(
						'roblox_auth_continue'
					)}{/if}
			</button>
		{:else if step === 'show-phrase'}
			<button class="modal-button-ghost" onclick={handleBack} type="button">
				{$_('roblox_auth_back')}
			</button>
			<button
				class="modal-button-primary"
				disabled={verifyLoading || secondsRemaining === 0}
				onclick={handleVerify}
				type="button"
			>
				{#if verifyLoading}<LoadingSpinner size="small" />{:else}<ExternalLink size={13} />{$_(
						'roblox_auth_verify_submit'
					)}{/if}
			</button>
		{:else}
			<button class="modal-button-cancel" onclick={() => (isOpen = false)} type="button">
				{$_('roblox_auth_close')}
			</button>
			<button class="modal-button-primary" onclick={resetState} type="button">
				{$_('roblox_auth_start_over')}
			</button>
		{/if}
	{/snippet}
</Modal>
