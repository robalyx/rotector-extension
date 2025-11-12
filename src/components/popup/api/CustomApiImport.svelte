<script lang="ts">
	import { importApi } from '@/lib/stores/custom-apis';
	import { importCustomApi } from '@/lib/utils/api-export';
	import { logger } from '@/lib/utils/logger';
	import { t } from '@/lib/stores/i18n';
	import { Upload } from 'lucide-svelte';
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
			alert(t('custom_api_import_error_invalid_file_extension'));
			return;
		}

		// Read file content
		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			encodedData = content.trim();
		};
		reader.onerror = () => {
			alert(t('custom_api_import_error_file_read_failed'));
		};
		reader.readAsText(file);
	}

	// Handle import
	async function handleImport() {
		if (!encodedData.trim()) {
			alert(t('custom_api_import_error_empty_data'));
			return;
		}

		importing = true;

		try {
			const originalName = getApiNameFromEncodedData(encodedData);
			const newApi = await importApi(encodedData.trim());
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
				error instanceof Error ? error.message : t('custom_api_import_error_unknown');
			alert(`${t('custom_api_mgmt_alert_import_failed')} ${errorMessage}`);
		} finally {
			importing = false;
		}
	}

	// Helper to extract API name from encoded data (for better error messages)
	function getApiNameFromEncodedData(data: string): string {
		try {
			const decoded = importCustomApi(data);
			return decoded.name;
		} catch {
			return '';
		}
	}
</script>

<Modal
	cancelText={t('custom_api_import_button_cancel')}
	confirmDisabled={importing || !encodedData.trim()}
	confirmText={importing
		? t('custom_api_import_button_importing')
		: t('custom_api_import_button_import')}
	isOpen={true}
	modalType="modal"
	onCancel={onClose}
	onConfirm={handleImport}
	showCancel={true}
	size="normal"
	title={t('custom_api_import_title')}
>
	<div class="custom-api-import-modal">
		<!-- Paste Area -->
		<div class="import-form-group">
			<label class="import-label" for="encoded-data">
				{t('custom_api_import_label_paste')}
			</label>
			<textarea
				id="encoded-data"
				class="import-textarea"
				placeholder={t('custom_api_import_placeholder_paste')}
				rows="6"
				bind:value={encodedData}
			></textarea>
		</div>

		<!-- File Upload -->
		<div class="import-form-group">
			<button class="upload-file-button" type="button">
				<label for="file-upload">
					<Upload size={16} />
					<span>{t('custom_api_import_button_upload_file')}</span>
				</label>
			</button>
			<input
				id="file-upload"
				class="file-input-hidden"
				accept=".rotector-api"
				onchange={handleFileUpload}
				type="file"
			/>
		</div>
	</div>
</Modal>
