<script lang="ts">
	import type { CustomApiConfig } from '@/lib/types/custom-api';
	import { addCustomApi, updateCustomApi } from '@/lib/stores/custom-apis';
	import { logger } from '@/lib/utils/logger';
	import { t } from '@/lib/stores/i18n';
	import Modal from '../ui/Modal.svelte';

	interface Props {
		editingApi: CustomApiConfig | null;
		onClose: () => void;
	}

	let { editingApi, onClose }: Props = $props();

	// Form state
	let name = $state(editingApi?.name || '');
	let url = $state(editingApi?.url || '');
	let timeout = $state(editingApi?.timeout || 5000);
	let enabled = $state(editingApi?.enabled ?? true);
	let landscapeImageDataUrl = $state(editingApi?.landscapeImageDataUrl || '');

	// Validation state
	let nameError = $state('');
	let urlError = $state('');
	let timeoutError = $state('');
	let imageError = $state('');

	// UI state
	let saving = $state(false);

	const isEditing = $derived(() => editingApi !== null);
	const modalTitle = $derived(() =>
		isEditing() ? t('custom_api_form_title_edit') : t('custom_api_form_title_add')
	);

	// Validate name
	function validateName(): boolean {
		nameError = '';

		if (!name.trim()) {
			nameError = t('custom_api_form_error_name_required');
			return false;
		}

		if (name.length > 12) {
			nameError = t('custom_api_form_error_name_length');
			return false;
		}

		return true;
	}

	// Validate URL
	function validateUrl(): boolean {
		urlError = '';

		if (!url.trim()) {
			urlError = t('custom_api_form_error_url_required');
			return false;
		}

		if (!url.startsWith('https://')) {
			urlError = t('custom_api_form_error_url_https');
			return false;
		}

		try {
			new URL(url);
		} catch {
			urlError = t('custom_api_form_error_url_invalid');
			return false;
		}

		return true;
	}

	// Validate timeout
	function validateTimeout(): boolean {
		timeoutError = '';

		if (!timeout || timeout < 1000) {
			timeoutError = t('custom_api_form_error_timeout_min');
			return false;
		}

		if (timeout > 60000) {
			timeoutError = t('custom_api_form_error_timeout_max');
			return false;
		}

		return true;
	}

	// Handle landscape image file selection
	function handleImageUpload(event: Event) {
		imageError = '';
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) {
			landscapeImageDataUrl = '';
			return;
		}

		// Validate file extension
		const validExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
		const fileName = file.name.toLowerCase();
		const hasValidExtension = validExtensions.some((ext) => fileName.endsWith(ext));

		if (!hasValidExtension) {
			imageError = t('custom_api_form_error_image_type');
			landscapeImageDataUrl = '';
			input.value = '';
			return;
		}

		// Validate MIME type
		const validMimeTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
		if (!validMimeTypes.includes(file.type)) {
			imageError = t('custom_api_form_error_image_mime');
			landscapeImageDataUrl = '';
			input.value = '';
			return;
		}

		// Warn about large file sizes
		const fileSizeKB = file.size / 1024;
		if (fileSizeKB > 100) {
			imageError = t('custom_api_form_error_image_size', [Math.round(fileSizeKB).toString()]);
		}

		// Convert to base64 data URL
		try {
			const reader = new FileReader();
			reader.onload = (e) => {
				landscapeImageDataUrl = e.target?.result as string;
			};
			reader.onerror = () => {
				imageError = t('custom_api_form_error_image_read');
				landscapeImageDataUrl = '';
			};
			reader.readAsDataURL(file);
		} catch {
			imageError = t('custom_api_form_error_image_process');
			landscapeImageDataUrl = '';
		}
	}

	// Remove landscape image
	function removeImage() {
		landscapeImageDataUrl = '';
		imageError = '';
		const input = document.getElementById('api-image') as HTMLInputElement;
		if (input) {
			input.value = '';
		}
	}

	// Validate all fields
	function validateForm(): boolean {
		const nameValid = validateName();
		const urlValid = validateUrl();
		const timeoutValid = validateTimeout();

		return nameValid && urlValid && timeoutValid;
	}

	// Handle save
	async function handleSave() {
		if (!validateForm()) {
			return;
		}

		saving = true;

		try {
			if (isEditing() && editingApi) {
				// Update existing API
				await updateCustomApi(editingApi.id, {
					name: name.trim(),
					url: url.trim(),
					timeout,
					enabled,
					landscapeImageDataUrl: landscapeImageDataUrl || undefined
				});

				logger.userAction('custom_api_updated', {
					apiId: editingApi.id,
					name: name.trim()
				});
			} else {
				// Add new API
				await addCustomApi({
					name: name.trim(),
					url: url.trim(),
					timeout,
					enabled,
					landscapeImageDataUrl: landscapeImageDataUrl || undefined
				});

				logger.userAction('custom_api_added', {
					name: name.trim()
				});
			}

			onClose();
		} catch (error) {
			logger.error('Failed to save custom API:', error);
			alert(
				t('custom_api_form_error_save_prefix') +
					(error instanceof Error ? error.message : t('custom_api_form_error_unknown'))
			);
		} finally {
			saving = false;
		}
	}

	// Handle cancel
	function handleCancel() {
		onClose();
	}
</script>

<Modal
	confirmText={saving ? t('custom_api_form_button_saving') : t('custom_api_form_button_save')}
	isOpen={true}
	modalType="modal"
	onCancel={handleCancel}
	onConfirm={handleSave}
	showCancel={true}
	size="normal"
	title={modalTitle()}
>
	<div class="custom-api-form">
		<!-- Name Field -->
		<div class="form-field">
			<label class="form-label" for="api-name">
				{t('custom_api_form_label_name')}
				<span class="required">{t('custom_api_form_label_required')}</span>
			</label>
			<input
				id="api-name"
				class="form-input"
				class:error={nameError}
				maxlength="12"
				oninput={() => validateName()}
				placeholder={t('custom_api_form_placeholder_name')}
				type="text"
				bind:value={name}
			/>
			<div class="form-hint">
				{t('custom_api_form_hint_name_length', [name.length.toString()])}
			</div>
			{#if nameError}
				<div class="form-error">{nameError}</div>
			{/if}
		</div>

		<!-- URL Field -->
		<div class="form-field">
			<label class="form-label" for="api-url">
				{t('custom_api_form_label_url')}
				<span class="required">{t('custom_api_form_label_required')}</span>
			</label>
			<input
				id="api-url"
				class="form-input"
				class:error={urlError}
				oninput={() => validateUrl()}
				placeholder={t('custom_api_form_placeholder_url')}
				type="url"
				bind:value={url}
			/>
			<div class="form-hint">
				{t('custom_api_form_hint_url')}
			</div>
			{#if urlError}
				<div class="form-error">{urlError}</div>
			{/if}
		</div>

		<!-- Timeout Field -->
		<div class="form-field">
			<label class="form-label" for="api-timeout">
				{t('custom_api_form_label_timeout')}
				<span class="required">{t('custom_api_form_label_required')}</span>
			</label>
			<input
				id="api-timeout"
				class="form-input"
				class:error={timeoutError}
				max="60000"
				min="1000"
				oninput={() => validateTimeout()}
				placeholder={t('custom_api_form_placeholder_timeout')}
				step="1000"
				type="number"
				bind:value={timeout}
			/>
			<div class="form-hint">{t('custom_api_form_hint_timeout')}</div>
			{#if timeoutError}
				<div class="form-error">{timeoutError}</div>
			{/if}
		</div>

		<!-- Landscape Image Field -->
		<div class="form-field">
			<label class="form-label" for="api-image"> {t('custom_api_form_label_image')} </label>
			<input
				id="api-image"
				class="form-input"
				class:error={imageError}
				accept=".png,.jpg,.jpeg,.svg,.webp"
				onchange={handleImageUpload}
				type="file"
			/>
			<div class="form-hint">
				{t('custom_api_form_hint_image')}
			</div>
			{#if imageError}
				<div class="form-error">{imageError}</div>
			{/if}
			{#if landscapeImageDataUrl}
				<div
					class="mt-2 p-2.5 bg-(--color-surface-secondary) rounded-lg flex flex-col gap-2 items-start"
				>
					<img
						class="max-w-[240px] h-[80px] object-contain rounded-sm bg-(--color-surface-primary) p-1"
						alt="Landscape preview"
						src={landscapeImageDataUrl}
					/>
					<button
						class="px-2.5 py-1 bg-(--color-danger) text-(--color-text-inverse) border-none rounded-sm cursor-pointer text-xs font-medium transition-colors duration-200 hover:bg-(--color-danger-hover)"
						onclick={removeImage}
						type="button"
					>
						{t('custom_api_form_button_remove_image')}
					</button>
				</div>
			{/if}
		</div>

		<!-- Enabled Toggle -->
		<div class="form-field">
			<label class="form-checkbox">
				<input type="checkbox" bind:checked={enabled} />
				<span>{t('custom_api_form_checkbox_enable')}</span>
			</label>
		</div>
	</div>
</Modal>
