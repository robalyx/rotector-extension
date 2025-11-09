<script lang="ts">
	import Toggle from '../../ui/Toggle.svelte';
	import HelpIndicator from '../../ui/HelpIndicator.svelte';
	import Modal from '../../ui/Modal.svelte';
	import NumberInput from '../../ui/NumberInput.svelte';
	import { initializeSettings, settings, updateSetting } from '@/lib/stores/settings';
	import { customApis, loadCustomApis, updateCustomApi } from '@/lib/stores/custom-apis';
	import type { SettingsKey } from '@/lib/types/settings';
	import {
		DEVELOPER_SETTING_CATEGORY,
		SETTING_CATEGORIES,
		SETTINGS_KEYS
	} from '@/lib/types/settings';
	import { PartyPopper, ChevronRight } from 'lucide-svelte';
	import { logger } from '@/lib/utils/logger';

	interface Props {
		onNavigateToCustomApis?: () => void;
	}

	let { onNavigateToCustomApis }: Props = $props();

	let apiKeyVisible = $state(false);
	let showMatureWarning = $state(false);
	let highlightedSetting = $state<string | null>(null);

	// Developer mode unlock state
	let showUnlockMessage = $state(false);

	// Toggle API key input field visibility between text and password
	function toggleApiKeyVisibility() {
		apiKeyVisible = !apiKeyVisible;
	}

	// Unlock developer mode (called from navbar)
	export async function unlockDeveloperMode() {
		await updateSetting(SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED, true);
		showUnlockMessage = true;

		setTimeout(() => {
			showUnlockMessage = false;
		}, 3000);
	}

	// Handle setting changes with special handling for mature content warning
	async function handleSettingChange(key: SettingsKey, value: boolean | number | string) {
		if (key === SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED && !$settings[key] && value) {
			showMatureWarning = true;
			return;
		}

		await updateSetting(key, value);
	}

	// Handle API key input changes
	async function handleApiKeyChange(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		await updateSetting(SETTINGS_KEYS.API_KEY, target.value.trim());
	}

	// Handle custom API toggle changes
	async function handleApiToggle(apiId: string, enabled: boolean) {
		try {
			await updateCustomApi(apiId, { enabled });
			logger.userAction('custom_api_toggled', { apiId, enabled });
		} catch (error) {
			logger.error('Failed to toggle custom API:', error);
		}
	}

	// Confirm and enable mature content setting
	async function confirmMatureContent() {
		await updateSetting(SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED, true);
		showMatureWarning = false;
	}

	// Close mature content warning modal without enabling
	function closeMatureWarning() {
		showMatureWarning = false;
	}

	// Reset developer mode to locked state
	async function resetDeveloperMode() {
		await updateSetting(SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED, false);
		showUnlockMessage = false;
	}

	// Highlight a specific setting temporarily
	export function highlightSetting(settingKey: string) {
		highlightedSetting = settingKey;

		setTimeout(() => {
			highlightedSetting = null;
		}, 4000);
	}

	$effect(() => {
		Promise.all([initializeSettings(), loadCustomApis()]).catch((error) => {
			logger.error('Failed to initialize settings or custom APIs:', error);
		});
	});
</script>

<!-- Developer mode unlock success message -->
{#if showUnlockMessage}
	<div
		class="
        mb-2 rounded-sm border border-green-300 bg-green-100 p-2 text-sm
        text-green-800 flex items-center gap-2
        dark:border-green-700 dark:bg-green-900 dark:text-green-200
      "
	>
		<PartyPopper size={16} />
		Developer mode unlocked! Advanced settings are now available.
	</div>
{/if}

<div
	style:border-color="var(--color-border-subtle)"
	style:box-shadow="0 1px 3px var(--shadow-soft)"
	class="
      bg-bg-content rounded-lg border shadow-soft p-2
      dark:bg-bg-content-dark
    "
>
	{#each SETTING_CATEGORIES as category (category.title)}
		<fieldset
			style:border-color="var(--color-border-subtle)"
			class="
                m-0 mb-2 rounded-sm border p-1.5 px-2 pb-2
                last:mb-0
              "
		>
			<legend
				class="
            text-text-subtle ml-0.5 px-1 text-2xs font-medium
            dark:text-text-subtle-dark
          ">{category.title}</legend
			>
			<div class="settings-category">
				{#each category.settings as setting (setting.key)}
					{#if setting.key === SETTINGS_KEYS.CACHE_DURATION_MINUTES}
						<NumberInput
							helpText={setting.helpText}
							label={setting.label}
							max={10}
							min={1}
							onChange={(value: number) => handleSettingChange(setting.key, value)}
							value={Number($settings[setting.key] ?? 1)}
						/>
					{:else if setting.key === SETTINGS_KEYS.THEME}
						<div
							class="setting-item"
							class:setting-highlighted={highlightedSetting === setting.key}
							data-setting-key={setting.key}
						>
							<div class="setting-label">
								{setting.label}
								{#if setting.helpText}
									<HelpIndicator text={setting.helpText} />
								{/if}
							</div>
							<select
								class="theme-selector"
								onchange={(e) => handleSettingChange(setting.key, e.currentTarget.value)}
								bind:value={$settings[setting.key]}
							>
								<option value="light">Light</option>
								<option value="dark">Dark</option>
								<option value="auto">Auto</option>
							</select>
						</div>
					{:else}
						<div
							class="setting-item"
							class:setting-highlighted={highlightedSetting === setting.key}
							data-setting-key={setting.key}
						>
							<div class="setting-label">
								{setting.label}
								{#if setting.helpText}
									<HelpIndicator text={setting.helpText} />
								{/if}
							</div>
							<Toggle
								checked={Boolean($settings[setting.key] ?? false)}
								onchange={(value: boolean) => handleSettingChange(setting.key, value)}
								preventChange={setting.key === SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED &&
									!($settings[setting.key] ?? false)}
							/>
						</div>
					{/if}
				{/each}

				<!-- API Integrations Quick Toggles -->
				{#if category.title === 'Integrations'}
					{#each $customApis as api (api.id)}
						<div class="setting-item" data-setting-key="api-integration-{api.id}">
							<div class="setting-label">
								{api.name}
								{#if api.isSystem}
									<span class="api-system-label">(System)</span>
								{/if}
							</div>
							<Toggle
								checked={api.enabled}
								disabled={api.isSystem}
								onchange={(value: boolean) => handleApiToggle(api.id, value)}
							/>
						</div>
					{/each}
				{/if}

				<!-- API Integrations Management Button -->
				{#if category.title === 'Integrations' && onNavigateToCustomApis}
					<button class="manage-custom-apis-button" onclick={onNavigateToCustomApis} type="button">
						<span class="manage-custom-apis-text">
							Manage API Integrations
							<span class="custom-api-count"
								>({$customApis.length} API{$customApis.length !== 1 ? 's' : ''})</span
							>
						</span>
						<ChevronRight size={16} />
					</button>
				{/if}
			</div>
		</fieldset>
	{/each}

	<!-- Developer settings (shown only when unlocked) -->
	{#if $settings[SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED]}
		<fieldset
			style:border-color="var(--color-border-subtle)"
			class="
                m-0 mb-2 rounded-sm border bg-yellow-50 p-1.5 px-2 pb-2
                last:mb-0
                dark:bg-yellow-900/20
              "
		>
			<legend
				class="
        text-text-subtle ml-0.5 px-1 text-2xs font-medium
        dark:text-text-subtle-dark
      "
			>
				{DEVELOPER_SETTING_CATEGORY.title}
			</legend>
			<div class="settings-category">
				{#each DEVELOPER_SETTING_CATEGORY.settings as setting (setting.key)}
					{#if setting.key === SETTINGS_KEYS.CACHE_DURATION_MINUTES}
						<NumberInput
							helpText={setting.helpText}
							label={setting.label}
							max={10}
							min={1}
							onChange={(value: number) => handleSettingChange(setting.key, value)}
							value={Number($settings[setting.key] ?? 1)}
						/>
					{:else}
						<div
							class="setting-item"
							class:setting-highlighted={highlightedSetting === setting.key}
							data-setting-key={setting.key}
						>
							<div class="setting-label">
								{setting.label}
								{#if setting.helpText}
									<HelpIndicator text={setting.helpText} />
								{/if}
							</div>
							<Toggle
								checked={Boolean($settings[setting.key] ?? false)}
								onchange={(value: boolean) => handleSettingChange(setting.key, value)}
							/>
						</div>
					{/if}
				{/each}

				<!-- API Key input field -->
				<div class="api-key-container mt-2.5">
					<div class="setting-label mb-1.5 w-full">API Key (Optional)</div>
					<div class="flex items-center gap-1">
						<input
							class="api-key-input"
							oninput={handleApiKeyChange}
							placeholder="Enter your API key"
							type={apiKeyVisible ? 'text' : 'password'}
							value={$settings[SETTINGS_KEYS.API_KEY]}
						/>
						<button
							class="api-key-toggle"
							onclick={toggleApiKeyVisibility}
							title="Show/Hide API Key"
							type="button"
						>
							<span class="text-xs select-none">{apiKeyVisible ? 'HIDE' : 'SHOW'}</span>
						</button>
					</div>
				</div>

				<!-- Reset developer mode button -->
				<div
					class="
          border-border mt-3 border-t pt-3
          dark:border-border-dark
        "
				>
					<button class="developer-reset-button" onclick={resetDeveloperMode} type="button">
						Hide Developer Settings
					</button>
				</div>
			</div>
		</fieldset>
	{/if}
</div>

<!-- Mature Content Warning Modal -->
<Modal
	confirmText="Enable Advanced Details"
	onClose={closeMatureWarning}
	onConfirm={confirmMatureContent}
	showCancel={false}
	size="small"
	title="Advanced Details Warning"
	bind:isOpen={showMatureWarning}
>
	<p class="mb-4 text-sm leading-relaxed">
		<strong>Advanced violation details may contain sensitive content</strong>
		that is referenced from user profiles and activities that violated platform policies.
	</p>

	<div class="modal-content-section-info">
		<h4 class="modal-content-heading">What you'll see when enabled:</h4>
		<ul class="modal-content-list">
			<li class="modal-content-list-item-info">
				Detailed violation messages explaining why a user was flagged
			</li>
			<li class="modal-content-list-item-info">
				Evidence snippets containing the policy-violating content found
			</li>
			<li class="modal-content-list-item-info">
				Specific examples of violations from user profiles and activities
			</li>
		</ul>
	</div>

	<div class="modal-content-section-warning">
		<h4 class="modal-content-heading">Important Considerations</h4>
		<ul class="modal-content-list">
			<li class="modal-content-list-item-warning">
				Content may include material that violates platform community standards
			</li>
			<li class="modal-content-list-item-warning">
				This information is intended for moderation and safety purposes only
			</li>
			<li class="modal-content-list-item-warning">
				If you prefer not to view detailed violation evidence, keep this setting disabled
			</li>
			<li class="modal-content-list-item-warning">
				You can disable this feature at any time in the settings
			</li>
		</ul>
	</div>

	<div class="modal-content-section-recommendation">
		<p class="m-0 text-sm leading-relaxed">
			<strong>Recommendation:</strong> Only enable this if you need detailed violation information for
			moderation purposes and understand that you may see content that violates community guidelines.
		</p>
	</div>
</Modal>
