<script lang="ts">
	import { VOTE_TYPES } from '@/lib/types/constants';
	import type { VoteData } from '@/lib/types/api';
	import { logger } from '@/lib/utils/logger';
	import { ArrowUp, ArrowDown } from 'lucide-svelte';

	interface Props {
		voteData?: VoteData | null;
		loading?: boolean;
		error?: string | null;
		onVote?: (voteType: number) => void;
	}

	let { voteData = null, loading = false, error = null, onVote }: Props = $props();

	// Computed values
	const voteStats = $derived(() => {
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

	const fillWidth = $derived(() => {
		return `${voteStats().percentage}%`;
	});

	// Handle vote submission
	function handleVoteClick(voteType: number) {
		if (loading || !onVote) return;

		const stats = voteStats();

		logger.userAction('voting_widget_click', {
			voteType,
			previousVote: stats.currentVote,
			action: stats.currentVote === voteType ? 'undo_vote' : 'change_vote'
		});

		onVote(voteType);
	}
</script>

<div class="voting-container" class:voting-loading={loading}>
	<!-- Header -->
	<div class="voting-header">
		<span class="voting-title">Community Feedback</span>
		<span class="voting-count">
			{#if loading}
				Loading...
			{:else}
				{voteStats().totalVotes} {voteStats().totalVotes === 1 ? 'vote' : 'votes'}
			{/if}
		</span>
	</div>

	<!-- Vote bar and stats -->
	<div class="voting-bar">
		<div class="voting-meter">
			<div style:width={fillWidth()} class="voting-meter-fill"></div>
		</div>
		<div class="voting-stats">
			<span class="voting-percentage">
				{loading ? '-' : `${voteStats().percentage}%`}
			</span>
			<span class="voting-ratio">
				{loading ? '-' : `${voteStats().upvotes} / ${voteStats().totalVotes}`}
			</span>
		</div>
	</div>

	<!-- Vote buttons -->
	<div class="voting-buttons">
		<button
			class="voting-upvote voting-button"
			class:voting-button-upvote-active={voteStats().currentVote === VOTE_TYPES.UPVOTE}
			aria-label="Agree with this status"
			disabled={loading}
			onclick={(e) => {
				e.stopPropagation();
				handleVoteClick(VOTE_TYPES.UPVOTE);
			}}
			type="button"
		>
			<ArrowUp class="voting-icon-upvote" size={14} strokeWidth={2.5} />
			<span class="voting-label">Agree</span>
		</button>

		<button
			class="voting-downvote voting-button"
			class:voting-button-downvote-active={voteStats().currentVote === VOTE_TYPES.DOWNVOTE}
			aria-label="Disagree with this status"
			disabled={loading}
			onclick={(e) => {
				e.stopPropagation();
				handleVoteClick(VOTE_TYPES.DOWNVOTE);
			}}
			type="button"
		>
			<ArrowDown class="voting-icon-downvote" size={14} strokeWidth={2.5} />
			<span class="voting-label">Disagree</span>
		</button>
	</div>

	<!-- Description -->
	<p class="voting-description">Help others by confirming if this user's status is accurate.</p>

	<!-- Error display -->
	{#if error}
		<div class="voting-error">
			{error}
		</div>
	{/if}
</div>
