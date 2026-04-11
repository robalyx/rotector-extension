<script lang="ts">
	import { importApi } from '@/lib/stores/custom-apis';
	import { showError } from '@/lib/stores/toast';
	import { importCustomApi } from '@/lib/utils/api-export';
	import { logger } from '@/lib/utils/logger';
	import { _ } from 'svelte-i18n';
	import { Upload } from '@lucide/svelte';
	import Modal from '../../ui/Modal.svelte';

	interface Props {
		onClose: () => void;
		onSuccess: (apiName: string, wasRenamed: boolean, originalName?: string) => void;
	}

	let { onClose, onSuccess }: Props = $props();

	// Form state
	let encodedData = $state('');
	let importing = $state(false);

	// Handle file upload
	function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) {
			return;
		}

		// Check file extension
		if (!file.name.endsWith('.rotector-api')) {
			showError($_('custom_api_import_error_invalid_file_extension'));
			input.value = '';
			return;
		}

		// Read file content
		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			encodedData = content.trim();
			input.value = '';
		};
		reader.onerror = () => {
			showError($_('custom_api_import_error_file_read_failed'));
			input.value = '';
		};
		reader.readAsText(file);
	}

	// Handle import
	async function handleImport() {
		if (!encodedData.trim()) {
			showError($_('custom_api_import_error_empty_data'));
			return;
		}

		importing = true;

		try {
			const trimmed = encodedData.trim();
			const originalName = importCustomApi(trimmed).name;
			const newApi = await importApi(trimmed);
			const wasRenamed = newApi.name !== originalName;

			logger.userAction('custom_api_imported', {
				apiId: newApi.id,
				apiName: newApi.name,
				wasRenamed
			});

			onSuccess(newApi.name, wasRenamed, wasRenamed ? originalName : undefined);
			onClose();
		} catch (error) {
			logger.error('Failed to import custom API:', error);
			const errorMessage =
				error instanceof Error ? error.message : $_('custom_api_import_error_unknown');
			showError($_('custom_api_mgmt_alert_import_failed', { values: { 0: errorMessage } }));
		} finally {
			importing = false;
		}
	}
</script>

<Modal
	cancelText={$_('custom_api_import_button_cancel')}
	confirmDisabled={importing || !encodedData.trim()}
	confirmText={importing
		? $_('custom_api_import_button_importing')
		: $_('custom_api_import_button_import')}
	isOpen={true}
	onCancel={onClose}
	onConfirm={handleImport}
	showCancel={true}
	showStatusChip={false}
	title={$_('custom_api_import_title')}
>
	<div class="custom-api-import-modal">
		<!-- Paste Area -->
		<div class="import-form-group">
			<label class="import-label" for="encoded-data">
				{$_('custom_api_import_label_paste')}
			</label>
			<textarea
				id="encoded-data"
				class="import-textarea"
				placeholder={$_('custom_api_import_placeholder_paste')}
				rows="6"
				bind:value={encodedData}
			></textarea>
		</div>

		<div class="import-divider" role="separator">
			<span class="import-divider-label">{$_('custom_api_import_divider_or')}</span>
		</div>

		<!-- File Upload -->
		<label class="form-file-upload" for="file-upload">
			<Upload size={14} />
			<span>{$_('custom_api_import_button_upload_file')}</span>
		</label>
		<input
			id="file-upload"
			class="form-file-input"
			accept=".rotector-api"
			onchange={handleFileUpload}
			type="file"
		/>
	</div>
</Modal>
