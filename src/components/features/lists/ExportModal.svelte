<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Modal from '../../ui/Modal.svelte';
	import { apiClient } from '@/lib/services/rotector/api-client';
	import { asApiError } from '@/lib/utils/api/api-error';
	import { logger } from '@/lib/utils/logging/logger';

	interface Props {
		isOpen: boolean;
		groupId: string;
	}

	const EXPORT_COLUMNS = [
		{ key: 'userId', labelKey: 'export_modal_column_user_id', sortable: true },
		{ key: 'name', labelKey: 'export_modal_column_name', sortable: true },
		{ key: 'displayName', labelKey: 'export_modal_column_display_name', sortable: true },
		{ key: 'status', labelKey: 'export_modal_column_status', sortable: true },
		{ key: 'confidence', labelKey: 'export_modal_column_confidence', sortable: true },
		{ key: 'reason', labelKey: 'export_modal_column_reason', sortable: false },
		{ key: 'role', labelKey: 'export_modal_column_role', sortable: true },
		{ key: 'rank', labelKey: 'export_modal_column_rank', sortable: true }
	] as const;

	let { isOpen = $bindable(), groupId }: Props = $props();

	let format = $state<'json' | 'csv'>('json');
	let selectedColumns = $state<string[]>(EXPORT_COLUMNS.map((c) => c.key));
	let sortColumn = $state('userId');
	let sortOrder = $state<'asc' | 'desc'>('asc');
	let isExporting = $state(false);
	let errorMessage = $state<string | null>(null);
	let cooldownSeconds = $state(0);

	const allSelected = $derived(selectedColumns.length === EXPORT_COLUMNS.length);

	function toggleColumn(key: string) {
		selectedColumns = selectedColumns.includes(key)
			? selectedColumns.filter((k) => k !== key)
			: [...selectedColumns, key];
	}

	function toggleAllColumns() {
		selectedColumns = allSelected ? [] : EXPORT_COLUMNS.map((c) => c.key);
	}

	async function handleExport() {
		if (selectedColumns.length === 0) {
			errorMessage = $_('export_modal_error_no_columns');
			return;
		}

		isExporting = true;
		errorMessage = null;

		try {
			const result = await apiClient.exportGroupTrackedUsers(
				groupId,
				format,
				$state.snapshot(selectedColumns),
				sortColumn,
				sortOrder
			);

			const blob = new Blob([result.content], { type: result.mimeType });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = result.filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			isOpen = false;
		} catch (error) {
			const err = asApiError(error);
			if (err.status === 429 && typeof err.rateLimitReset === 'number') {
				cooldownSeconds = Math.max(0, Math.ceil(err.rateLimitReset - Date.now() / 1000));
			} else {
				errorMessage = err.message || $_('export_modal_error_export_failed');
			}

			logger.error('Export failed', error);
		} finally {
			isExporting = false;
		}
	}

	$effect(() => {
		if (isOpen) {
			errorMessage = null;
			isExporting = false;
		}
	});

	// Cooldown countdown timer for rate-limited exports
	$effect(() => {
		if (cooldownSeconds <= 0) return;
		const interval = setInterval(() => {
			cooldownSeconds--;
			if (cooldownSeconds <= 0) clearInterval(interval);
		}, 1000);
		return () => clearInterval(interval);
	});
</script>

<Modal
	showCancel={false}
	showConfirm={false}
	showStatusChip={false}
	title={$_('export_modal_title')}
	bind:isOpen
>
	<p class="modal-paragraph">{$_('export_modal_description')}</p>

	<div class="modal-section">
		<header class="modal-section-head">
			<h3 class="modal-section-title">{$_('export_modal_format_label')}</h3>
		</header>
		<div class="export-format-group">
			<button
				class="export-format-btn"
				class:active={format === 'json'}
				aria-pressed={format === 'json'}
				onclick={() => (format = 'json')}
				type="button"
			>
				JSON
			</button>
			<button
				class="export-format-btn"
				class:active={format === 'csv'}
				aria-pressed={format === 'csv'}
				onclick={() => (format = 'csv')}
				type="button"
			>
				CSV
			</button>
		</div>
	</div>

	<div class="modal-section">
		<header class="modal-section-head">
			<h3 class="modal-section-title">{$_('export_modal_columns_label')}</h3>
			<button class="export-columns-toggle" onclick={toggleAllColumns} type="button">
				{allSelected
					? $_('export_modal_columns_deselect_all')
					: $_('export_modal_columns_select_all')}
			</button>
		</header>
		<div class="export-columns-grid">
			{#each EXPORT_COLUMNS as column (column.key)}
				<label class="export-column-item">
					<input
						class="export-column-checkbox"
						checked={selectedColumns.includes(column.key)}
						onchange={() => toggleColumn(column.key)}
						type="checkbox"
					/>
					<span>{$_(column.labelKey)}</span>
				</label>
			{/each}
		</div>
	</div>

	<div class="modal-section">
		<header class="modal-section-head">
			<h3 class="modal-section-title">{$_('export_modal_sort_label')}</h3>
		</header>
		<div class="export-sort-row">
			<select
				class="export-select"
				aria-label={$_('export_modal_sort_label')}
				bind:value={sortColumn}
			>
				{#each EXPORT_COLUMNS.filter((c) => c.sortable) as column (column.key)}
					<option value={column.key}>{$_(column.labelKey)}</option>
				{/each}
			</select>
			<button
				class="export-order-btn"
				aria-pressed={sortOrder === 'asc'}
				onclick={() => (sortOrder = sortOrder === 'asc' ? 'desc' : 'asc')}
				type="button"
			>
				{sortOrder === 'asc' ? $_('export_modal_order_asc') : $_('export_modal_order_desc')}
			</button>
		</div>
	</div>

	{#if errorMessage}
		<div class="export-error" role="alert">{errorMessage}</div>
	{/if}

	{#snippet actions()}
		{#if cooldownSeconds > 0}
			<span class="export-cooldown">
				{$_('export_modal_cooldown', { values: { seconds: cooldownSeconds } })}
			</span>
		{/if}
		<button class="modal-button-cancel" onclick={() => (isOpen = false)} type="button">
			{$_('queue_popup_cancel_button')}
		</button>
		<button
			class="modal-button-primary"
			disabled={isExporting || cooldownSeconds > 0 || selectedColumns.length === 0}
			onclick={handleExport}
			type="button"
		>
			{isExporting ? $_('export_modal_button_exporting') : $_('export_modal_button_export')}
		</button>
	{/snippet}
</Modal>
