<script lang="ts">
	import Toggle from '../../ui/Toggle.svelte';
	import HelpIndicator from '../../ui/HelpIndicator.svelte';
	import Modal from '../../ui/Modal.svelte';
	import NumberInput from '../../ui/NumberInput.svelte';
	import {
		initializeSettings,
		settings,
		updateSetting,
		currentPreset,
		applyAgePreset
	} from '@/lib/stores/settings';
	import { customApis, loadCustomApis, updateCustomApi } from '@/lib/stores/custom-apis';
	import { errorLogs } from '@/lib/stores/developer-logs';
	import { setLanguage, getAvailableLocales } from '@/lib/stores/i18n';
	import {
		extractOriginPattern,
		hasTranslatePermission,
		requestPermissionsForOrigins,
		requestTranslatePermission
	} from '@/lib/utils/permissions';
	import type { SettingsKey } from '@/lib/types/settings';
	import {
		AGE_PRESETS,
		EXPERIMENTAL_BLUR_CATEGORY,
		EXPERIMENTAL_DEVELOPER_CATEGORY,
		SETTING_CATEGORIES,
		SETTINGS_KEYS
	} from '@/lib/types/settings';
	import { ChevronRight } from 'lucide-svelte';
	import { logger } from '@/lib/utils/logger';
	import { _ } from 'svelte-i18n';

	const availableLocales = getAvailableLocales();

	interface Props {
		onNavigateToCustomApis?: () => void;
		onNavigateToRotectorDocs?: () => void;
		onNavigateToDeveloperLogs?: () => void;
	}

	let { onNavigateToCustomApis, onNavigateToRotectorDocs, onNavigateToDeveloperLogs }: Props =
		$props();

	let apiKeyVisible = $state(false);
	let showMatureWarning = $state(false);

	// Toggle API key input field visibility between text and password
	function toggleApiKeyVisibility() {
		apiKeyVisible = !apiKeyVisible;
	}

	// Handle change of settings with special cases
	async function handleSettingChange(key: SettingsKey, value: boolean | number | string) {
		if (key === SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED && !$settings[key] && value) {
			showMatureWarning = true;
			return;
		}

		if (key === SETTINGS_KEYS.TRANSLATE_VIOLATIONS_ENABLED && value === true) {
			const hasPermission = await hasTranslatePermission();
			if (!hasPermission) {
				const granted = await requestTranslatePermission();
				if (!granted) {
					return;
				}
			}
		}

		await updateSetting(key, value);
	}

	// Handle language change with i18n library
	async function handleLanguageChange(localeCode: string) {
		await setLanguage(localeCode);
		await updateSetting(SETTINGS_KEYS.LANGUAGE_OVERRIDE, localeCode);
	}

	// Handle preset change
	async function handlePresetChange(preset: string) {
		if (preset === AGE_PRESETS.MINOR || preset === AGE_PRESETS.ADULT) {
			await applyAgePreset(preset);
		}
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

	// Check if all settings in a category are enabled
	function areAllCategorySettingsEnabled(categorySettings: Array<{ key: SettingsKey }>): boolean {
		return categorySettings.every((setting) => Boolean($settings[setting.key]));
	}

	// Toggle all settings in a category
	async function toggleAllCategorySettings(categorySettings: Array<{ key: SettingsKey }>) {
		const allEnabled = areAllCategorySettingsEnabled(categorySettings);
		const newValue = !allEnabled;

		for (const setting of categorySettings) {
			await updateSetting(setting.key, newValue);
		}
	}

	$effect(() => {
		Promise.all([initializeSettings(), loadCustomApis()]).catch((error) => {
			logger.error('Failed to initialize settings or custom APIs:', error);
		});
	});
</script>

<div
	class="border-(--color-border-subtle) bg-bg-content rounded-lg border shadow-soft p-2
      dark:bg-bg-content-dark
    "
>
	<!-- Preset Selector -->
	<div class="preset-selector-row">
		<span class="preset-selector-label">{$_('settings_label_preset')}</span>
		<div class="preset-selector-controls">
			<select
				class="preset-selector-dropdown"
				onchange={(e) => handlePresetChange(e.currentTarget.value)}
				value={$currentPreset}
			>
				<option value={AGE_PRESETS.MINOR}>{$_('settings_preset_minor')}</option>
				<option value={AGE_PRESETS.ADULT}>{$_('settings_preset_adult')}</option>
				<option disabled value={AGE_PRESETS.CUSTOM}>{$_('settings_preset_custom')}</option>
			</select>
			<HelpIndicator text={$_('settings_help_preset')} />
		</div>
	</div>

	{#each SETTING_CATEGORIES as category (category.titleKey)}
		<fieldset
			class="border-(--color-border-subtle) m-0 mb-2 rounded-sm border p-1.5 px-2 pb-2
                last:mb-0
              "
		>
			<legend
				class="text-text-subtle ml-0.5 px-1 text-2xs font-medium dark:text-text-subtle-dark
					{category.hasToggleAll ? 'flex items-center w-[calc(100%-0.5rem)]' : ''}"
			>
				{$_(category.titleKey)}
				{#if category.hasToggleAll && category.settings.length > 0}
					<span class="legend-line"></span>
					<button
						class="toggle-all-button"
						class:toggle-all-active={areAllCategorySettingsEnabled(category.settings)}
						onclick={() => toggleAllCategorySettings(category.settings)}
						title={areAllCategorySettingsEnabled(category.settings)
							? $_('settings_toggle_all_disable')
							: $_('settings_toggle_all_enable')}
						type="button"
					>
						{areAllCategorySettingsEnabled(category.settings)
							? $_('settings_toggle_all_on')
							: $_('settings_toggle_all_off')}
					</button>
				{/if}
			</legend>
			<div class="settings-category">
				{#each category.settings as setting (setting.key)}
					{#if setting.key === SETTINGS_KEYS.CACHE_DURATION_MINUTES}
						<NumberInput
							helpText={setting.helpTextKey ? $_(setting.helpTextKey) : undefined}
							label={$_(setting.labelKey)}
							max={10}
							min={1}
							onChange={(value: number) => handleSettingChange(setting.key, value)}
							value={Number($settings[setting.key] ?? 1)}
						/>
					{:else if setting.key === SETTINGS_KEYS.LANGUAGE_OVERRIDE}
						<div class="setting-item" data-setting-key={setting.key}>
							<div class="setting-label">
								{$_(setting.labelKey)}
								{#if setting.helpTextKey}
									<HelpIndicator text={$_(setting.helpTextKey)} />
								{/if}
							</div>
							<select
								class="theme-selector"
								onchange={(e) => handleLanguageChange(e.currentTarget.value)}
								value={$settings[setting.key]}
							>
								<option value="auto">{$_('settings_language_auto')}</option>
								{#each availableLocales as locale (locale.code)}
									<option value={locale.code}>{locale.name}</option>
								{/each}
							</select>
						</div>
					{:else if setting.key === SETTINGS_KEYS.THEME}
						<div class="setting-item" data-setting-key={setting.key}>
							<div class="setting-label">
								{$_(setting.labelKey)}
								{#if setting.helpTextKey}
									<HelpIndicator text={$_(setting.helpTextKey)} />
								{/if}
							</div>
							<select
								class="theme-selector"
								onchange={(e) => handleSettingChange(setting.key, e.currentTarget.value)}
								bind:value={$settings[setting.key]}
							>
								<option value="light">{$_('settings_theme_light')}</option>
								<option value="dark">{$_('settings_theme_dark')}</option>
								<option value="auto">{$_('settings_theme_auto')}</option>
							</select>
						</div>
					{:else}
						<div class="setting-item" data-setting-key={setting.key}>
							<div class="setting-label">
								{$_(setting.labelKey)}
								{#if setting.helpTextKey}
									<HelpIndicator text={$_(setting.helpTextKey)} />
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
			</div>
		</fieldset>
	{/each}

	<!-- Experimental Features -->
	<fieldset
		class="border-(--color-border-subtle) m-0 mb-2 rounded-sm border bg-purple-50 p-1.5 px-2 pb-2
                last:mb-0 dark:bg-purple-900/20"
	>
		<legend class="text-text-subtle ml-0.5 px-1 text-2xs font-medium dark:text-text-subtle-dark">
			{$_('settings_category_experimental')}
		</legend>
		<div class="settings-category">
			<!-- Content Blur Master Toggle -->
			<div class="setting-item" data-setting-key={SETTINGS_KEYS.EXPERIMENTAL_BLUR_ENABLED}>
				<div class="setting-label">
					{$_('settings_label_experimental_blur')}
					<HelpIndicator text={$_('settings_help_experimental_blur')} />
				</div>
				<Toggle
					checked={Boolean($settings[SETTINGS_KEYS.EXPERIMENTAL_BLUR_ENABLED] ?? false)}
					onchange={(value: boolean) =>
						handleSettingChange(SETTINGS_KEYS.EXPERIMENTAL_BLUR_ENABLED, value)}
				/>
			</div>

			<!-- Blur Settings -->
			{#if $settings[SETTINGS_KEYS.EXPERIMENTAL_BLUR_ENABLED]}
				<div class="experimental-nested-container">
					<div class="nested-legend">
						<button
							class="toggle-all-button"
							class:toggle-all-active={areAllCategorySettingsEnabled(
								EXPERIMENTAL_BLUR_CATEGORY.settings
							)}
							onclick={() => toggleAllCategorySettings(EXPERIMENTAL_BLUR_CATEGORY.settings)}
							title={areAllCategorySettingsEnabled(EXPERIMENTAL_BLUR_CATEGORY.settings)
								? $_('settings_toggle_all_disable')
								: $_('settings_toggle_all_enable')}
							type="button"
						>
							{areAllCategorySettingsEnabled(EXPERIMENTAL_BLUR_CATEGORY.settings)
								? $_('settings_toggle_all_on')
								: $_('settings_toggle_all_off')}
						</button>
					</div>
					<div class="settings-category">
						{#each EXPERIMENTAL_BLUR_CATEGORY.settings as setting (setting.key)}
							<div class="setting-item" data-setting-key={setting.key}>
								<div class="setting-label">
									{$_(setting.labelKey)}
								</div>
								<Toggle
									checked={Boolean($settings[setting.key] ?? false)}
									onchange={(value: boolean) => handleSettingChange(setting.key, value)}
								/>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Custom API Integration Master Toggle -->
			<div class="setting-item" data-setting-key={SETTINGS_KEYS.EXPERIMENTAL_CUSTOM_APIS_ENABLED}>
				<div class="setting-label">
					{$_('settings_label_experimental_custom_apis')}
					<HelpIndicator text={$_('settings_help_experimental_custom_apis')} />
				</div>
				<Toggle
					checked={Boolean($settings[SETTINGS_KEYS.EXPERIMENTAL_CUSTOM_APIS_ENABLED] ?? false)}
					onchange={(value: boolean) =>
						handleSettingChange(SETTINGS_KEYS.EXPERIMENTAL_CUSTOM_APIS_ENABLED, value)}
				/>
			</div>

			<!-- Custom APIs Settings -->
			{#if $settings[SETTINGS_KEYS.EXPERIMENTAL_CUSTOM_APIS_ENABLED]}
				<div class="experimental-nested-container">
					<div class="settings-category">
						{#each $customApis.filter((api) => !api.isSystem) as api (api.id)}
							<div class="setting-item" data-setting-key="api-integration-{api.id}">
								<div class="setting-label">
									{api.name}
								</div>
								<Toggle
									checked={api.enabled}
									onchange={(value: boolean) => handleApiToggle(api.id, value)}
								/>
							</div>
						{/each}

						<!-- Manage Custom APIs Button -->
						{#if onNavigateToCustomApis}
							<button
								class="manage-custom-apis-button"
								onclick={onNavigateToCustomApis}
								type="button"
							>
								<span class="manage-custom-apis-text">
									{$_('settings_manage_apis_button')}
									<span class="custom-api-count">
										{$_(
											$customApis.filter((api) => !api.isSystem).length === 1
												? 'settings_api_count_singular'
												: 'settings_api_count_plural',
											{
												values: { 0: $customApis.filter((api) => !api.isSystem).length.toString() }
											}
										)}
									</span>
								</span>
								<ChevronRight size={16} />
							</button>
						{/if}
					</div>
				</div>
			{/if}

			<!-- War Zone Master Toggle -->
			<div class="setting-item" data-setting-key={SETTINGS_KEYS.EXPERIMENTAL_WARZONE_ENABLED}>
				<div class="setting-label">
					{$_('settings_label_experimental_warzone')}
					<HelpIndicator text={$_('settings_help_experimental_warzone')} />
				</div>
				<Toggle
					checked={Boolean($settings[SETTINGS_KEYS.EXPERIMENTAL_WARZONE_ENABLED] ?? false)}
					onchange={(value: boolean) =>
						handleSettingChange(SETTINGS_KEYS.EXPERIMENTAL_WARZONE_ENABLED, value)}
				/>
			</div>

			<!-- Developer Mode Master Toggle -->
			<div class="setting-item" data-setting-key={SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED}>
				<div class="setting-label">
					{$_('settings_label_developer_mode')}
					<HelpIndicator text={$_('settings_help_developer_mode')} />
				</div>
				<Toggle
					checked={Boolean($settings[SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED] ?? false)}
					onchange={(value: boolean) =>
						handleSettingChange(SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED, value)}
				/>
			</div>

			<!-- Developer Settings -->
			{#if $settings[SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED]}
				<div class="experimental-nested-container">
					<div class="settings-category">
						{#each EXPERIMENTAL_DEVELOPER_CATEGORY.settings as setting (setting.key)}
							{#if setting.key === SETTINGS_KEYS.CACHE_DURATION_MINUTES}
								<NumberInput
									helpText={setting.helpTextKey ? $_(setting.helpTextKey) : undefined}
									label={$_(setting.labelKey)}
									max={10}
									min={1}
									onChange={(value: number) => handleSettingChange(setting.key, value)}
									value={Number($settings[setting.key] ?? 5)}
								/>
							{:else}
								<div class="setting-item" data-setting-key={setting.key}>
									<div class="setting-label">
										{$_(setting.labelKey)}
										{#if setting.helpTextKey}
											<HelpIndicator text={$_(setting.helpTextKey)} />
										{/if}
									</div>
									<Toggle
										checked={Boolean($settings[setting.key] ?? false)}
										onchange={(value: boolean) => handleSettingChange(setting.key, value)}
									/>
								</div>
							{/if}
						{/each}

						<!-- View Developer Logs Button -->
						{#if onNavigateToDeveloperLogs}
							<button
								class="manage-custom-apis-button"
								onclick={onNavigateToDeveloperLogs}
								type="button"
							>
								<span class="manage-custom-apis-text">
									{$_('settings_view_logs_button')}
									{#if $errorLogs.length > 0}
										<span class="developer-logs-error-badge">{$errorLogs.length}</span>
									{/if}
								</span>
								<ChevronRight size={16} />
							</button>
						{/if}

						<!-- API Key input field -->
						<div class="api-key-container mt-2.5">
							<div class="setting-label mb-1.5 w-full">{$_('settings_api_key_label')}</div>
							<div class="flex items-center gap-1">
								<input
									class="api-key-input"
									oninput={handleApiKeyChange}
									placeholder={$_('settings_api_key_placeholder')}
									type={apiKeyVisible ? 'text' : 'password'}
									value={$settings[SETTINGS_KEYS.API_KEY]}
								/>
								<button
									class="api-key-toggle"
									onclick={toggleApiKeyVisibility}
									title={$_('settings_api_key_toggle_title')}
									type="button"
								>
									<span class="text-xs select-none">
										{apiKeyVisible ? $_('settings_api_key_hide') : $_('settings_api_key_show')}
									</span>
								</button>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Rotector API Documentation Button -->
			{#if onNavigateToRotectorDocs}
				<button class="manage-custom-apis-button" onclick={onNavigateToRotectorDocs} type="button">
					<span class="manage-custom-apis-text">
						{$_('settings_rotector_api_docs_button')}
					</span>
					<ChevronRight size={16} />
				</button>
			{/if}
		</div>
	</fieldset>
</div>

<!-- Content Warning Modal -->
<Modal
	confirmText={$_('settings_modal_confirm_button')}
	onClose={closeMatureWarning}
	onConfirm={confirmMatureContent}
	showCancel={false}
	size="small"
	title={$_('settings_modal_title')}
	bind:isOpen={showMatureWarning}
>
	<p class="mb-3 text-sm leading-relaxed">
		{$_('settings_modal_paragraph1')}
	</p>
	<p class="text-sm leading-relaxed text-color-text-muted">
		{$_('settings_modal_paragraph2')}
	</p>
</Modal>
