<script lang="ts">
	import { VOTE_TYPES, type VoteType } from '@/lib/types/constants';
	import type { VoteData } from '@/lib/types/api';
	import { logger } from '@/lib/utils/logging/logger';
	import { _ } from 'svelte-i18n';
	import { ArrowUp, ArrowDown, Flag } from '@lucide/svelte';
	import ExtLink from '@/components/ui/ExtLink.svelte';
	import CanvasText from '@/components/ui/CanvasText.svelte';

	interface Props {
		voteData?: VoteData | null;
		loading?: boolean;
		error?: string | null;
		onVote?: (voteType: VoteType) => void;
		confirmed?: boolean;
	}

	let {
		voteData = null,
		loading = false,
		error = null,
		onVote,
		confirmed = false
	}: Props = $props();

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

	const fillWidth = $derived(`${String(voteStats.percentage)}%`);

	function handleVoteClick(voteType: VoteType) {
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
	</div>

	<!-- Vote bar and stats -->
	<div class="voting-bar">
		<div class="voting-meter" aria-hidden="true">
			<div style:width={fillWidth} class="voting-meter-fill"></div>
		</div>
		<div class="voting-stats">
			<span>
				<CanvasText text={loading ? '-' : `${String(voteStats.percentage)}%`} />
			</span>
			<span>
				<CanvasText
					text={loading ? '-' : `${String(voteStats.upvotes)} / ${String(voteStats.totalVotes)}`}
				/>
			</span>
		</div>
	</div>

	<!-- Vote buttons -->
	<div class="voting-buttons">
		<button
			class="voting-upvote voting-button"
			class:voting-button-upvote-active={voteStats.currentVote === VOTE_TYPES.UPVOTE}
			aria-label={$_('voting_aria_agree')}
			aria-pressed={voteStats.currentVote === VOTE_TYPES.UPVOTE}
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

		{#if confirmed}
			<ExtLink
				class="voting-downvote voting-button"
				aria-label={$_('voting_aria_dispute')}
				href="https://rotector.com"
				onclick={(e: MouseEvent) => e.stopPropagation()}
			>
				<Flag class="voting-icon-downvote" size={14} strokeWidth={2.5} />
				<span class="voting-label">{$_('voting_button_dispute')}</span>
			</ExtLink>
		{:else}
			<button
				class="voting-downvote voting-button"
				class:voting-button-downvote-active={voteStats.currentVote === VOTE_TYPES.DOWNVOTE}
				aria-label={$_('voting_aria_disagree')}
				aria-pressed={voteStats.currentVote === VOTE_TYPES.DOWNVOTE}
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
		{/if}
	</div>

	<!-- Description -->
	<p class="voting-description">
		{$_(confirmed ? 'voting_description_confirmed' : 'voting_description')}
	</p>

	<!-- Error display -->
	{#if error}
		<div class="voting-error" role="alert">
			<CanvasText multiline text={error} />
		</div>
	{/if}
</div>
