<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Check, ExternalLink } from '@lucide/svelte';
	import LegalDeclineConfirm from './LegalDeclineConfirm.svelte';
	import { acceptLegal, declineLegal, shouldShowLegalModal } from '@/lib/stores/legal';
	import { LEGAL_URLS } from '@/lib/types/constants';
	import { getAssetUrl } from '@/lib/utils/assets';
	import { themeManager } from '@/lib/utils/theme';

	let isOpen = $state(true);
	let isClosing = $state(false);
	let accepted = $state(false);
	let showDeclineConfirm = $state(false);
	let overlayElement = $state<HTMLDivElement>();
	let popupElement = $state<HTMLDivElement>();
	const headingId = `legal-modal-title-${Math.random().toString(36).slice(2)}`;

	const lightLogoUrl = getAssetUrl('/assets/rotector-logo-light.webp');
	const darkLogoUrl = getAssetUrl('/assets/rotector-logo-dark.webp');
	let currentTheme = $state<'light' | 'dark'>('light');

	$effect(() => {
		const unsubscribe = themeManager.effectiveTheme.subscribe((theme) => {
			currentTheme = theme;
		});
		return unsubscribe;
	});

	$effect(() => {
		const unsubscribe = shouldShowLegalModal.subscribe((shouldShow) => {
			if (!shouldShow && isOpen && !isClosing) {
				isOpen = false;
			}
		});
		return unsubscribe;
	});

	function animateClose() {
		isClosing = true;
		setTimeout(() => {
			isOpen = false;
			isClosing = false;
		}, 250);
	}

	async function handleAccept() {
		await acceptLegal();
		animateClose();
	}

	function requestDecline() {
		showDeclineConfirm = true;
	}

	function cancelDecline() {
		showDeclineConfirm = false;
	}

	async function confirmDecline() {
		showDeclineConfirm = false;
		await declineLegal();
		animateClose();
	}

	$effect(() => {
		if (isOpen && overlayElement && popupElement) {
			const overlay = overlayElement;
			const popup = popupElement;
			requestAnimationFrame(() => {
				overlay.classList.add('visible');
				popup.focus();
			});
		}
	});
</script>

{#if isOpen}
	<div bind:this={overlayElement} class="modal-overlay" class:closing={isClosing}>
		<div
			bind:this={popupElement}
			class="modal-popup"
			aria-labelledby={headingId}
			aria-modal="true"
			role="dialog"
			tabindex="-1"
		>
			<div class="modal-header">
				<h2 id={headingId} class="modal-title">{$_('legal_modal_title')}</h2>
			</div>

			<div class="modal-divider"></div>

			<div class="modal-content">
				<div class="onboarding-hero-logo">
					{#if currentTheme === 'dark'}
						<img alt="Rotector" src={darkLogoUrl} />
					{:else}
						<img alt="Rotector" src={lightLogoUrl} />
					{/if}
				</div>

				<p class="modal-paragraph">{$_('legal_modal_intro')}</p>

				<h3 class="legal-modal-section-heading">{$_('legal_modal_summary_heading')}</h3>
				<ul class="legal-modal-summary">
					<li>{$_('legal_modal_summary_1')}</li>
					<li>{$_('legal_modal_summary_2')}</li>
					<li>{$_('legal_modal_summary_3')}</li>
				</ul>

				<p class="legal-modal-section-heading">{$_('legal_modal_links_heading')}</p>
				<p class="legal-modal-link-row">
					<a href={LEGAL_URLS.terms} rel="noopener noreferrer" target="_blank">
						{$_('legal_modal_link_terms')}
						<ExternalLink aria-hidden="true" size={12} />
					</a>
					<span>·</span>
					<a href={LEGAL_URLS.privacy} rel="noopener noreferrer" target="_blank">
						{$_('legal_modal_link_privacy')}
						<ExternalLink aria-hidden="true" size={12} />
					</a>
				</p>

				<label class="queue-ack-item mt-4">
					<input class="queue-ack-checkbox" type="checkbox" bind:checked={accepted} />
					<span class="queue-ack-checkmark" class:checked={accepted}>
						{#if accepted}
							<Check aria-hidden="true" size={14} strokeWidth={3} />
						{/if}
					</span>
					<span class="onboarding-agreement-text">
						{$_('legal_modal_acknowledge')}
					</span>
				</label>
			</div>

			<div class="modal-divider"></div>

			<div class="modal-actions">
				<button class="modal-button-cancel" onclick={requestDecline} type="button">
					{$_('legal_modal_decline')}
				</button>
				<button
					class="modal-button-primary"
					disabled={!accepted}
					onclick={handleAccept}
					type="button"
				>
					{$_('legal_modal_accept')}
				</button>
			</div>
		</div>
	</div>

	{#if showDeclineConfirm}
		<LegalDeclineConfirm onCancel={cancelDecline} onConfirm={confirmDecline} />
	{/if}
{/if}
