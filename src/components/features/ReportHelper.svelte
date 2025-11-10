<script lang="ts">
	import { t } from '@/lib/stores/i18n';
	import { logger } from '@/lib/utils/logger';
	import type { UserStatus } from '@/lib/types/api';
	import { AlertTriangle, Info } from 'lucide-svelte';
	import LoadingSpinner from '../ui/LoadingSpinner.svelte';

	interface Props {
		status?: UserStatus | null;
		onFillForm?: () => void | Promise<void>;
	}

	let { status = null, onFillForm }: Props = $props();

	// Local state
	let processing = $state(false);

	// Computed values
	const isReportable = $derived(status ? '0' in (status.reasons || {}) : false);

	const reportableContent = $derived(
		isReportable && status
			? {
					message: status.reasons?.['0']?.message || 'Inappropriate content detected',
					evidence: status.reasons?.['0']?.evidence || [],
					confidence: status.reasons?.['0']?.confidence || status.confidence || 0
				}
			: null
	);

	const canAutoFill = $derived(isReportable && onFillForm);

	// Handle fill form button click
	async function handleFillForm() {
		if (!canAutoFill || processing) return;

		processing = true;

		try {
			await onFillForm?.();
		} catch (error) {
			logger.error('Failed to fill report form:', error);
			throw error;
		} finally {
			processing = false;
		}
	}
</script>

<div class="report-helper-card {isReportable ? 'reportable' : 'not-reportable'}">
	<div class="report-helper-header">
		{#if isReportable}
			<AlertTriangle class="report-helper-icon reportable" size={24} />
		{:else}
			<Info class="report-helper-icon not-reportable" size={24} />
		{/if}
		<h3 class="report-helper-title">
			{isReportable
				? t('report_helper_card_title_reportable')
				: t('report_helper_card_title_not_reportable')}
		</h3>
	</div>

	<div class="report-helper-content">
		{#if isReportable}
			{#if canAutoFill}
				<p class="report-helper-subtitle">
					{t('report_helper_subtitle_reportable')}
				</p>

				{#if reportableContent}
					<div class="report-helper-evidence-section">
						<h4 class="report-helper-evidence-header">{t('report_helper_evidence_header')}</h4>
						<div class="report-helper-evidence-details">
							<strong>{t('report_helper_evidence_reason_label')}</strong>
							{reportableContent?.message}<br /><br />

							{#if (reportableContent?.evidence?.length ?? 0) > 0}
								<strong>{t('report_helper_evidence_snippets_label')}</strong>
								<ul class="report-helper-evidence-list">
									{#each reportableContent?.evidence || [] as item, idx (idx)}
										<li class="report-helper-evidence-item">
											{item}
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					</div>
				{/if}

				<div class="report-helper-action-section">
					<p>
						{t('report_helper_action_message')}
					</p>

					<button
						class="report-helper-button primary"
						disabled={processing}
						onclick={handleFillForm}
						type="button"
					>
						{#if processing}
							<LoadingSpinner size="small" />
							{t('report_helper_filling_button')}
						{:else}
							{t('report_helper_fill_button')}
						{/if}
					</button>
				</div>

				<div class="report-helper-warning-section">
					<AlertTriangle
						class="report-helper-warning-icon"
						color="var(--color-warning)"
						size={20}
					/>
					<div class="report-helper-warning-text">
						<strong>{t('report_helper_warning_label')}</strong>
						{t('report_helper_warning_message')}
					</div>
				</div>
			{/if}
		{:else}
			<p class="report-helper-subtitle">
				{t('report_helper_subtitle_not_reportable')}
			</p>

			<div class="report-helper-info-section">
				<Info class="report-helper-info-icon" color="var(--color-primary)" size={24} />
				<div class="report-helper-info-text">
					<p>
						<strong>{t('report_helper_info_message_part1')}</strong>
						{t('report_helper_info_message_part2')}
					</p>
					<p>
						{t('report_helper_info_message_part3')}
					</p>

					<div class="report-helper-list">
						<div class="report-helper-list-item">{t('report_helper_category_item1')}</div>
						<div class="report-helper-list-item">{t('report_helper_category_item2')}</div>
						<div class="report-helper-list-item">{t('report_helper_category_item3')}</div>
						<div class="report-helper-list-item">{t('report_helper_category_item4')}</div>
						<div class="report-helper-list-item">{t('report_helper_category_item5')}</div>
					</div>

					<p>
						{t('report_helper_info_message_part4')}
					</p>
				</div>
			</div>
		{/if}
	</div>
</div>
