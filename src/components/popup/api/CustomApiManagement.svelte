<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Plus,
		Trash2,
		Edit2,
		ChevronUp,
		ChevronDown,
		Check,
		X,
		FlaskConical,
		Share2,
		Copy,
		Download,
		Upload,
		AlertTriangle
	} from '@lucide/svelte';
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
		extractApiOrigins,
		MAX_CUSTOM_APIS
	} from '@/lib/stores/custom-apis';
	import { showError, showSuccess, showWarning } from '@/lib/stores/toast';
	import { hasPermissionsForOrigins, requestPermissionsForOrigins } from '@/lib/utils/permissions';
	import { logger } from '@/lib/utils/logger';
	import { formatTimestamp } from '@/lib/utils/time';
	import { _ } from 'svelte-i18n';
	import CustomApiForm from './CustomApiForm.svelte';
	import CustomApiImport from './CustomApiImport.svelte';
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';
	import Modal from '../../ui/Modal.svelte';
	import Toggle from '../../ui/Toggle.svelte';

	// Local state
	let showForm = $state(false);
	let showImportModal = $state(false);
	let editingApi = $state<CustomApiConfig | null>(null);
	let apiToDelete = $state<CustomApiConfig | null>(null);
	let testingApiId = $state<string | null>(null);
	let togglingApiId = $state<string | null>(null);
	let openExportDropdown = $state<string | null>(null);
	let loading = $state(true);
	let grantingPermissions = $state(false);
	let hasPermissions = $state(false);
	let perApiPermissions = $state<Record<string, boolean>>({});

	// Computed
	const canAddMore = $derived($customApis.filter((api) => !api.isSystem).length < MAX_CUSTOM_APIS);
	const uniqueOrigins = $derived([
		...new Set($customApis.filter((api) => !api.isSystem).flatMap(extractApiOrigins))
	]);
	const showPermissionNotice = $derived(!loading && !hasPermissions && uniqueOrigins.length > 0);

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
			const success = await testCustomApiConnection(
				api.singleUrl,
				api.batchUrl,
				api.apiKey,
				api.authHeaderType
			);
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
		// Disabling path: straightforward store update
		if (!enabled) {
			try {
				await updateCustomApi(api.id, { enabled: false });
				logger.userAction('custom_api_toggled', {
					apiId: api.id,
					apiName: api.name,
					enabled: false
				});
			} catch (error) {
				logger.error('Failed to disable custom API:', error);
				showError(
					$_('custom_api_mgmt_alert_toggle_error', {
						values: { 0: error instanceof Error ? error.message : 'Unknown error' }
					})
				);
			}
			return;
		}

		// Enabling path: pre-flight permission check
		const origins = extractApiOrigins(api);
		if (origins.length === 0) {
			showError($_('custom_api_mgmt_alert_invalid_url'));
			return;
		}

		togglingApiId = api.id;
		try {
			const hasPerms = await hasPermissionsForOrigins(origins);
			if (!hasPerms) {
				const granted = await requestPermissionsForOrigins(origins);
				perApiPermissions = { ...perApiPermissions, [api.id]: granted };
				if (!granted) {
					showWarning($_('custom_api_mgmt_alert_permission_denied'));
					return;
				}
			} else {
				perApiPermissions = { ...perApiPermissions, [api.id]: true };
			}

			await updateCustomApi(api.id, { enabled: true });
			logger.userAction('custom_api_toggled', {
				apiId: api.id,
				apiName: api.name,
				enabled: true
			});
			showSuccess($_('custom_api_mgmt_alert_enabled', { values: { 0: api.name } }));
		} catch (error) {
			logger.error('Failed to enable custom API:', error);
			showError(
				$_('custom_api_mgmt_alert_toggle_error', {
					values: { 0: error instanceof Error ? error.message : 'Unknown error' }
				})
			);
		} finally {
			togglingApiId = null;
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

	// Get endpoint display for an API
	function getEndpoints(api: CustomApiConfig): {
		single: { method: string; url: string };
		batch: { method: string; url: string };
	} {
		if (api.isSystem) {
			return {
				single: { method: 'GET', url: 'roscoe.rotector.com/v1/lookup/roblox/user/{userId}' },
				batch: { method: 'POST', url: 'roscoe.rotector.com/v1/lookup/roblox/users' }
			};
		} else {
			return {
				single: { method: 'GET', url: api.singleUrl.replace(/^https?:\/\//, '') },
				batch: { method: 'POST', url: api.batchUrl.replace(/^https?:\/\//, '') }
			};
		}
	}

	// Refresh per-API permission status for the "needs permission"
	async function refreshPerApiPermissions() {
		const userApis = $customApis.filter((api) => !api.isSystem);
		const entries = await Promise.all(
			userApis.map(async (api) => {
				const origins = extractApiOrigins(api);
				if (origins.length === 0) return [api.id, false] as const;
				const granted = await hasPermissionsForOrigins(origins);
				return [api.id, granted] as const;
			})
		);
		perApiPermissions = Object.fromEntries(entries);
	}

	// Handle grant permissions button click
	async function handleGrantPermissions() {
		grantingPermissions = true;
		try {
			if (await requestPermissionsForOrigins(uniqueOrigins)) {
				hasPermissions = true;
				await refreshPerApiPermissions();
			}
		} catch (error) {
			logger.error('Failed to request permissions:', error);
		} finally {
			grantingPermissions = false;
		}
	}

	// Initial load
	onMount(async () => {
		try {
			await loadCustomApis();
		} catch (error) {
			logger.error('Failed to load custom APIs:', error);
		} finally {
			loading = false;
		}
	});

	// Permission sync with current origins and cancelled on re-run to prevent stale-write races
	$effect(() => {
		if (loading) return;

		const origins = uniqueOrigins;
		let cancelled = false;

		hasPermissionsForOrigins(origins)
			.then((result) => {
				if (!cancelled) hasPermissions = result;
			})
			.catch((error) => {
				if (cancelled) return;
				logger.error('Failed to check permissions:', error);
				hasPermissions = false;
			});

		return () => {
			cancelled = true;
		};
	});

	// Per-API permission status sync for the "needs permission"
	$effect(() => {
		if (loading) return;

		void $customApis;
		refreshPerApiPermissions().catch((error) => {
			logger.error('Failed to check per-API permissions:', error);
		});
	});
</script>

<div class="custom-api-management">
	<!-- Page header -->
	<header class="custom-api-page-header">
		<h2 class="custom-api-title">{$_('custom_api_mgmt_title')}</h2>
		<p class="custom-api-subtitle">{$_('custom_api_mgmt_subtitle')}</p>
	</header>

	<!-- Inline permission notice -->
	{#if showPermissionNotice}
		<div class="api-permission-notice" role="status">
			<div class="api-permission-notice-icon">
				<AlertTriangle size={16} />
			</div>
			<div class="api-permission-notice-body">
				<span class="api-permission-notice-title">
					{$_('custom_api_mgmt_permission_notice_title')}
				</span>
				<span class="api-permission-notice-message">
					{$_('custom_api_mgmt_permission_notice_message')}
				</span>
			</div>
			<button
				class="api-permission-notice-action"
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
		</div>
	{/if}

	<!-- API list -->
	<div class="custom-api-list">
		{#if loading}
			<div class="loading-container">
				<LoadingSpinner size="medium" />
				<span>{$_('custom_api_mgmt_loading')}</span>
			</div>
		{:else}
			{#each $customApis as api, index (api.id)}
				{@const endpoints = getEndpoints(api)}
				{@const needsPermission =
					!api.isSystem && !api.enabled && perApiPermissions[api.id] === false}
				<article class="api-card" class:disabled={!api.enabled}>
					<!-- Header: name/badge/toggle -->
					<div class="api-card-header">
						<div class="api-card-header-left">
							{#if api.landscapeImageDataUrl}
								<div class="api-card-image">
									<img alt="{api.name} logo" src={api.landscapeImageDataUrl} />
								</div>
							{/if}
							<h3 class="api-card-name">{api.name}</h3>
							{#if api.isSystem}
								<span class="api-status-indicator system">
									<span class="api-status-dot"></span>
									<span>{$_('custom_api_mgmt_badge_system')}</span>
								</span>
							{/if}
							{#if needsPermission}
								<span
									class="api-status-indicator"
									title={$_('custom_api_mgmt_pill_needs_permission_hint')}
								>
									<span class="api-status-dot"></span>
									<span>{$_('custom_api_mgmt_pill_needs_permission')}</span>
								</span>
							{/if}
						</div>
						{#if !api.isSystem}
							<Toggle
								checked={api.enabled}
								loading={togglingApiId === api.id}
								onchange={(value: boolean) => handleToggle(api, value)}
							/>
						{/if}
					</div>

					<!-- Endpoints -->
					<div class="api-card-endpoints">
						<div class="api-card-endpoint">
							<span
								class="api-http-method"
								class:get={endpoints.single.method === 'GET'}
								class:post={endpoints.single.method === 'POST'}
							>
								{endpoints.single.method}
							</span>
							<span class="api-card-endpoint-url">{endpoints.single.url}</span>
						</div>
						<div class="api-card-endpoint">
							<span
								class="api-http-method"
								class:get={endpoints.batch.method === 'GET'}
								class:post={endpoints.batch.method === 'POST'}
							>
								{endpoints.batch.method}
							</span>
							<span class="api-card-endpoint-url">{endpoints.batch.url}</span>
						</div>
					</div>

					<!-- Meta line -->
					{#if !api.isSystem || api.lastTested}
						<div class="api-meta-line">
							{#if !api.isSystem}
								<span class="api-meta-item">
									{api.timeout}{$_('custom_api_mgmt_suffix_ms')}
								</span>
								<span class="api-meta-separator" aria-hidden="true">·</span>
								<span class="api-meta-item">
									{$_('custom_api_mgmt_label_created')}
									{formatTimestamp(api.createdAt / 1000)}
								</span>
							{/if}
							{#if api.lastTested}
								{#if !api.isSystem}
									<span class="api-meta-separator" aria-hidden="true">·</span>
								{/if}
								<span class="api-meta-item">
									{$_('custom_api_mgmt_label_last_tested')}
									{formatTimestamp(api.lastTested / 1000)}
									{#if api.lastTestSuccess}
										<span class="api-meta-status success" aria-label="Success">
											<Check size={12} />
										</span>
									{:else}
										<span class="api-meta-status error" aria-label="Failed">
											<X size={12} />
										</span>
									{/if}
								</span>
							{/if}
						</div>
					{/if}

					{#if !api.isSystem}
						<!-- Actions -->
						<div class="api-card-actions">
							<div class="api-card-actions-group">
								<button
									class="api-card-ghost-button"
									aria-label={$_('custom_api_mgmt_title_move_up')}
									disabled={index === 0 || (index > 0 && $customApis[index - 1].isSystem)}
									onclick={() => handleReorder(api, 'up')}
									title={$_('custom_api_mgmt_title_move_up')}
									type="button"
								>
									<ChevronUp size={14} />
								</button>
								<button
									class="api-card-ghost-button"
									aria-label={$_('custom_api_mgmt_title_move_down')}
									disabled={index === $customApis.length - 1}
									onclick={() => handleReorder(api, 'down')}
									title={$_('custom_api_mgmt_title_move_down')}
									type="button"
								>
									<ChevronDown size={14} />
								</button>
							</div>
							<div class="api-card-actions-spacer"></div>
							<div class="api-card-actions-group">
								<button
									class="api-card-ghost-button"
									aria-label={$_('custom_api_mgmt_title_test')}
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
								<button
									class="api-card-ghost-button edit"
									aria-label={$_('custom_api_mgmt_title_edit')}
									onclick={() => handleEdit(api)}
									title={$_('custom_api_mgmt_title_edit')}
									type="button"
								>
									<Edit2 size={14} />
								</button>
								<div class="export-dropdown-container">
									<button
										class="api-card-ghost-button"
										aria-label={$_('custom_api_mgmt_title_export')}
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
									class="api-card-ghost-button delete"
									aria-label={$_('custom_api_mgmt_title_delete')}
									onclick={() => handleDeleteClick(api)}
									title={$_('custom_api_mgmt_title_delete')}
									type="button"
								>
									<Trash2 size={14} />
								</button>
							</div>
						</div>
					{/if}
				</article>
			{/each}

			<!-- Add/Import buttons -->
			<div class="api-list-actions">
				{#if !canAddMore}
					<p class="api-max-notice">
						{$_('custom_api_mgmt_notice_max_reached', {
							values: { 0: MAX_CUSTOM_APIS.toString() }
						})}
					</p>
				{/if}
				<div class="api-list-actions-row">
					<button class="api-add-button" disabled={!canAddMore} onclick={handleAdd} type="button">
						<Plus size={16} />
						<span>{$_('custom_api_mgmt_button_add')}</span>
					</button>
					<button
						class="api-import-button"
						disabled={!canAddMore}
						onclick={() => (showImportModal = true)}
						title={$_('custom_api_mgmt_title_import')}
						type="button"
					>
						<Upload size={16} />
						<span>{$_('custom_api_mgmt_button_import')}</span>
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Form Modal -->
{#if showForm}
	<CustomApiForm {editingApi} onClose={handleFormClose} />
{/if}

<!-- Import Modal -->
{#if showImportModal}
	<CustomApiImport onClose={handleImportClose} onSuccess={handleImportSuccess} />
{/if}

{#if apiToDelete}
	<Modal
		confirmDanger
		confirmText={$_('custom_api_mgmt_button_delete')}
		isOpen={true}
		onCancel={cancelDelete}
		onConfirm={confirmDelete}
		showCancel={true}
		size="small"
		status="warning"
		title={$_('custom_api_mgmt_delete_title')}
	>
		<p class="modal-paragraph">
			{$_('custom_api_mgmt_confirm_delete', { values: { 0: apiToDelete.name } })}
		</p>
	</Modal>
{/if}
