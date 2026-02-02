<script lang="ts">
	import { VOTE_TYPES } from '@/lib/types/constants';
	import type { VoteData } from '@/lib/types/api';
	import { logger } from '@/lib/utils/logger';
	import { _ } from 'svelte-i18n';
	import { ArrowUp, ArrowDown } from 'lucide-svelte';

	interface Props {
		voteData?: VoteData | null;
		loading?: boolean;
		error?: string | null;
		onVote?: (voteType: number) => void;
	}

	let { voteData = null, loading = false, error = null, onVote }: Props = $props();

	// Computed values
	const voteStats = $derived.by(() => {
		if (!voteData) {
			return {
				upvotes: 0,
				downvotes: 0,
				totalVotes: 0,
				percentage: 0,
				currentVote: null
			};
		}

		const total = voteData.upvotes + voteData.downvotes;
		const percentage = total > 0 ? Math.round((voteData.upvotes / total) * 100) : 0;

		return {
			upvotes: voteData.upvotes,
			downvotes: voteData.downvotes,
			totalVotes: total,
			percentage,
			currentVote: voteData.currentVote
		};
	});

	const fillWidth = $derived(`${voteStats.percentage}%`);

	// Handle vote submission
	function handleVoteClick(voteType: number) {
		if (loading || !onVote) return;

		logger.userAction('voting_widget_click', {
			voteType,
			previousVote: voteStats.currentVote,
			action: voteStats.currentVote === voteType ? 'undo_vote' : 'change_vote'
		});

		onVote(voteType);
	}
</script>

<div class="voting-container" class:voting-loading={loading}>
	<!-- Header -->
	<div class="voting-header">
		<span class="voting-title">{$_('voting_header_title')}</span>
		<span class="voting-count">
			{#if loading}
				{$_('voting_loading')}
			{:else}
				{$_(voteStats.totalVotes === 1 ? 'voting_count_singular' : 'voting_count_plural', {
					values: { 0: voteStats.totalVotes.toString() }
				})}
			{/if}
		</span>
	</div>

	<!-- Vote bar and stats -->
	<div class="voting-bar">
		<div class="voting-meter">
			<div style:width={fillWidth} class="voting-meter-fill"></div>
		</div>
		<div class="voting-stats">
			<span class="voting-percentage">
				{loading ? '-' : `${voteStats.percentage}%`}
			</span>
			<span class="voting-ratio">
				{loading ? '-' : `${voteStats.upvotes} / ${voteStats.totalVotes}`}
			</span>
		</div>
	</div>

	<!-- Vote buttons -->
	<div class="voting-buttons">
		<button
			class="voting-upvote voting-button"
			class:voting-button-upvote-active={voteStats.currentVote === VOTE_TYPES.UPVOTE}
			aria-label={$_('voting_aria_agree')}
			disabled={loading}
			onclick={(e) => {
				e.stopPropagation();
				handleVoteClick(VOTE_TYPES.UPVOTE);
			}}
			type="button"
		>
			<ArrowUp class="voting-icon-upvote" size={14} strokeWidth={2.5} />
			<span class="voting-label">{$_('voting_button_agree')}</span>
		</button>

		<button
			class="voting-downvote voting-button"
			class:voting-button-downvote-active={voteStats.currentVote === VOTE_TYPES.DOWNVOTE}
			aria-label={$_('voting_aria_disagree')}
			disabled={loading}
			onclick={(e) => {
				e.stopPropagation();
				handleVoteClick(VOTE_TYPES.DOWNVOTE);
			}}
			type="button"
		>
			<ArrowDown class="voting-icon-downvote" size={14} strokeWidth={2.5} />
			<span class="voting-label">{$_('voting_button_disagree')}</span>
		</button>
	</div>

	<!-- Description -->
	<p class="voting-description">{$_('voting_description')}</p>

	<!-- Error display -->
	{#if error}
		<div class="voting-error">
			{error}
		</div>
	{/if}
</div>
