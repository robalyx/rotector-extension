<script lang="ts">
	import type { Snippet } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { ChevronDown, ChevronRight, Download } from '@lucide/svelte';
	import HelpIndicator from '../../ui/HelpIndicator.svelte';
	import NumberInput from '../../ui/NumberInput.svelte';
	import Toggle from '../../ui/Toggle.svelte';
	import PresetCard from '@/components/ui/PresetCard.svelte';
	import SignalSection from './SignalSection.svelte';
	import { loadMembershipStatus, membershipStore } from '@/lib/stores/membership';
	import { robloxAuthStore } from '@/lib/stores/roblox-auth';
	import { customApis, loadCustomApis, setCustomApiEnabled } from '@/lib/stores/custom-apis';
	import { getAvailableLocales, setLanguage } from '@/lib/stores/i18n';
	import {
		applyAgePreset,
		currentPreset,
		initializeSettings,
		settings,
		updateSetting
	} from '@/lib/stores/settings';
	import type { SettingsKey } from '@/lib/types/settings';
	import { AGE_PRESETS, SETTING_CATEGORIES, SETTINGS_KEYS } from '@/lib/types/settings';
	import { downloadDebugLogs } from '@/lib/utils/logging/log-export';
	import { logger } from '@/lib/utils/logging/logger';
	import { hasTranslatePermission, requestTranslatePermission } from '@/lib/utils/permissions';
	import { showError, showSuccess, showWarning } from '@/lib/stores/toast';

	const IS_DEV = import.meta.env.USE_DEV_API === 'true';
	const availableLocales = getAvailableLocales();

	interface Props {
		onNavigateToCustomApis: () => void;
		onNavigateToMembership: () => void;
		onNavigateToRobloxAccount: () => void;
		onNavigateToPerformance?: (() => void) | undefined;
	}

	let {
		onNavigateToCustomApis,
		onNavigateToMembership,
		onNavigateToRobloxAccount,
		onNavigateToPerformance
	}: Props = $props();

	let developerExpanded = $state(false);
	let togglingApiId = $state<string | null>(null);

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

	function statusFor(category: (typeof SETTING_CATEGORIES)[number] | undefined): string {
		const total = category?.settings.length ?? 0;
		const enabled = category?.settings.filter((s) => !!$settings[s.key]).length ?? 0;
		if (enabled === 0) return $_('settings_status_none_enabled');
		if (enabled === total) return $_('settings_status_all_enabled');
		return $_('settings_status_enabled_count', { values: { enabled, total } });
	}
	const pagesStatus = $derived(statusFor(pagesCategory));
	const blurStatus = $derived(statusFor(blurCategory));

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

	function handleDownloadLogs() {
		try {
			downloadDebugLogs();
		} catch (error) {
			logger.error('Failed to download debug logs:', error);
			showError($_('settings_download_logs_failed'));
		}
	}

	async function handleLanguageChange(localeCode: string) {
		await setLanguage(localeCode);
		await updateSetting(SETTINGS_KEYS.LANGUAGE_OVERRIDE, localeCode);
	}

	async function handleApiToggle(apiId: string, enabled: boolean) {
		const api = $customApis.find((a) => a.id === apiId);
		if (!api) {
			logger.error('Failed to find API for toggle:', { apiId });
			return;
		}

		togglingApiId = apiId;
		try {
			const result = await setCustomApiEnabled(api, enabled);

			if (result.ok) {
				if (enabled) {
					showSuccess($_('custom_api_mgmt_alert_enabled', { values: { 0: api.name } }));
				}
				return;
			}

			switch (result.reason) {
				case 'invalid_url': {
					showError($_('custom_api_mgmt_alert_invalid_url'));
					break;
				}
				case 'permission_denied': {
					showWarning($_('custom_api_mgmt_alert_permission_denied'));
					break;
				}
				case 'error': {
					showError(
						$_('custom_api_mgmt_alert_toggle_error', {
							values: { 0: result.message ?? $_('custom_api_form_error_unknown') }
						})
					);
					break;
				}
			}
		} finally {
			togglingApiId = null;
		}
	}

	$effect(() => {
		Promise.all([initializeSettings(), loadCustomApis()]).catch((error: unknown) => {
			logger.error('Failed to initialize settings or custom APIs:', error);
		});
		void loadMembershipStatus();
	});

	const membershipState = $derived($membershipStore);
	const membershipStatusLabel = $derived.by(() => {
		switch (membershipState.kind) {
			case 'member': {
				return membershipState.status.tierName;
			}
			case 'not-member': {
				return $_('membership_settings_status_not_member');
			}
			case 'invalid-key': {
				return $_('membership_settings_status_invalid_key');
			}
			default: {
				return '';
			}
		}
	});

	const robloxAuth = $derived($robloxAuthStore);
	const robloxAuthLabel = $derived.by(() => {
		if (robloxAuth.kind !== 'signed-in') return $_('roblox_account_settings_status_signed_out');
		const name =
			robloxAuth.profile?.alias ??
			robloxAuth.profile?.username ??
			robloxAuth.cachedProfile?.username ??
			'';
		return name
			? $_('roblox_account_settings_status_signed_in', { values: { name } })
			: $_('roblox_account_settings_status_signed_in_unknown');
	});
</script>

{#snippet labeledRow(
	setting: { key: SettingsKey; labelKey: string; helpTextKey?: string },
	control: Snippet
)}
	<div class="settings-row" data-setting-key={setting.key}>
		<div class="settings-row-label">
			{$_(setting.labelKey)}
			{#if setting.helpTextKey}
				<HelpIndicator text={$_(setting.helpTextKey)} />
			{/if}
		</div>
		{@render control()}
	</div>
{/snippet}

{#snippet toggleRow(setting: { key: SettingsKey; labelKey: string; helpTextKey?: string })}
	{#snippet control()}
		<Toggle
			checked={!!$settings[setting.key]}
			onchange={(value: boolean) => handleSettingChange(setting.key, value)}
		/>
	{/snippet}
	{@render labeledRow(setting, control)}
{/snippet}

<div class="settings-root">
	<div class="settings-preset-block">
		<h2 class="settings-preset-heading">{$_('settings_who_protecting')}</h2>
		<div class="preset-cards-row">
			<PresetCard
				active={$currentPreset === AGE_PRESETS.MINOR}
				description={$_('settings_preset_minor_description')}
				label={$_('settings_preset_minor')}
				onclick={() => applyAgePreset(AGE_PRESETS.MINOR)}
			/>
			<PresetCard
				active={$currentPreset === AGE_PRESETS.ADULT}
				description={$_('settings_preset_adult_description')}
				label={$_('settings_preset_adult')}
				onclick={() => applyAgePreset(AGE_PRESETS.ADULT)}
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

	<SignalSection title={$_('settings_section_appearance')}>
		{#if contentDisplayCategory}
			{#each contentDisplayCategory.settings as setting (setting.key)}
				{#if setting.key === SETTINGS_KEYS.THEME}
					{#snippet themeControl()}
						<select
							class="settings-select"
							aria-label={$_(setting.labelKey)}
							onchange={(e) => handleSettingChange(setting.key, e.currentTarget.value)}
							bind:value={$settings[setting.key]}
						>
							<option value="light">{$_('settings_theme_light')}</option>
							<option value="dark">{$_('settings_theme_dark')}</option>
							<option value="auto">{$_('settings_theme_auto')}</option>
						</select>
					{/snippet}
					{@render labeledRow(setting, themeControl)}
				{:else if setting.key === SETTINGS_KEYS.LANGUAGE_OVERRIDE}
					{#snippet languageControl()}
						<select
							class="settings-select"
							aria-label={$_(setting.labelKey)}
							onchange={(e) => handleLanguageChange(e.currentTarget.value)}
							value={$settings[setting.key]}
						>
							<option value="auto">{$_('settings_language_auto')}</option>
							{#each availableLocales as locale (locale.code)}
								<option value={locale.code}>{locale.name}</option>
							{/each}
						</select>
					{/snippet}
					{@render labeledRow(setting, languageControl)}
				{:else}
					{@render toggleRow(setting)}
				{/if}
			{/each}
		{/if}
	</SignalSection>

	<div class="popup-divider"></div>

	<SignalSection status={pagesStatus} title={$_('settings_section_pages')}>
		{#if pagesCategory}
			{#each pagesCategory.settings as setting (setting.key)}
				{@render toggleRow(setting)}
			{/each}
		{/if}
	</SignalSection>

	<div class="popup-divider"></div>

	<SignalSection status={blurStatus} title={$_('settings_section_blur')}>
		{#if blurCategory}
			{#each blurCategory.settings as setting (setting.key)}
				{@render toggleRow(setting)}
			{/each}
		{/if}
	</SignalSection>

	<div class="popup-divider"></div>

	<SignalSection title={$_('settings_section_experimental')}>
		{@render toggleRow({
			key: SETTINGS_KEYS.EXPERIMENTAL_CUSTOM_APIS_ENABLED,
			labelKey: 'settings_label_experimental_custom_apis',
			helpTextKey: 'settings_help_experimental_custom_apis'
		})}

		{#if $settings[SETTINGS_KEYS.EXPERIMENTAL_CUSTOM_APIS_ENABLED]}
			<div class="settings-nested">
				{#each userApis as api (api.id)}
					<div class="settings-row" data-setting-key="api-integration-{api.id}">
						<div class="settings-row-label">{api.name}</div>
						<Toggle
							checked={api.enabled}
							loading={togglingApiId === api.id}
							onchange={(value: boolean) => handleApiToggle(api.id, value)}
						/>
					</div>
				{/each}

				<button class="settings-nav-button" onclick={onNavigateToCustomApis} type="button">
					<span class="settings-nav-button-text">
						{$_('settings_manage_apis_button')}
						<span class="settings-nav-button-count">
							{$_(
								userApis.length === 1 ? 'settings_api_count_singular' : 'settings_api_count_plural',
								{
									values: {
										0: userApis.length
									}
								}
							)}
						</span>
					</span>
					<ChevronRight size={14} />
				</button>
			</div>
		{/if}

		{@render toggleRow({
			key: SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED,
			labelKey: 'settings_label_advanced_violations',
			helpTextKey: 'settings_help_advanced_violations'
		})}
	</SignalSection>

	<div class="popup-divider"></div>

	<SignalSection status={membershipStatusLabel} title={$_('membership_settings_section_title')}>
		{#if membershipState.kind === 'member' && membershipState.status.associatedRobloxUserId > 0}
			<div class="membership-settings-assignment">
				{$_('membership_settings_assigned_to', {
					values: { userId: membershipState.status.associatedRobloxUserId }
				})}
			</div>
		{/if}
		<button class="settings-nav-button" onclick={onNavigateToMembership} type="button">
			<span class="settings-nav-button-text">
				{$_('membership_settings_manage_button')}
			</span>
			<ChevronRight size={14} />
		</button>
	</SignalSection>

	<div class="popup-divider"></div>

	<SignalSection status={robloxAuthLabel} title={$_('roblox_account_settings_section_title')}>
		<button class="settings-nav-button" onclick={onNavigateToRobloxAccount} type="button">
			<span class="settings-nav-button-text">
				{$_('roblox_account_settings_manage_button')}
			</span>
			<ChevronRight size={14} />
		</button>
	</SignalSection>

	<div class="popup-divider"></div>

	<section class="popup-section">
		<button
			class="settings-section-collapser"
			class:expanded={developerExpanded}
			aria-expanded={developerExpanded}
			onclick={() => (developerExpanded = !developerExpanded)}
			type="button"
		>
			<h2 class="popup-section-title">{$_('settings_section_developer')}</h2>
			<ChevronDown class="settings-section-chevron" size={14} strokeWidth={2.25} />
		</button>

		{#if developerExpanded}
			<div class="popup-section-body">
				{@render toggleRow({
					key: SETTINGS_KEYS.DEBUG_MODE_ENABLED,
					labelKey: 'settings_label_debug_logging',
					helpTextKey: 'settings_help_debug_logging'
				})}

				<button class="settings-nav-button" onclick={handleDownloadLogs} type="button">
					<span class="settings-nav-button-text">
						{$_('settings_download_logs_button')}
					</span>
					<Download size={14} />
				</button>

				<NumberInput
					helpText={$_('settings_help_cache_duration')}
					label={$_('settings_label_cache_duration')}
					max={10}
					min={1}
					onChange={(value: number) =>
						handleSettingChange(SETTINGS_KEYS.CACHE_DURATION_MINUTES, value)}
					value={$settings[SETTINGS_KEYS.CACHE_DURATION_MINUTES]}
				/>

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
	</section>
</div>
