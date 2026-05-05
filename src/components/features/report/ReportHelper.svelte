<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { logger } from '@/lib/utils/logging/logger';
	import type { UserStatus } from '@/lib/types/api';
	import { REASON_KEYS } from '@/lib/types/constants';
	import { ChevronDown, ChevronUp, CircleCheckBig, TriangleAlert, Info } from '@lucide/svelte';
	import AppLogo from '../../ui/AppLogo.svelte';
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';

	interface Props {
		status?: UserStatus | null;
		onFillForm?: () => void | Promise<void>;
		advancedInfoEnabled: boolean;
	}

	let { status = null, onFillForm, advancedInfoEnabled }: Props = $props();

	let processing = $state(false);
	let showEvidence = $state(false);
	let feedbackState = $state<{ type: 'success' | 'error'; message: string } | null>(null);
	let feedbackTimeout: ReturnType<typeof setTimeout> | undefined;

	const isReportable = $derived(status?.isReportable ?? false);
	const canAutoFill = $derived(isReportable && onFillForm && advancedInfoEnabled);

	const reportableContent = $derived(
		isReportable && status
			? {
					message: status.reasons[REASON_KEYS.USER_PROFILE]?.message,
					evidence: status.reasons[REASON_KEYS.USER_PROFILE]?.evidence ?? []
				}
			: null
	);

	$effect(() => {
		return () => clearTimeout(feedbackTimeout);
	});

	async function handleFillForm() {
		if (!canAutoFill || processing) return;
		processing = true;

		try {
			await onFillForm?.();
			showFeedback('success', $_('report_helper_filled_success'));
		} catch (error) {
			logger.error('Failed to fill report form:', error);
			showFeedback('error', $_('report_helper_filled_error'));
			throw error;
		} finally {
			processing = false;
		}
	}

	function showFeedback(type: 'success' | 'error', message: string) {
		clearTimeout(feedbackTimeout);
		feedbackState = { type, message };
		feedbackTimeout = setTimeout(
			() => {
				feedbackState = null;
			},
			type === 'error' ? 8000 : 5000
		);
	}

	function toggleEvidence() {
		showEvidence = !showEvidence;
	}
</script>

<div class="report-bar">
	{#if feedbackState}
		<div
			class="report-bar-feedback {feedbackState.type}"
			aria-live={feedbackState.type === 'error' ? 'assertive' : 'polite'}
			role="status"
		>
			{#if feedbackState.type === 'success'}
				<CircleCheckBig size={16} strokeWidth={2.25} />
			{:else}
				<TriangleAlert size={16} strokeWidth={2.25} />
			{/if}
			<span>{feedbackState.message}</span>
		</div>
	{:else}
		<div class="report-bar-logo">
			<AppLogo />
		</div>

		<div class="report-bar-content">
			{#if isReportable}
				<div class="report-bar-status reportable">
					<TriangleAlert size={14} strokeWidth={2.25} />
					<span>{$_('report_helper_reportable_label')}</span>
				</div>

				{#if advancedInfoEnabled}
					<div class="report-bar-actions">
						<button
							class="report-bar-btn-evidence"
							aria-controls="report-bar-evidence"
							aria-expanded={showEvidence}
							onclick={toggleEvidence}
							type="button"
						>
							{$_('report_helper_evidence_button')}
							{#if showEvidence}
								<ChevronUp size={12} strokeWidth={2.5} />
							{:else}
								<ChevronDown size={12} strokeWidth={2.5} />
							{/if}
						</button>
						<button
							class="report-bar-btn-fill"
							disabled={processing}
							onclick={handleFillForm}
							type="button"
						>
							{#if processing}
								<LoadingSpinner size="small" />
								{$_('report_helper_filling_button')}
							{:else}
								{$_('report_helper_fill_button')}
							{/if}
						</button>
					</div>
				{:else}
					<span class="report-bar-disabled-hint">
						{$_('report_helper_enable_advanced')}
					</span>
				{/if}
			{:else}
				<div class="report-bar-status not-reportable">
					<Info size={14} strokeWidth={2.25} />
					<span>{$_('report_helper_not_reportable_label')}</span>
				</div>
			{/if}
		</div>
	{/if}
</div>

{#if showEvidence && reportableContent && !feedbackState}
	<div id="report-bar-evidence" class="report-bar-evidence">
		{#if reportableContent.message}
			<div class="report-bar-evidence-reason">
				<strong>{$_('report_helper_evidence_reason_label')}</strong>
				{reportableContent.message}
			</div>
		{/if}
		{#if reportableContent.evidence.length > 0}
			<div class="report-bar-evidence-snippets">
				<strong>{$_('report_helper_evidence_snippets_label')}</strong>
				<ul class="report-bar-evidence-list">
					{#each reportableContent.evidence as item, idx (idx)}
						<li class="report-bar-evidence-item">{item}</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
{/if}

{#if isReportable && advancedInfoEnabled && !feedbackState}
	<p class="report-bar-footnote">{$_('report_helper_account_warning')}</p>
{/if}
