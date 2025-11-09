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
		FlaskConical
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
		MAX_CUSTOM_APIS
	} from '@/lib/stores/custom-apis';
	import { logger } from '@/lib/utils/logger';
	import CustomApiForm from './CustomApiForm.svelte';
	import LoadingSpinner from '../ui/LoadingSpinner.svelte';
	import Toggle from '../ui/Toggle.svelte';

	interface Props {
		onBack: () => void;
		onNavigateToDocumentation: () => void;
	}

	let { onBack, onNavigateToDocumentation }: Props = $props();

	// Local state
	let showForm = $state(false);
	let editingApi = $state<CustomApiConfig | null>(null);
	let testingApiId = $state<string | null>(null);
	let loading = $state(true);

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
	async function handleDelete(api: CustomApiConfig) {
		if (!confirm(`Delete custom API "${api.name}"?`)) {
			return;
		}

		try {
			await deleteCustomApi(api.id);
			logger.userAction('custom_api_deleted', { apiId: api.id, apiName: api.name });
		} catch (error) {
			logger.error('Failed to delete custom API:', error);
			alert('Failed to delete custom API');
		}
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
				alert(`✓ Connection successful!\n\nAPI "${api.name}" is reachable and responding.`);
			} else {
				alert(
					`✗ Connection failed\n\nAPI "${api.name}" is not responding or returned an error.\n\nPlease check:\n• URL is correct and accessible\n• API server is running\n• CORS is configured if needed`
				);
			}

			logger.userAction('custom_api_tested', {
				apiId: api.id,
				apiName: api.name,
				success
			});
		} catch (error) {
			logger.error('Failed to test custom API:', error);
			await updateTestResult(api.id, false);
			alert(
				`✗ Connection test error\n\nFailed to test API "${api.name}".\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`
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
			logger.error('Failed to toggle custom API:', error);
			alert('Failed to update API status');
		}
	}

	// Handle form close
	function handleFormClose() {
		showForm = false;
		editingApi = null;
	}

	// Format timestamp
	function formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
	}

	// Get endpoint display for an API
	function getEndpoints(api: CustomApiConfig): { single: string; batch: string } {
		if (api.isSystem) {
			// Hardcoded endpoints for Rotector system API
			return {
				single: 'GET https://roscoe.robalyx.com/v1/lookup/roblox/user/{userId}',
				batch: 'POST https://roscoe.robalyx.com/v1/lookup/roblox/users'
			};
		} else {
			// Derive endpoints from custom API URL
			return {
				single: `GET ${api.url}/{userId}`,
				batch: `POST ${api.url}`
			};
		}
	}

	// Initialize
	onMount(() => {
		loadCustomApis()
			.then(() => {
				loading = false;
			})
			.catch((error) => {
				logger.error('Failed to load custom APIs:', error);
				loading = false;
			});
	});
</script>

<div class="custom-api-management">
	<!-- Header -->
	<div class="custom-api-header">
		<button class="back-button" onclick={onBack} type="button">
			<ArrowLeft size={16} />
			<span>Back</span>
		</button>
		<h2 class="custom-api-title">API Integrations</h2>
	</div>

	<!-- Introduction Section -->
	<div class="custom-api-intro">
		<p class="custom-api-intro-text">
			Manage all API integrations in one place. Rotector provides core safety analysis, and you can
			add your own custom APIs to extend functionality with additional moderation lists and
			detection systems.
		</p>
		<div class="custom-api-intro-actions">
			<button class="docs-button" onclick={onNavigateToDocumentation} type="button">
				<BookOpen size={16} />
				View Documentation
			</button>
		</div>
	</div>

	<!-- API List -->
	<div class="custom-api-list">
		{#if loading}
			<div class="loading-container">
				<LoadingSpinner size="medium" />
				<span>Loading custom APIs...</span>
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
									<span class="status-badge status-system">System API</span>
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
							<p class="api-card-endpoint">
								<span class="endpoint-label">Single:</span>
								<span class="endpoint-value">{endpoints.single}</span>
							</p>
							<p class="api-card-endpoint">
								<span class="endpoint-label">Batch:</span>
								<span class="endpoint-value">{endpoints.batch}</span>
							</p>
						</div>

						<!-- Details -->
						<div class="api-card-details">
							<div class="api-detail-line">
								<span class="api-detail-label">Timeout:</span>
								<span class="api-detail-value">{api.timeout}ms</span>
							</div>
							<div class="api-detail-line">
								<span class="api-detail-label">Created:</span>
								<span class="api-detail-value">{formatTimestamp(api.createdAt)}</span>
							</div>
							{#if api.lastTested}
								<div class="api-detail-line">
									<span class="api-detail-label">Last Tested:</span>
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
					</div>

					{#if !api.isSystem}
						<!-- Vertical Divider -->
						<div class="api-card-divider"></div>

						<!-- Right Side: Actions -->
						<div class="api-card-actions">
							<button
								class="reorder-button"
								disabled={index === 0 || (index > 0 && $customApis[index - 1].isSystem)}
								onclick={() => handleReorder(api, 'up')}
								title="Move up"
								type="button"
							>
								<ChevronUp size={14} />
							</button>
							<button
								class="reorder-button"
								disabled={index === $customApis.length - 1}
								onclick={() => handleReorder(api, 'down')}
								title="Move down"
								type="button"
							>
								<ChevronDown size={14} />
							</button>
							<button
								class="action-button test-button"
								disabled={testingApiId === api.id}
								onclick={() => handleTest(api)}
								title="Test Connection"
								type="button"
							>
								{#if testingApiId === api.id}
									<LoadingSpinner size="small" />
								{:else}
									<FlaskConical size={14} />
								{/if}
							</button>
							<button
								class="action-button edit-button"
								onclick={() => handleEdit(api)}
								title="Edit"
								type="button"
							>
								<Edit2 size={14} />
							</button>
							<button
								class="action-button delete-button"
								onclick={() => handleDelete(api)}
								title="Delete"
								type="button"
							>
								<Trash2 size={14} />
							</button>
						</div>
					{/if}
				</div>
			{/each}

			<!-- Add Custom API Card -->
			{#if canAddMore}
				<button class="add-api-card" onclick={handleAdd} type="button">
					<Plus size={16} />
					<span>Add Custom API</span>
				</button>
			{:else}
				<div class="max-apis-notice">
					Maximum of {MAX_CUSTOM_APIS} custom APIs reached. Delete an existing API to add a new one.
				</div>
			{/if}
		{/if}
	</div>

	<!-- Form Modal -->
	{#if showForm}
		<CustomApiForm {editingApi} onClose={handleFormClose} />
	{/if}
</div>
