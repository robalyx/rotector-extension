<script lang="ts">
	import type { CustomApiAuthHeaderType, CustomApiConfig } from '@/lib/types/custom-api';
	import { addCustomApi, updateCustomApi } from '@/lib/stores/custom-apis';
	import { showError, showWarning } from '@/lib/stores/toast';
	import { asApiError } from '@/lib/utils/api/api-error';
	import { logger } from '@/lib/utils/logging/logger';
	import { untrack } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { Upload, Trash2 } from '@lucide/svelte';
	import Modal from '../../../ui/Modal.svelte';

	interface Props {
		editingApi: CustomApiConfig | null;
		onClose: () => void;
	}

	let { editingApi, onClose }: Props = $props();

	let name = $state(untrack(() => editingApi?.name || ''));
	let singleUrl = $state(untrack(() => editingApi?.singleUrl || ''));
	let batchUrl = $state(untrack(() => editingApi?.batchUrl || ''));
	let timeout = $state(untrack(() => editingApi?.timeout || 5000));
	let landscapeImageDataUrl = $state(untrack(() => editingApi?.landscapeImageDataUrl || ''));
	let imageFiles = $state<FileList | null>(null);
	let imageInputEl = $state<HTMLInputElement | null>(null);

	// Setting files=null alone leaves the picker dirty so reset the input element too
	// or the same file can't be re-selected after a rejection
	function resetImageInput() {
		imageFiles = null;
		if (imageInputEl) imageInputEl.value = '';
	}
	let apiKey = $state(untrack(() => editingApi?.apiKey || ''));
	let authHeaderType = $state<CustomApiAuthHeaderType>(
		untrack(() => editingApi?.authHeaderType ?? 'x-auth-token')
	);

	let nameError = $state('');
	let singleUrlError = $state('');
	let batchUrlError = $state('');
	let timeoutError = $state('');
	let imageError = $state('');

	let saving = $state(false);

	const isEditing = $derived(editingApi !== null);
	const modalTitle = $derived(
		isEditing ? $_('custom_api_form_title_edit') : $_('custom_api_form_title_add')
	);

	function validateName(): boolean {
		nameError = '';

		if (!name.trim()) {
			nameError = $_('custom_api_form_error_name_required');
			return false;
		}

		if (name.length > 12) {
			nameError = $_('custom_api_form_error_name_length');
			return false;
		}

		return true;
	}

	function validateSingleUrl(): boolean {
		singleUrlError = '';

		if (!singleUrl.trim()) {
			singleUrlError = $_('custom_api_form_error_url_required');
			return false;
		}

		if (!singleUrl.startsWith('https://')) {
			singleUrlError = $_('custom_api_form_error_url_https');
			return false;
		}

		if (!singleUrl.includes('{userId}')) {
			singleUrlError = $_('custom_api_form_error_url_placeholder');
			return false;
		}

		try {
			new URL(singleUrl.replace('{userId}', '1'));
		} catch {
			singleUrlError = $_('custom_api_form_error_url_invalid');
			return false;
		}

		return true;
	}

	function validateBatchUrl(): boolean {
		batchUrlError = '';

		if (!batchUrl.trim()) {
			batchUrlError = $_('custom_api_form_error_url_required');
			return false;
		}

		if (!batchUrl.startsWith('https://')) {
			batchUrlError = $_('custom_api_form_error_url_https');
			return false;
		}

		try {
			new URL(batchUrl);
		} catch {
			batchUrlError = $_('custom_api_form_error_url_invalid');
			return false;
		}

		return true;
	}

	function validateTimeout(): boolean {
		timeoutError = '';

		if (!timeout || timeout < 1000) {
			timeoutError = $_('custom_api_form_error_timeout_min');
			return false;
		}

		if (timeout > 60000) {
			timeoutError = $_('custom_api_form_error_timeout_max');
			return false;
		}

		return true;
	}

	// Re-validates the file MIME beyond the picker's accept filter and reads the image as a data URL for inline storage
	function handleImageUpload() {
		imageError = '';
		const file = imageFiles?.[0];

		if (!file) {
			landscapeImageDataUrl = '';
			return;
		}

		// File picker accept only filters extensions so double-check actual MIME
		const validMimeTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
		if (!validMimeTypes.includes(file.type)) {
			imageError = $_('custom_api_form_error_image_mime');
			landscapeImageDataUrl = '';
			resetImageInput();
			return;
		}

		const fileSizeKB = file.size / 1024;
		if (fileSizeKB > 100) {
			imageError = $_('custom_api_form_error_image_size', {
				values: { 0: Math.round(fileSizeKB).toString() }
			});
		}

		const reader = new FileReader();
		reader.onload = (e) => {
			landscapeImageDataUrl = e.target?.result as string;
		};
		reader.onerror = () => {
			imageError = $_('custom_api_form_error_image_read');
			landscapeImageDataUrl = '';
		};
		reader.readAsDataURL(file);
	}

	function removeImage() {
		landscapeImageDataUrl = '';
		imageError = '';
		resetImageInput();
	}

	function validateForm(): boolean {
		return [validateName(), validateSingleUrl(), validateBatchUrl(), validateTimeout()].every(
			Boolean
		);
	}

	// Auto-disables the API when its URLs change so the user must retest before traffic resumes against the new endpoint
	async function handleSave() {
		if (!validateForm()) {
			return;
		}

		saving = true;

		try {
			if (isEditing && editingApi) {
				// Changing URLs auto-disables the API so the user must retest before it runs again
				const urlChanged =
					singleUrl.trim() !== editingApi.singleUrl || batchUrl.trim() !== editingApi.batchUrl;

				await updateCustomApi(editingApi.id, {
					name: name.trim(),
					singleUrl: singleUrl.trim(),
					batchUrl: batchUrl.trim(),
					timeout,
					...(urlChanged ? { enabled: false } : {}),
					landscapeImageDataUrl: landscapeImageDataUrl || undefined,
					apiKey: apiKey.trim() || undefined,
					authHeaderType: apiKey.trim() ? authHeaderType : undefined
				});

				logger.userAction('custom_api_updated', {
					apiId: editingApi.id,
					name: name.trim(),
					urlChanged,
					autoDisabled: urlChanged
				});

				if (urlChanged) {
					showWarning($_('custom_api_form_alert_url_changed_disabled'));
				}
			} else {
				await addCustomApi({
					name: name.trim(),
					singleUrl: singleUrl.trim(),
					batchUrl: batchUrl.trim(),
					timeout,
					enabled: false,
					landscapeImageDataUrl: landscapeImageDataUrl || undefined,
					apiKey: apiKey.trim() || undefined,
					authHeaderType: apiKey.trim() ? authHeaderType : undefined
				});

				logger.userAction('custom_api_added', {
					name: name.trim()
				});
			}

			onClose();
		} catch (error) {
			logger.error('Failed to save custom API:', error);
			showError($_('custom_api_form_error_save_prefix') + asApiError(error).message);
		} finally {
			saving = false;
		}
	}

	function handleCancel() {
		onClose();
	}
</script>

<Modal
	confirmText={saving ? $_('custom_api_form_button_saving') : $_('custom_api_form_button_save')}
	isOpen={true}
	onCancel={handleCancel}
	onConfirm={handleSave}
	showStatusChip={false}
	title={modalTitle}
>
	<div class="custom-api-form">
		<div class="form-field">
			<label class="form-label" for="api-name">
				{$_('custom_api_form_label_name')}
				<span class="required" aria-hidden="true">
					{$_('custom_api_form_label_required')}
				</span>
			</label>
			<input
				id="api-name"
				class="form-input"
				class:error={nameError}
				aria-describedby={nameError ? 'api-name-error' : undefined}
				aria-invalid={nameError ? true : undefined}
				aria-required="true"
				maxlength="12"
				oninput={() => validateName()}
				placeholder={$_('custom_api_form_placeholder_name')}
				type="text"
				bind:value={name}
			/>
			<div class="form-hint">
				{$_('custom_api_form_hint_name_length', { values: { 0: name.length.toString() } })}
			</div>
			{#if nameError}
				<div id="api-name-error" class="form-error">{nameError}</div>
			{/if}
		</div>

		<div class="form-field">
			<label class="form-label" for="api-single-url">
				{$_('custom_api_form_label_single_url')}
				<span class="required" aria-hidden="true">
					{$_('custom_api_form_label_required')}
				</span>
			</label>
			<input
				id="api-single-url"
				class="form-input"
				class:error={singleUrlError}
				aria-describedby={singleUrlError ? 'api-single-url-error' : undefined}
				aria-invalid={singleUrlError ? true : undefined}
				aria-required="true"
				oninput={() => validateSingleUrl()}
				placeholder={$_('custom_api_form_placeholder_single_url')}
				type="url"
				bind:value={singleUrl}
			/>
			<div class="form-hint">
				{$_('custom_api_form_hint_single_url')}
			</div>
			{#if singleUrlError}
				<div id="api-single-url-error" class="form-error">{singleUrlError}</div>
			{/if}
		</div>

		<div class="form-field">
			<label class="form-label" for="api-batch-url">
				{$_('custom_api_form_label_batch_url')}
				<span class="required" aria-hidden="true">
					{$_('custom_api_form_label_required')}
				</span>
			</label>
			<input
				id="api-batch-url"
				class="form-input"
				class:error={batchUrlError}
				aria-describedby={batchUrlError ? 'api-batch-url-error' : undefined}
				aria-invalid={batchUrlError ? true : undefined}
				aria-required="true"
				oninput={() => validateBatchUrl()}
				placeholder={$_('custom_api_form_placeholder_batch_url')}
				type="url"
				bind:value={batchUrl}
			/>
			<div class="form-hint">
				{$_('custom_api_form_hint_batch_url')}
			</div>
			{#if batchUrlError}
				<div id="api-batch-url-error" class="form-error">{batchUrlError}</div>
			{/if}
		</div>

		<div class="form-field">
			<label class="form-label" for="api-key">
				{$_('custom_api_form_label_api_key')}
			</label>
			<input
				id="api-key"
				class="form-input"
				autocomplete="off"
				placeholder={$_('custom_api_form_placeholder_api_key')}
				type="password"
				bind:value={apiKey}
			/>
			<div class="form-hint">
				{$_('custom_api_form_hint_api_key')}
			</div>
		</div>

		{#if apiKey.trim()}
			<div class="form-field">
				<label class="form-label" for="api-auth-header">
					{$_('custom_api_form_label_auth_header')}
				</label>
				<select id="api-auth-header" class="form-input" bind:value={authHeaderType}>
					<option value="x-auth-token">
						{$_('custom_api_form_option_x_auth_token')}
					</option>
					<option value="authorization-bearer">
						{$_('custom_api_form_option_authorization_bearer')}
					</option>
					<option value="authorization-plain">
						{$_('custom_api_form_option_authorization_plain')}
					</option>
				</select>
				<div class="form-hint">
					{$_('custom_api_form_hint_auth_header')}
				</div>
			</div>
		{/if}

		<div class="form-field">
			<label class="form-label" for="api-timeout">
				{$_('custom_api_form_label_timeout')}
				<span class="required" aria-hidden="true">
					{$_('custom_api_form_label_required')}
				</span>
			</label>
			<input
				id="api-timeout"
				class="form-input"
				class:error={timeoutError}
				aria-describedby={timeoutError ? 'api-timeout-error' : undefined}
				aria-invalid={timeoutError ? true : undefined}
				aria-required="true"
				max="60000"
				min="1000"
				oninput={() => validateTimeout()}
				placeholder={$_('custom_api_form_placeholder_timeout')}
				step="1000"
				type="number"
				bind:value={timeout}
			/>
			<div class="form-hint">{$_('custom_api_form_hint_timeout')}</div>
			{#if timeoutError}
				<div id="api-timeout-error" class="form-error">{timeoutError}</div>
			{/if}
		</div>

		<div class="form-field">
			<label class="form-label" for="api-image">{$_('custom_api_form_label_image')}</label>
			<label class="form-file-upload" for="api-image">
				<Upload size={14} />
				<span>{$_('custom_api_form_button_choose_image')}</span>
			</label>
			<input
				bind:this={imageInputEl}
				id="api-image"
				class="form-file-input"
				accept=".png,.jpg,.jpeg,.svg,.webp"
				onchange={handleImageUpload}
				type="file"
				bind:files={imageFiles}
			/>
			<div class="form-hint">
				{$_('custom_api_form_hint_image')}
			</div>
			{#if imageError}
				<div class="form-error">{imageError}</div>
			{/if}
			{#if landscapeImageDataUrl}
				<div class="api-form-image-preview">
					<div class="api-form-image-preview-frame">
						<img alt="Landscape preview" src={landscapeImageDataUrl} />
					</div>
					<button class="api-form-image-remove" onclick={removeImage} type="button">
						<Trash2 size={12} />
						<span>{$_('custom_api_form_button_remove_image')}</span>
					</button>
				</div>
			{/if}
		</div>
	</div>
</Modal>
