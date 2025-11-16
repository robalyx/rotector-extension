<script lang="ts">
	import Toggle from '../../ui/Toggle.svelte';
	import HelpIndicator from '../../ui/HelpIndicator.svelte';
	import Modal from '../../ui/Modal.svelte';
	import NumberInput from '../../ui/NumberInput.svelte';
	import { initializeSettings, settings, updateSetting } from '@/lib/stores/settings';
	import { customApis, loadCustomApis, updateCustomApi } from '@/lib/stores/custom-apis';
	import { extractOriginPattern, requestPermissionsForOrigins } from '@/lib/utils/permissions';
	import type { SettingsKey } from '@/lib/types/settings';
	import {
		DEVELOPER_SETTING_CATEGORY,
		SETTING_CATEGORIES,
		SETTINGS_KEYS
	} from '@/lib/types/settings';
	import { ChevronRight } from 'lucide-svelte';
	import { logger } from '@/lib/utils/logger';
	import { t } from '@/lib/stores/i18n';

	interface Props {
		onNavigateToCustomApis?: () => void;
		onNavigateToRotectorDocs?: () => void;
	}

	let { onNavigateToCustomApis, onNavigateToRotectorDocs }: Props = $props();

	let apiKeyVisible = $state(false);
	let showMatureWarning = $state(false);
	let highlightedSetting = $state<string | null>(null);

	// Toggle API key input field visibility between text and password
	function toggleApiKeyVisibility() {
		apiKeyVisible = !apiKeyVisible;
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
			if (error instanceof Error && error.message === 'PERMISSIONS_REQUIRED') {
				// Look up the API configuration to get the URL
				const api = $customApis.find((a) => a.id === apiId);
				if (!api) {
					logger.error('Failed to find API for permission request:', { apiId });
					return;
				}

				// Extract origin from the API's URL
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

	// Confirm and enable mature content setting
	async function confirmMatureContent() {
		await updateSetting(SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED, true);
		showMatureWarning = false;
	}

	// Close mature content warning modal without enabling
	function closeMatureWarning() {
		showMatureWarning = false;
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

<div
	style:border-color="var(--color-border-subtle)"
	style:box-shadow="0 1px 3px var(--shadow-soft)"
	class="
      bg-bg-content rounded-lg border shadow-soft p-2
      dark:bg-bg-content-dark
    "
>
	{#each SETTING_CATEGORIES as category (category.titleKey)}
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
          ">{t(category.titleKey)}</legend
			>
			<div class="settings-category">
				{#each category.settings as setting (setting.key)}
					{#if setting.key === SETTINGS_KEYS.CACHE_DURATION_MINUTES}
						<NumberInput
							helpText={setting.helpTextKey ? t(setting.helpTextKey) : undefined}
							label={t(setting.labelKey)}
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
								{t(setting.labelKey)}
								{#if setting.helpTextKey}
									<HelpIndicator text={t(setting.helpTextKey)} />
								{/if}
							</div>
							<select
								class="theme-selector"
								onchange={(e) => handleSettingChange(setting.key, e.currentTarget.value)}
								bind:value={$settings[setting.key]}
							>
								<option value="light">{t('settings_theme_light')}</option>
								<option value="dark">{t('settings_theme_dark')}</option>
								<option value="auto">{t('settings_theme_auto')}</option>
							</select>
						</div>
					{:else}
						<div
							class="setting-item"
							class:setting-highlighted={highlightedSetting === setting.key}
							data-setting-key={setting.key}
						>
							<div class="setting-label">
								{t(setting.labelKey)}
								{#if setting.helpTextKey}
									<HelpIndicator text={t(setting.helpTextKey)} />
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
				{#if category.titleKey === 'settings_category_integrations'}
					{#each $customApis as api (api.id)}
						<div class="setting-item" data-setting-key="api-integration-{api.id}">
							<div class="setting-label">
								{api.name}
								{#if api.isSystem}
									<span class="api-system-label">{t('settings_api_system_label')}</span>
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
				{#if category.titleKey === 'settings_category_integrations' && onNavigateToCustomApis && $settings[SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED]}
					<button class="manage-custom-apis-button" onclick={onNavigateToCustomApis} type="button">
						<span class="manage-custom-apis-text">
							{t('settings_manage_apis_button')}
							<span class="custom-api-count">
								{t(
									$customApis.length === 1
										? 'settings_api_count_singular'
										: 'settings_api_count_plural',
									[$customApis.length.toString()]
								)}
							</span>
						</span>
						<ChevronRight size={16} />
					</button>
				{/if}
			</div>
		</fieldset>
	{/each}

	<!-- Developer settings (always visible) -->
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
			{t(DEVELOPER_SETTING_CATEGORY.titleKey)}
		</legend>
		<div class="settings-category">
			{#each DEVELOPER_SETTING_CATEGORY.settings as setting (setting.key)}
				{#if setting.key === SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED}
					<!-- Developer Mode Toggle (always shown) -->
					<div
						class="setting-item"
						class:setting-highlighted={highlightedSetting === setting.key}
						data-setting-key={setting.key}
					>
						<div class="setting-label">
							{t(setting.labelKey)}
							{#if setting.helpTextKey}
								<HelpIndicator text={t(setting.helpTextKey)} />
							{/if}
						</div>
						<Toggle
							checked={Boolean($settings[setting.key] ?? false)}
							onchange={(value: boolean) => handleSettingChange(setting.key, value)}
						/>
					</div>
				{:else if $settings[SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED]}
					<!-- Other developer settings (shown only when developer mode is enabled) -->
					{#if setting.key === SETTINGS_KEYS.CACHE_DURATION_MINUTES}
						<NumberInput
							helpText={setting.helpTextKey ? t(setting.helpTextKey) : undefined}
							label={t(setting.labelKey)}
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
								{t(setting.labelKey)}
								{#if setting.helpTextKey}
									<HelpIndicator text={t(setting.helpTextKey)} />
								{/if}
							</div>
							<Toggle
								checked={Boolean($settings[setting.key] ?? false)}
								onchange={(value: boolean) => handleSettingChange(setting.key, value)}
							/>
						</div>
					{/if}
				{/if}
			{/each}

			<!-- API Key input field (shown only when developer mode is enabled) -->
			{#if $settings[SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED]}
				<div class="api-key-container mt-2.5">
					<div class="setting-label mb-1.5 w-full">{t('settings_api_key_label')}</div>
					<div class="flex items-center gap-1">
						<input
							class="api-key-input"
							oninput={handleApiKeyChange}
							placeholder={t('settings_api_key_placeholder')}
							type={apiKeyVisible ? 'text' : 'password'}
							value={$settings[SETTINGS_KEYS.API_KEY]}
						/>
						<button
							class="api-key-toggle"
							onclick={toggleApiKeyVisibility}
							title={t('settings_api_key_toggle_title')}
							type="button"
						>
							<span class="text-xs select-none">
								{apiKeyVisible ? t('settings_api_key_hide') : t('settings_api_key_show')}
							</span>
						</button>
					</div>
				</div>

				<!-- Rotector API Documentation Button -->
				{#if onNavigateToRotectorDocs}
					<button
						class="manage-custom-apis-button"
						onclick={onNavigateToRotectorDocs}
						type="button"
					>
						<span class="manage-custom-apis-text">
							{t('settings_rotector_api_docs_button')}
						</span>
						<ChevronRight size={16} />
					</button>
				{/if}
			{/if}
		</div>
	</fieldset>
</div>

<!-- Mature Content Warning Modal -->
<Modal
	confirmText={t('settings_modal_confirm_button')}
	onClose={closeMatureWarning}
	onConfirm={confirmMatureContent}
	showCancel={false}
	size="small"
	title={t('settings_modal_title')}
	bind:isOpen={showMatureWarning}
>
	<p class="mb-4 text-sm leading-relaxed">
		<strong>{t('settings_modal_warning_intro')}</strong>
		{t('settings_modal_warning_continuation')}
	</p>

	<div class="modal-content-section-info">
		<h4 class="modal-content-heading">{t('settings_modal_enabled_heading')}</h4>
		<ul class="modal-content-list">
			<li class="modal-content-list-item-info">
				{t('settings_modal_enabled_item1')}
			</li>
			<li class="modal-content-list-item-info">
				{t('settings_modal_enabled_item2')}
			</li>
			<li class="modal-content-list-item-info">
				{t('settings_modal_enabled_item3')}
			</li>
		</ul>
	</div>

	<div class="modal-content-section-warning">
		<h4 class="modal-content-heading">{t('settings_modal_considerations_heading')}</h4>
		<ul class="modal-content-list">
			<li class="modal-content-list-item-warning">
				{t('settings_modal_considerations_item1')}
			</li>
			<li class="modal-content-list-item-warning">
				{t('settings_modal_considerations_item2')}
			</li>
			<li class="modal-content-list-item-warning">
				{t('settings_modal_considerations_item3')}
			</li>
			<li class="modal-content-list-item-warning">
				{t('settings_modal_considerations_item4')}
			</li>
		</ul>
	</div>

	<div class="modal-content-section-recommendation">
		<p class="m-0 text-sm leading-relaxed">
			<strong>{t('settings_modal_recommendation_label')}</strong>
			{t('settings_modal_recommendation_text')}
		</p>
	</div>
</Modal>
