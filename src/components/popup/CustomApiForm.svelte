<script lang="ts">
	import type { CustomApiConfig } from '@/lib/types/custom-api';
	import { addCustomApi, updateCustomApi } from '@/lib/stores/custom-apis';
	import { logger } from '@/lib/utils/logger';
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
	const modalTitle = $derived(() => (isEditing() ? 'Edit Custom API' : 'Add Custom API'));

	// Validate name
	function validateName(): boolean {
		nameError = '';

		if (!name.trim()) {
			nameError = 'Name is required';
			return false;
		}

		if (name.length > 12) {
			nameError = 'Name must be 12 characters or less';
			return false;
		}

		return true;
	}

	// Validate URL
	function validateUrl(): boolean {
		urlError = '';

		if (!url.trim()) {
			urlError = 'URL is required';
			return false;
		}

		if (!url.startsWith('https://')) {
			urlError = 'URL must start with https://';
			return false;
		}

		try {
			new URL(url);
		} catch {
			urlError = 'Invalid URL format';
			return false;
		}

		return true;
	}

	// Validate timeout
	function validateTimeout(): boolean {
		timeoutError = '';

		if (!timeout || timeout < 1000) {
			timeoutError = 'Timeout must be at least 1000ms (1 second)';
			return false;
		}

		if (timeout > 60000) {
			timeoutError = 'Timeout must be 60000ms (60 seconds) or less';
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
			imageError = 'Invalid file type. Please use PNG, JPG, SVG, or WebP';
			landscapeImageDataUrl = '';
			input.value = '';
			return;
		}

		// Validate MIME type
		const validMimeTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
		if (!validMimeTypes.includes(file.type)) {
			imageError = 'Invalid image type. MIME type does not match file extension';
			landscapeImageDataUrl = '';
			input.value = '';
			return;
		}

		// Warn about large file sizes
		const fileSizeKB = file.size / 1024;
		if (fileSizeKB > 100) {
			imageError = `Warning: Large file size (${Math.round(fileSizeKB)}KB). Consider using a smaller image to reduce storage usage.`;
		}

		// Convert to base64 data URL
		try {
			const reader = new FileReader();
			reader.onload = (e) => {
				landscapeImageDataUrl = e.target?.result as string;
			};
			reader.onerror = () => {
				imageError = 'Failed to read image file';
				landscapeImageDataUrl = '';
			};
			reader.readAsDataURL(file);
		} catch {
			imageError = 'Failed to process image file';
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
				'Failed to save custom API: ' + (error instanceof Error ? error.message : 'Unknown error')
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
	confirmText={saving ? 'Saving...' : 'Save'}
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
				Name <span class="required">*</span>
			</label>
			<input
				id="api-name"
				class="form-input"
				class:error={nameError}
				maxlength="12"
				oninput={() => validateName()}
				placeholder="My Custom API"
				type="text"
				bind:value={name}
			/>
			<div class="form-hint">
				Maximum 12 characters ({name.length}/12)
			</div>
			{#if nameError}
				<div class="form-error">{nameError}</div>
			{/if}
		</div>

		<!-- URL Field -->
		<div class="form-field">
			<label class="form-label" for="api-url">
				API URL <span class="required">*</span>
			</label>
			<input
				id="api-url"
				class="form-input"
				class:error={urlError}
				oninput={() => validateUrl()}
				placeholder="https://api.example.com/v1/lookup"
				type="url"
				bind:value={url}
			/>
			<div class="form-hint">
				Must be HTTPS. This is like the base URL for batch lookups. Single lookups will append /{'{'}userId{'}'}
				to this URL.
			</div>
			{#if urlError}
				<div class="form-error">{urlError}</div>
			{/if}
		</div>

		<!-- Timeout Field -->
		<div class="form-field">
			<label class="form-label" for="api-timeout">
				Timeout (ms) <span class="required">*</span>
			</label>
			<input
				id="api-timeout"
				class="form-input"
				class:error={timeoutError}
				max="60000"
				min="1000"
				oninput={() => validateTimeout()}
				placeholder="5000"
				step="1000"
				type="number"
				bind:value={timeout}
			/>
			<div class="form-hint">Request timeout in milliseconds (1000-60000). Default: 5000ms.</div>
			{#if timeoutError}
				<div class="form-error">{timeoutError}</div>
			{/if}
		</div>

		<!-- Landscape Image Field -->
		<div class="form-field">
			<label class="form-label" for="api-image"> Landscape Image (Optional) </label>
			<input
				id="api-image"
				class="form-input"
				class:error={imageError}
				accept=".png,.jpg,.jpeg,.svg,.webp"
				onchange={handleImageUpload}
				type="file"
			/>
			<div class="form-hint">
				Upload a landscape image for the tooltip tab (PNG, JPG, SVG, WebP). Recommended: 480x160px
				(3:1 ratio).
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
						Remove Image
					</button>
				</div>
			{/if}
		</div>

		<!-- Enabled Toggle -->
		<div class="form-field">
			<label class="form-checkbox">
				<input type="checkbox" bind:checked={enabled} />
				<span>Enable this custom API</span>
			</label>
		</div>
	</div>
</Modal>
