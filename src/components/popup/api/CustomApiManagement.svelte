<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ArrowLeft,
		Plus,
		Trash2,
		Edit2,
		ChevronUp,
		ChevronDown,
		Check,
		X,
		BookOpen,
		FlaskConical,
		Share2,
		Copy,
		Download,
		Upload,
		AlertTriangle
	} from 'lucide-svelte';
	import type { CustomApiConfig } from '@/lib/types/custom-api';
	import {
		customApis,
		loadCustomApis,
		deleteCustomApi,
		reorderCustomApi,
		testCustomApiConnection,
		updateTestResult,
		updateCustomApi,
		exportApi,
		MAX_CUSTOM_APIS
	} from '@/lib/stores/custom-apis';
	import { showError, showSuccess } from '@/lib/stores/toast';
	import {
		extractOriginPattern,
		hasPermissionsForOrigins,
		requestPermissionsForOrigins
	} from '@/lib/utils/permissions';
	import { logger } from '@/lib/utils/logger';
	import { _ } from 'svelte-i18n';
	import CustomApiForm from './CustomApiForm.svelte';
	import CustomApiImport from './CustomApiImport.svelte';
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';
	import Modal from '../../ui/Modal.svelte';
	import Toggle from '../../ui/Toggle.svelte';

	interface Props {
		onBack: () => void;
		onNavigateToDocumentation: () => void;
	}

	let { onBack, onNavigateToDocumentation }: Props = $props();

	// Local state
	let showForm = $state(false);
	let showImportModal = $state(false);
	let editingApi = $state<CustomApiConfig | null>(null);
	let apiToDelete = $state<CustomApiConfig | null>(null);
	let testingApiId = $state<string | null>(null);
	let openExportDropdown = $state<string | null>(null);
	let loading = $state(true);
	let showPermissionNotice = $state(false);
	let grantingPermissions = $state(false);
	let hasPermissions = $state(false);

	// Computed
	const canAddMore = $derived($customApis.filter((api) => !api.isSystem).length < MAX_CUSTOM_APIS);

	// Handle add new API
	function handleAdd() {
		editingApi = null;
		showForm = true;
	}

	// Handle edit API
	function handleEdit(api: CustomApiConfig) {
		editingApi = api;
		showForm = true;
	}

	// Handle delete API
	function handleDeleteClick(api: CustomApiConfig) {
		apiToDelete = api;
	}

	// Confirm delete API
	async function confirmDelete() {
		if (!apiToDelete) return;

		try {
			await deleteCustomApi(apiToDelete.id);
			logger.userAction('custom_api_deleted', { apiId: apiToDelete.id, apiName: apiToDelete.name });
		} catch (error) {
			logger.error('Failed to delete custom API:', error);
			showError($_('custom_api_mgmt_error_delete'));
		} finally {
			apiToDelete = null;
		}
	}

	// Cancel delete
	function cancelDelete() {
		apiToDelete = null;
	}

	// Handle reorder API
	async function handleReorder(api: CustomApiConfig, direction: 'up' | 'down') {
		try {
			await reorderCustomApi(api.id, direction);
			logger.userAction('custom_api_reordered', {
				apiId: api.id,
				apiName: api.name,
				direction
			});
		} catch (error) {
			logger.error('Failed to reorder custom API:', error);
		}
	}

	// Handle test connection
	async function handleTest(api: CustomApiConfig) {
		testingApiId = api.id;
		try {
			const success = await testCustomApiConnection(api.url);
			await updateTestResult(api.id, success);

			if (success) {
				showSuccess($_('custom_api_mgmt_test_success', { values: { 0: api.name } }));
			} else {
				showError($_('custom_api_mgmt_test_failed', { values: { 0: api.name } }));
			}

			logger.userAction('custom_api_tested', {
				apiId: api.id,
				apiName: api.name,
				success
			});
		} catch (error) {
			logger.error('Failed to test custom API:', error);
			await updateTestResult(api.id, false);
			showError(
				$_('custom_api_mgmt_test_error', {
					values: { 0: api.name, 1: error instanceof Error ? error.message : 'Unknown error' }
				})
			);
		} finally {
			testingApiId = null;
		}
	}

	// Handle toggle API
	async function handleToggle(api: CustomApiConfig, enabled: boolean) {
		try {
			await updateCustomApi(api.id, { enabled });
			logger.userAction('custom_api_toggled', {
				apiId: api.id,
				apiName: api.name,
				enabled
			});
		} catch (error) {
			if (error instanceof Error && error.message === 'PERMISSIONS_REQUIRED') {
				// Extract origin from this API's URL
				const origin = extractOriginPattern(api.url);
				if (!origin) {
					logger.error('Failed to extract origin from API URL:', { url: api.url });
					return;
				}

				// Request permission for this origin
				await requestPermissionsForOrigins([origin]);
			} else {
				logger.error('Failed to toggle custom API:', error);
			}
		}
	}

	// Handle form close
	function handleFormClose() {
		showForm = false;
		editingApi = null;
	}

	// Toggle export dropdown
	function toggleExportDropdown(apiId: string) {
		openExportDropdown = openExportDropdown === apiId ? null : apiId;
	}

	// Close export dropdown when clicking outside
	function closeExportDropdown() {
		openExportDropdown = null;
	}

	// Handle export to clipboard
	async function handleExportClipboard(api: CustomApiConfig) {
		try {
			const exported = exportApi(api.id);
			await navigator.clipboard.writeText(exported);
			showSuccess($_('custom_api_mgmt_alert_export_clipboard_success'));
			logger.userAction('custom_api_exported_clipboard', { apiId: api.id, apiName: api.name });
		} catch (error) {
			logger.error('Failed to export API to clipboard:', error);
			showError(
				$_('custom_api_mgmt_alert_export_failed', {
					values: { 0: error instanceof Error ? error.message : 'Unknown error' }
				})
			);
		} finally {
			closeExportDropdown();
		}
	}

	// Handle export to file
	function handleExportFile(api: CustomApiConfig) {
		try {
			const exported = exportApi(api.id);
			const filename = `${api.name.replace(/[^a-z0-9]/gi, '-')}.rotector-api`;

			// Create blob and trigger download
			const blob = new Blob([exported], { type: 'text/plain' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			showSuccess($_('custom_api_mgmt_alert_export_file_success'));
			logger.userAction('custom_api_exported_file', { apiId: api.id, apiName: api.name });
		} catch (error) {
			logger.error('Failed to export API to file:', error);
			showError(
				$_('custom_api_mgmt_alert_export_failed', {
					values: { 0: error instanceof Error ? error.message : 'Unknown error' }
				})
			);
		} finally {
			closeExportDropdown();
		}
	}

	// Handle import success
	function handleImportSuccess(apiName: string, wasRenamed: boolean, originalName?: string) {
		if (wasRenamed && originalName) {
			showSuccess(
				$_('custom_api_mgmt_alert_import_renamed', { values: { 0: apiName, 1: originalName } })
			);
		} else {
			showSuccess($_('custom_api_mgmt_alert_import_success', { values: { 0: apiName } }));
		}
	}

	// Handle import modal close
	function handleImportClose() {
		showImportModal = false;
	}

	// Format timestamp
	function formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
	}

	// Get endpoint display for an API
	function getEndpoints(api: CustomApiConfig): {
		single: { method: string; url: string };
		batch: { method: string; url: string };
	} {
		if (api.isSystem) {
			// Hardcoded endpoints for Rotector system API
			return {
				single: { method: 'GET', url: 'roscoe.rotector.com/v1/lookup/roblox/user/{userId}' },
				batch: { method: 'POST', url: 'roscoe.rotector.com/v1/lookup/roblox/users' }
			};
		} else {
			// Derive endpoints from custom API URL (remove https:// if present)
			const cleanUrl = api.url.replace(/^https?:\/\//, '');
			return {
				single: { method: 'GET', url: `${cleanUrl}/{userId}` },
				batch: { method: 'POST', url: cleanUrl }
			};
		}
	}

	// Handle grant permissions button click
	async function handleGrantPermissions() {
		grantingPermissions = true;
		try {
			// Collect origins from all custom APIs
			const origins: string[] = [];
			for (const api of $customApis) {
				if (api.isSystem) continue;

				const origin = extractOriginPattern(api.url);
				if (origin && !origins.includes(origin)) {
					origins.push(origin);
				}
			}

			// Request permissions for all custom API origins
			const granted = origins.length > 0 ? await requestPermissionsForOrigins(origins) : true;
			if (granted) {
				hasPermissions = true;
			}
		} catch (error) {
			logger.error('Failed to request permissions:', error);
		} finally {
			grantingPermissions = false;
		}
	}

	// Initialize
	onMount(() => {
		loadCustomApis()
			.then(() => {
				loading = false;
				showPermissionNotice = true;
			})
			.catch((error) => {
				logger.error('Failed to load custom APIs:', error);
				loading = false;
			});
	});

	// Compute unique origins from custom APIs
	const uniqueOrigins = $derived.by(() => {
		const origins: string[] = [];
		for (const api of $customApis) {
			if (api.isSystem) continue;
			const origin = extractOriginPattern(api.url);
			if (origin && !origins.includes(origin)) {
				origins.push(origin);
			}
		}
		return origins;
	});

	// Request permissions when origins array changes
	$effect(() => {
		if (loading) return;

		const origins = uniqueOrigins;
		hasPermissionsForOrigins(origins)
			.then((result) => {
				hasPermissions = origins.length > 0 ? result : true;
			})
			.catch((error) => {
				logger.error('Failed to check permissions:', error);
				hasPermissions = false;
			});
	});
</script>

<div class="custom-api-management">
	<!-- Header -->
	<div class="custom-api-header">
		<button class="back-button" onclick={onBack} type="button">
			<ArrowLeft size={16} />
			<span>{$_('custom_api_mgmt_button_back')}</span>
		</button>
		<h2 class="custom-api-title">{$_('custom_api_mgmt_title')}</h2>
	</div>

	<!-- Introduction Section -->
	<div class="custom-api-intro">
		<p class="custom-api-intro-text">
			{$_('custom_api_mgmt_intro')}
		</p>
	</div>

	<!-- Integration Guide Section -->
	<div class="custom-api-integration-section">
		<h3 class="integration-section-title">{$_('custom_api_mgmt_integration_section_title')}</h3>
		<p class="integration-section-description">
			{$_('custom_api_mgmt_integration_section_description')}
		</p>
		<button class="docs-button" onclick={onNavigateToDocumentation} type="button">
			<BookOpen size={16} />
			{$_('custom_api_mgmt_button_view_integration_guide')}
		</button>
	</div>

	<!-- Permission Notice Banner -->
	{#if showPermissionNotice}
		<div class="permission-notice-banner" class:granted={hasPermissions}>
			<div class="permission-notice-header">
				<div class="permission-notice-icon">
					{#if hasPermissions}
						<Check size={20} />
					{:else}
						<AlertTriangle size={20} />
					{/if}
				</div>
				<h4 class="permission-notice-title">
					{$_(
						hasPermissions
							? 'custom_api_mgmt_permission_granted_title'
							: 'custom_api_mgmt_permission_notice_title'
					)}
				</h4>
			</div>
			<p class="permission-notice-message">
				{$_(
					hasPermissions
						? 'custom_api_mgmt_permission_granted_message'
						: 'custom_api_mgmt_permission_notice_message'
				)}
			</p>
			{#if !hasPermissions}
				<button
					class="permission-notice-button"
					disabled={grantingPermissions}
					onclick={handleGrantPermissions}
					type="button"
				>
					{#if grantingPermissions}
						<LoadingSpinner size="small" />
					{:else}
						{$_('custom_api_mgmt_permission_notice_button')}
					{/if}
				</button>
			{/if}
		</div>
	{/if}

	<!-- API List -->
	<div class="custom-api-list">
		{#if loading}
			<div class="loading-container">
				<LoadingSpinner size="medium" />
				<span>{$_('custom_api_mgmt_loading')}</span>
			</div>
		{:else}
			<!-- API Cards -->
			{#each $customApis as api, index (api.id)}
				{@const endpoints = getEndpoints(api)}
				<div class="api-card" class:disabled={!api.enabled} class:system={api.isSystem}>
					<!-- Left Side: Card Info -->
					<div class="api-card-content">
						<!-- API Image -->
						{#if api.landscapeImageDataUrl}
							<div class="api-card-image">
								<img alt="{api.name} logo" src={api.landscapeImageDataUrl} />
							</div>
						{/if}

						<div class="api-card-header">
							<div class="api-card-header-left">
								<h3 class="api-card-name">{api.name}</h3>
								{#if api.isSystem}
									<span class="status-badge status-system"
										>{$_('custom_api_mgmt_badge_system')}</span
									>
								{/if}
							</div>
							{#if !api.isSystem}
								<Toggle
									checked={api.enabled}
									onchange={(value: boolean) => handleToggle(api, value)}
								/>
							{/if}
						</div>

						<!-- Endpoints -->
						<div class="api-card-endpoints">
							<div class="api-card-endpoint">
								<div class="endpoint-header">
									<span
										class="http-method"
										class:http-method-get={endpoints.single.method === 'GET'}
										>{$_(
											endpoints.single.method === 'GET'
												? 'custom_api_mgmt_http_method_get'
												: 'custom_api_mgmt_http_method_post'
										)}</span
									>
									<span class="endpoint-separator">-</span>
									<span class="endpoint-label">{$_('custom_api_mgmt_label_single')}</span>
								</div>
								<span class="endpoint-value">{endpoints.single.url}</span>
							</div>
							<div class="api-card-endpoint">
								<div class="endpoint-header">
									<span class="http-method" class:http-method-get={endpoints.batch.method === 'GET'}
										>{$_(
											endpoints.batch.method === 'GET'
												? 'custom_api_mgmt_http_method_get'
												: 'custom_api_mgmt_http_method_post'
										)}</span
									>
									<span class="endpoint-separator">-</span>
									<span class="endpoint-label">{$_('custom_api_mgmt_label_batch')}</span>
								</div>
								<span class="endpoint-value">{endpoints.batch.url}</span>
							</div>
						</div>

						<!-- Details -->
						<div class="api-card-details">
							<div class="api-detail-line">
								<span class="api-detail-label">{$_('custom_api_mgmt_label_timeout')}</span>
								<span class="api-detail-value">{api.timeout}{$_('custom_api_mgmt_suffix_ms')}</span>
							</div>
							<div class="api-detail-line">
								<span class="api-detail-label">{$_('custom_api_mgmt_label_created')}</span>
								<span class="api-detail-value">{formatTimestamp(api.createdAt)}</span>
							</div>
							{#if api.lastTested}
								<div class="api-detail-line">
									<span class="api-detail-label">{$_('custom_api_mgmt_label_last_tested')}</span>
									<span class="api-detail-value">
										{formatTimestamp(api.lastTested)}
										{#if api.lastTestSuccess}
											<Check class="test-success-icon" size={12} />
										{:else}
											<X class="test-fail-icon" size={12} />
										{/if}
									</span>
								</div>
							{/if}
						</div>

						{#if !api.isSystem}
							<!-- Actions -->
							<div class="api-card-actions">
								<button
									class="reorder-button"
									disabled={index === 0 || (index > 0 && $customApis[index - 1].isSystem)}
									onclick={() => handleReorder(api, 'up')}
									title={$_('custom_api_mgmt_title_move_up')}
									type="button"
								>
									<ChevronUp size={14} />
								</button>
								<button
									class="reorder-button"
									disabled={index === $customApis.length - 1}
									onclick={() => handleReorder(api, 'down')}
									title={$_('custom_api_mgmt_title_move_down')}
									type="button"
								>
									<ChevronDown size={14} />
								</button>
								<button
									class="action-button test-button"
									disabled={testingApiId === api.id}
									onclick={() => handleTest(api)}
									title={$_('custom_api_mgmt_title_test')}
									type="button"
								>
									{#if testingApiId === api.id}
										<LoadingSpinner size="small" />
									{:else}
										<FlaskConical size={14} />
									{/if}
								</button>
								<div class="export-dropdown-container">
									<button
										class="action-button export-button"
										onclick={() => toggleExportDropdown(api.id)}
										title={$_('custom_api_mgmt_title_export')}
										type="button"
									>
										<Share2 size={14} />
									</button>
									{#if openExportDropdown === api.id}
										<div class="export-dropdown-menu">
											<button
												class="dropdown-item"
												onclick={() => handleExportClipboard(api)}
												type="button"
											>
												<Copy size={14} />
												<span>{$_('custom_api_mgmt_button_export_clipboard')}</span>
											</button>
											<button
												class="dropdown-item"
												onclick={() => handleExportFile(api)}
												type="button"
											>
												<Download size={14} />
												<span>{$_('custom_api_mgmt_button_export_file')}</span>
											</button>
										</div>
									{/if}
								</div>
								<button
									class="action-button edit-button"
									onclick={() => handleEdit(api)}
									title={$_('custom_api_mgmt_title_edit')}
									type="button"
								>
									<Edit2 size={14} />
								</button>
								<button
									class="action-button delete-button"
									onclick={() => handleDeleteClick(api)}
									title={$_('custom_api_mgmt_title_delete')}
									type="button"
								>
									<Trash2 size={14} />
								</button>
							</div>
						{/if}
					</div>
				</div>
			{/each}

			<!-- Add/Import Buttons -->
			<div class="api-list-actions">
				{#if canAddMore}
					<button class="add-api-card" onclick={handleAdd} type="button">
						<Plus size={16} />
						<span>{$_('custom_api_mgmt_button_add')}</span>
					</button>
				{:else}
					<div class="max-apis-notice">
						{$_('custom_api_mgmt_notice_max_reached', {
							values: { 0: MAX_CUSTOM_APIS.toString() }
						})}
					</div>
				{/if}
				<button
					class="import-api-button"
					disabled={!canAddMore}
					onclick={() => (showImportModal = true)}
					title={$_('custom_api_mgmt_title_import')}
					type="button"
				>
					<Upload size={16} />
					<span>{$_('custom_api_mgmt_button_import')}</span>
				</button>
			</div>
		{/if}
	</div>

	<!-- Form Modal -->
	{#if showForm}
		<CustomApiForm {editingApi} onClose={handleFormClose} />
	{/if}

	<!-- Import Modal -->
	{#if showImportModal}
		<CustomApiImport onClose={handleImportClose} onSuccess={handleImportSuccess} />
	{/if}

	<!-- Delete Confirmation Modal -->
	{#if apiToDelete}
		<Modal
			confirmText={$_('custom_api_mgmt_button_delete')}
			isOpen={true}
			modalType="modal"
			onCancel={cancelDelete}
			onConfirm={confirmDelete}
			showCancel={true}
			size="compact"
			title={$_('custom_api_mgmt_delete_title')}
		>
			<p>{$_('custom_api_mgmt_confirm_delete', { values: { 0: apiToDelete.name } })}</p>
		</Modal>
	{/if}
</div>
