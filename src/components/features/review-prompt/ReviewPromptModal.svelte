<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Modal from '@/components/ui/Modal.svelte';
	import {
		shouldShowReviewPrompt,
		dismissReviewPrompt,
		markReviewPromptCompleted
	} from '@/lib/stores/review-prompt';
	import { CHROME_STORE_REVIEW_URL, FIREFOX_STORE_REVIEW_URL } from '@/lib/types/constants';
	import { logger } from '@/lib/utils/logging/logger';

	const STAR_COUNT = 5;
	const THEM_BAR_PERCENT = 92;
	const YOU_BAR_PERCENT = 1.5;

	let isOpen = $state(true);

	const variant = $derived($shouldShowReviewPrompt);

	const aQuoteRowsKey = [
		'review_prompt_a_quote_1',
		'review_prompt_a_quote_2',
		'review_prompt_a_quote_3',
		'review_prompt_a_quote_4'
	] as const;
	const bQuoteRowsKey = [
		'review_prompt_b_quote_1',
		'review_prompt_b_quote_2',
		'review_prompt_b_quote_3',
		'review_prompt_b_quote_4'
	] as const;

	async function handleReview(): Promise<void> {
		window.open(CHROME_STORE_REVIEW_URL, '_blank', 'noopener,noreferrer');
		window.open(FIREFOX_STORE_REVIEW_URL, '_blank', 'noopener,noreferrer');
		try {
			await markReviewPromptCompleted();
		} catch (error) {
			logger.error('Failed to mark review prompt completed:', error);
		}
		isOpen = false;
	}

	async function handleDecline(): Promise<void> {
		if (variant) {
			try {
				await dismissReviewPrompt(variant);
			} catch (error) {
				logger.error('Failed to dismiss review prompt:', error);
			}
		}
		isOpen = false;
	}
</script>

{#if variant}
	<Modal
		closeOnOverlayClick={false}
		onClose={handleDecline}
		showCancel={false}
		showConfirm={false}
		status="warning"
		title={variant === 'A' ? $_('review_prompt_a_title') : $_('review_prompt_b_title')}
		bind:isOpen
	>
		<p class="modal-paragraph">
			{variant === 'A' ? $_('review_prompt_a_body_lead') : $_('review_prompt_b_body_lead')}
		</p>

		<div class="modal-section">
			<header class="modal-section-head">
				<h3 class="modal-section-title">
					{variant === 'A'
						? $_('review_prompt_a_quotes_heading')
						: $_('review_prompt_b_quotes_heading')}
				</h3>
			</header>
			<ul class="modal-list">
				{#each variant === 'A' ? aQuoteRowsKey : bQuoteRowsKey as key (key)}
					<li class="review-prompt-quote">
						<span class="review-prompt-stars" aria-hidden="true"
							>★<span class="review-prompt-stars-empty">{'☆'.repeat(STAR_COUNT - 1)}</span></span
						>
						<span class="review-prompt-quote-text">{$_(key)}</span>
					</li>
				{/each}
			</ul>
		</div>

		<div class="modal-section">
			<header class="modal-section-head">
				<h3 class="modal-section-title">
					{variant === 'A' ? $_('review_prompt_a_gap_heading') : $_('review_prompt_b_gap_heading')}
				</h3>
			</header>
			<div class="review-prompt-gap-block">
				<div class="review-prompt-gap-row">
					<span class="review-prompt-gap-label">{$_('review_prompt_gap_them_label')}</span>
					<span class="review-prompt-gap-bar" aria-hidden="true">
						<span style:width="{THEM_BAR_PERCENT}%" class="review-prompt-gap-bar-fill"></span>
					</span>
					<span class="review-prompt-gap-note">{$_('review_prompt_gap_them_note')}</span>
				</div>
				<div class="review-prompt-gap-row">
					<span class="review-prompt-gap-label">{$_('review_prompt_gap_you_label')}</span>
					<span class="review-prompt-gap-bar" aria-hidden="true">
						<span style:width="{YOU_BAR_PERCENT}%" class="review-prompt-gap-bar-fill"></span>
					</span>
					<span class="review-prompt-gap-note">{$_('review_prompt_gap_you_note')}</span>
				</div>
			</div>
		</div>

		<p class="modal-paragraph mt-3">
			{variant === 'A' ? $_('review_prompt_a_body_explain') : $_('review_prompt_b_body_explain')}
		</p>

		<p class="modal-paragraph mt-3">
			{variant === 'A' ? $_('review_prompt_a_body_cta') : $_('review_prompt_b_body_cta')}
		</p>

		{#snippet actions()}
			<button class="modal-button-cancel" onclick={handleDecline} type="button">
				{variant === 'A' ? $_('review_prompt_a_decline') : $_('review_prompt_b_decline')}
			</button>
			<button
				class="modal-button-primary"
				aria-label={$_('review_prompt_confirm_aria')}
				onclick={handleReview}
				type="button"
			>
				{$_('review_prompt_confirm_button')}
			</button>
		{/snippet}
	</Modal>
{/if}
