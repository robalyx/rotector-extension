<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { logger } from '@/lib/utils/logger';
	import type { UserStatus } from '@/lib/types/api';
	import { AlertTriangle, Info } from 'lucide-svelte';
	import LoadingSpinner from '../ui/LoadingSpinner.svelte';

	interface Props {
		status?: UserStatus | null;
		onFillForm?: () => void | Promise<void>;
		advancedInfoEnabled: boolean;
	}

	let { status = null, onFillForm, advancedInfoEnabled }: Props = $props();

	// Local state
	let processing = $state(false);

	// Computed values
	const isReportable = $derived(status ? 'User Profile' in (status.reasons || {}) : false);

	const reportableContent = $derived(
		isReportable && status
			? {
					message: status.reasons?.['User Profile']?.message || 'Inappropriate content detected',
					evidence: status.reasons?.['User Profile']?.evidence || [],
					confidence: status.reasons?.['User Profile']?.confidence || status.confidence || 0
				}
			: null
	);

	const canAutoFill = $derived(isReportable && onFillForm && advancedInfoEnabled);

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
				? $_('report_helper_card_title_reportable')
				: $_('report_helper_card_title_not_reportable')}
		</h3>
	</div>

	<div class="report-helper-content">
		{#if isReportable}
			{#if advancedInfoEnabled}
				<p class="report-helper-subtitle">
					{$_('report_helper_subtitle_reportable')}
				</p>

				{#if reportableContent}
					<div class="report-helper-evidence-section">
						<h4 class="report-helper-evidence-header">{$_('report_helper_evidence_header')}</h4>
						<div class="report-helper-evidence-details">
							<strong>{$_('report_helper_evidence_reason_label')}</strong>
							{reportableContent?.message}<br /><br />

							{#if (reportableContent?.evidence?.length ?? 0) > 0}
								<strong>{$_('report_helper_evidence_snippets_label')}</strong>
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
						{$_('report_helper_action_message')}
					</p>

					<button
						class="report-helper-button primary"
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

				<div class="report-helper-warning-section">
					<AlertTriangle
						class="report-helper-warning-icon"
						color="var(--color-warning)"
						size={20}
					/>
					<div class="report-helper-warning-text">
						<strong>{$_('report_helper_warning_label')}</strong>
						{$_('report_helper_warning_message')}
					</div>
				</div>
			{:else}
				<p class="report-helper-subtitle">
					{$_('report_helper_setting_disabled_message')}
				</p>

				<p class="report-helper-subtitle">
					{$_('report_helper_setting_disabled_instruction')}
				</p>

				<div class="report-helper-info-section">
					<Info class="report-helper-info-icon" color="var(--color-primary)" size={24} />
					<div class="report-helper-info-text">
						<p>
							{$_('report_helper_setting_disabled_note')}
						</p>
					</div>
				</div>
			{/if}
		{:else}
			<p class="report-helper-subtitle">
				{$_('report_helper_subtitle_not_reportable')}
			</p>

			<div class="report-helper-info-section">
				<Info class="report-helper-info-icon" color="var(--color-primary)" size={24} />
				<div class="report-helper-info-text">
					<p>
						<strong>{$_('report_helper_info_message_part1')}</strong>
						{$_('report_helper_info_message_part2')}
					</p>
					<p>
						{$_('report_helper_info_message_part3')}
					</p>

					<div class="report-helper-list">
						<div class="report-helper-list-item">{$_('report_helper_category_item1')}</div>
						<div class="report-helper-list-item">{$_('report_helper_category_item2')}</div>
						<div class="report-helper-list-item">{$_('report_helper_category_item3')}</div>
						<div class="report-helper-list-item">{$_('report_helper_category_item4')}</div>
						<div class="report-helper-list-item">{$_('report_helper_category_item5')}</div>
					</div>

					<p>
						{$_('report_helper_info_message_part4')}
					</p>
				</div>
			</div>
		{/if}
	</div>
</div>
