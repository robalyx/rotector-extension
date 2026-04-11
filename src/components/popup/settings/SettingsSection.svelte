<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { ChevronDown, ChevronRight } from '@lucide/svelte';
	import HelpIndicator from '../../ui/HelpIndicator.svelte';
	import NumberInput from '../../ui/NumberInput.svelte';
	import Toggle from '../../ui/Toggle.svelte';
	import PresetCard from './PresetCard.svelte';
	import SignalSection from './SignalSection.svelte';
	import {
		customApis,
		extractApiOrigins,
		loadCustomApis,
		updateCustomApi
	} from '@/lib/stores/custom-apis';
	import { errorLogs } from '@/lib/stores/developer-logs';
	import { getAvailableLocales, setLanguage } from '@/lib/stores/i18n';
	import {
		applyAgePreset,
		currentPreset,
		initializeSettings,
		settings,
		updateSetting
	} from '@/lib/stores/settings';
	import type { SettingsKey } from '@/lib/types/settings';
	import {
		AGE_PRESETS,
		EXPERIMENTAL_DEVELOPER_CATEGORY,
		SETTING_CATEGORIES,
		SETTINGS_KEYS
	} from '@/lib/types/settings';
	import { logger } from '@/lib/utils/logger';
	import {
		hasTranslatePermission,
		requestPermissionsForOrigins,
		requestTranslatePermission
	} from '@/lib/utils/permissions';

	const IS_DEV = import.meta.env.USE_DEV_API === 'true';
	const availableLocales = getAvailableLocales();

	interface Props {
		onNavigateToCustomApis?: () => void;
		onNavigateToDeveloperLogs?: () => void;
		onNavigateToPerformance?: () => void;
	}

	let { onNavigateToCustomApis, onNavigateToDeveloperLogs, onNavigateToPerformance }: Props =
		$props();

	let apiKeyVisible = $state(false);
	let developerExpanded = $state(false);

	const userApis = $derived($customApis.filter((api) => !api.isSystem));

	const contentDisplayCategory = $derived(
		SETTING_CATEGORIES.find((c) => c.titleKey === 'settings_category_content_display')
	);
	const pagesCategory = $derived(
		SETTING_CATEGORIES.find((c) => c.titleKey === 'settings_category_page_settings')
	);
	const blurCategory = $derived(
		SETTING_CATEGORIES.find((c) => c.titleKey === 'settings_category_content_blur')
	);

	const pagesEnabledCount = $derived(
		pagesCategory?.settings.filter((s) => Boolean($settings[s.key])).length ?? 0
	);
	const pagesTotalCount = $derived(pagesCategory?.settings.length ?? 0);
	const blurEnabledCount = $derived(
		blurCategory?.settings.filter((s) => Boolean($settings[s.key])).length ?? 0
	);
	const blurTotalCount = $derived(blurCategory?.settings.length ?? 0);

	function formatEnabledStatus(enabled: number, total: number): string {
		if (enabled === 0) return $_('settings_status_none_enabled');
		if (enabled === total) return $_('settings_status_all_enabled');
		return $_('settings_status_enabled_count', { values: { enabled, total } });
	}

	const pagesStatus = $derived(formatEnabledStatus(pagesEnabledCount, pagesTotalCount));
	const blurStatus = $derived(formatEnabledStatus(blurEnabledCount, blurTotalCount));

	// Enabling translate-violations requires host permission
	async function handleSettingChange(key: SettingsKey, value: boolean | number | string) {
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
				// Look up the API configuration to get the URLs
				const api = $customApis.find((a) => a.id === apiId);
				if (!api) {
					logger.error('Failed to find API for permission request:', { apiId });
					return;
				}

				// Extract origins from the API's URLs
				const origins = extractApiOrigins(api);
				if (origins.length === 0) {
					logger.error('Failed to extract origins from API URLs:', { apiId });
					return;
				}

				// Request permissions for API origins
				await requestPermissionsForOrigins(origins);
			} else {
				logger.error('Failed to toggle custom API:', error);
			}
		}
	}

	// Toggle API key input field visibility between text and password
	function toggleApiKeyVisibility() {
		apiKeyVisible = !apiKeyVisible;
	}

	function toggleDeveloperSection() {
		developerExpanded = !developerExpanded;
	}

	$effect(() => {
		Promise.all([initializeSettings(), loadCustomApis()]).catch((error) => {
			logger.error('Failed to initialize settings or custom APIs:', error);
		});
	});
</script>

<div class="settings-root">
	<!-- Conversational preset opener -->
	<div class="settings-preset-block">
		<h2 class="settings-preset-heading">{$_('settings_who_protecting')}</h2>
		<div class="preset-cards-row">
			<PresetCard
				active={$currentPreset === AGE_PRESETS.MINOR}
				description={$_('settings_preset_minor_description')}
				label={$_('settings_preset_minor')}
				onclick={() => handlePresetChange(AGE_PRESETS.MINOR)}
			/>
			<PresetCard
				active={$currentPreset === AGE_PRESETS.ADULT}
				description={$_('settings_preset_adult_description')}
				label={$_('settings_preset_adult')}
				onclick={() => handlePresetChange(AGE_PRESETS.ADULT)}
			/>
			<PresetCard
				active={$currentPreset === AGE_PRESETS.CUSTOM}
				description={$_('settings_preset_custom_description')}
				disabled
				label={$_('settings_preset_custom')}
			/>
		</div>
	</div>

	<div class="popup-divider"></div>

	<!-- Appearance -->
	<SignalSection title={$_('settings_section_appearance')}>
		{#if contentDisplayCategory}
			{#each contentDisplayCategory.settings as setting (setting.key)}
				{#if setting.key === SETTINGS_KEYS.THEME}
					<div class="settings-row" data-setting-key={setting.key}>
						<div class="settings-row-label">
							{$_(setting.labelKey)}
							{#if setting.helpTextKey}
								<HelpIndicator text={$_(setting.helpTextKey)} />
							{/if}
						</div>
						<select
							class="settings-select"
							onchange={(e) => handleSettingChange(setting.key, e.currentTarget.value)}
							bind:value={$settings[setting.key]}
						>
							<option value="light">{$_('settings_theme_light')}</option>
							<option value="dark">{$_('settings_theme_dark')}</option>
							<option value="auto">{$_('settings_theme_auto')}</option>
						</select>
					</div>
				{:else if setting.key === SETTINGS_KEYS.LANGUAGE_OVERRIDE}
					<div class="settings-row" data-setting-key={setting.key}>
						<div class="settings-row-label">
							{$_(setting.labelKey)}
							{#if setting.helpTextKey}
								<HelpIndicator text={$_(setting.helpTextKey)} />
							{/if}
						</div>
						<select
							class="settings-select"
							onchange={(e) => handleLanguageChange(e.currentTarget.value)}
							value={$settings[setting.key]}
						>
							<option value="auto">{$_('settings_language_auto')}</option>
							{#each availableLocales as locale (locale.code)}
								<option value={locale.code}>{locale.name}</option>
							{/each}
						</select>
					</div>
				{:else}
					<div class="settings-row" data-setting-key={setting.key}>
						<div class="settings-row-label">
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
		{/if}
	</SignalSection>

	<div class="popup-divider"></div>

	<!-- Pages -->
	<SignalSection status={pagesStatus} title={$_('settings_section_pages')}>
		{#if pagesCategory}
			{#each pagesCategory.settings as setting (setting.key)}
				<div class="settings-row" data-setting-key={setting.key}>
					<div class="settings-row-label">
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
			{/each}
		{/if}
	</SignalSection>

	<div class="popup-divider"></div>

	<!-- Blur -->
	<SignalSection status={blurStatus} title={$_('settings_section_blur')}>
		{#if blurCategory}
			{#each blurCategory.settings as setting (setting.key)}
				<div class="settings-row" data-setting-key={setting.key}>
					<div class="settings-row-label">
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
			{/each}
		{/if}
	</SignalSection>

	<div class="popup-divider"></div>

	<!-- Experimental -->
	<SignalSection title={$_('settings_section_experimental')}>
		<div class="settings-row" data-setting-key={SETTINGS_KEYS.EXPERIMENTAL_CUSTOM_APIS_ENABLED}>
			<div class="settings-row-label">
				{$_('settings_label_experimental_custom_apis')}
				<HelpIndicator text={$_('settings_help_experimental_custom_apis')} />
			</div>
			<Toggle
				checked={Boolean($settings[SETTINGS_KEYS.EXPERIMENTAL_CUSTOM_APIS_ENABLED] ?? false)}
				onchange={(value: boolean) =>
					handleSettingChange(SETTINGS_KEYS.EXPERIMENTAL_CUSTOM_APIS_ENABLED, value)}
			/>
		</div>

		{#if $settings[SETTINGS_KEYS.EXPERIMENTAL_CUSTOM_APIS_ENABLED]}
			<div class="settings-nested">
				{#each userApis as api (api.id)}
					<div class="settings-row" data-setting-key="api-integration-{api.id}">
						<div class="settings-row-label">{api.name}</div>
						<Toggle
							checked={api.enabled}
							onchange={(value: boolean) => handleApiToggle(api.id, value)}
						/>
					</div>
				{/each}

				{#if onNavigateToCustomApis}
					<button class="settings-nav-button" onclick={onNavigateToCustomApis} type="button">
						<span class="settings-nav-button-text">
							{$_('settings_manage_apis_button')}
							<span class="settings-nav-button-count">
								{$_(
									userApis.length === 1
										? 'settings_api_count_singular'
										: 'settings_api_count_plural',
									{
										values: {
											0: userApis.length.toString()
										}
									}
								)}
							</span>
						</span>
						<ChevronRight size={14} />
					</button>
				{/if}
			</div>
		{/if}

		<div class="settings-row" data-setting-key={SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED}>
			<div class="settings-row-label">
				{$_('settings_label_advanced_violations')}
				<HelpIndicator text={$_('settings_help_advanced_violations')} />
			</div>
			<Toggle
				checked={Boolean($settings[SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED] ?? false)}
				onchange={(value: boolean) =>
					handleSettingChange(SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED, value)}
			/>
		</div>
	</SignalSection>

	<div class="popup-divider"></div>

	<!-- Developer -->
	<section class="popup-section">
		<button
			class="settings-section-collapser"
			class:expanded={developerExpanded}
			aria-expanded={developerExpanded}
			onclick={toggleDeveloperSection}
			type="button"
		>
			<h2 class="popup-section-title">{$_('settings_section_developer')}</h2>
			<ChevronDown class="settings-section-chevron" size={14} strokeWidth={2.25} />
		</button>

		{#if developerExpanded}
			<div class="popup-section-body">
				<div class="settings-row" data-setting-key={SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED}>
					<div class="settings-row-label">
						{$_('settings_label_developer_mode')}
						<HelpIndicator text={$_('settings_help_developer_mode')} />
					</div>
					<Toggle
						checked={Boolean($settings[SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED] ?? false)}
						onchange={(value: boolean) =>
							handleSettingChange(SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED, value)}
					/>
				</div>

				{#if $settings[SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED]}
					<div class="settings-nested">
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
								<div class="settings-row" data-setting-key={setting.key}>
									<div class="settings-row-label">
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

						{#if onNavigateToDeveloperLogs}
							<button class="settings-nav-button" onclick={onNavigateToDeveloperLogs} type="button">
								<span class="settings-nav-button-text">
									{$_('settings_view_logs_button')}
									{#if $errorLogs.length > 0}
										<span class="settings-nav-button-count">{$errorLogs.length}</span>
									{/if}
								</span>
								<ChevronRight size={14} />
							</button>
						{/if}

						{#if IS_DEV && onNavigateToPerformance}
							<button class="settings-nav-button" onclick={onNavigateToPerformance} type="button">
								<span class="settings-nav-button-text">
									{$_('settings_view_performance_button')}
								</span>
								<ChevronRight size={14} />
							</button>
						{/if}
					</div>
				{/if}

				<div class="settings-api-key">
					<div class="settings-row-label">
						{$_('settings_api_key_label')}
						<HelpIndicator text={$_('settings_api_key_help')} />
					</div>
					<div class="settings-api-key-input-row">
						<input
							class="settings-api-key-input"
							oninput={handleApiKeyChange}
							placeholder={$_('settings_api_key_placeholder')}
							type={apiKeyVisible ? 'text' : 'password'}
							value={$settings[SETTINGS_KEYS.API_KEY]}
						/>
						<button
							class="settings-api-key-toggle"
							onclick={toggleApiKeyVisibility}
							title={$_('settings_api_key_toggle_title')}
							type="button"
						>
							{apiKeyVisible ? $_('settings_api_key_hide') : $_('settings_api_key_show')}
						</button>
					</div>
				</div>
			</div>
		{/if}
	</section>
</div>
