<script lang="ts">
    import Toggle from "../../ui/Toggle.svelte";
    import HelpIndicator from "../../ui/HelpIndicator.svelte";
    import IntegrationTooltip from "./IntegrationTooltip.svelte";
    import Modal from "../../ui/Modal.svelte";
    import NumberInput from "../../ui/NumberInput.svelte";
    import {
        initializeSettings,
        settings,
        updateSetting,
    } from "@/lib/stores/settings";
    import { statistics } from "@/lib/stores/statistics";
    import type { SettingsKey } from "@/lib/types/settings";
    import {
        DEVELOPER_SETTING_CATEGORY,
        SETTING_CATEGORIES,
        SETTINGS_KEYS,
    } from "@/lib/types/settings";
    import { PartyPopper } from "lucide-svelte";
    import { logger } from "@/lib/utils/logger";

    let apiKeyVisible = $state(false);
    let showMatureWarning = $state(false);
    let apiBaseUrlError = $state("");
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
    async function handleSettingChange(
        key: SettingsKey,
        value: boolean | number | string,
    ) {
        if (
            key === SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED &&
            !$settings[key] &&
            value
        ) {
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

    // Handle API base URL changes with validation
    async function handleApiBaseUrlChange(event: Event) {
        const target = event.currentTarget as HTMLInputElement;
        let url = target.value.trim();

        // Clear error if empty (will use default)
        if (!url) {
            apiBaseUrlError = "";
            await updateSetting(SETTINGS_KEYS.API_BASE_URL, url);
            return;
        }

        // URL validation
        if (!url.startsWith("https://")) {
            apiBaseUrlError = "URL must start with https://";
            return;
        }

        try {
            new URL(url);
            apiBaseUrlError = "";
        } catch {
            apiBaseUrlError = "Invalid URL format";
            return;
        }

        // Remove trailing slash
        if (url.endsWith("/")) {
            url = url.slice(0, -1);
        }

        await updateSetting(SETTINGS_KEYS.API_BASE_URL, url);
    }

    // Confirm and enable mature content setting
    async function confirmMatureContent() {
        await updateSetting(
            SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED,
            true,
        );
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
        initializeSettings().catch((error) => {
            logger.error("Failed to initialize settings:", error);
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
                            onChange={(value: number) =>
                                handleSettingChange(setting.key, value)}
                            value={Number($settings[setting.key] ?? 1)}
                        />
                    {:else if setting.key === SETTINGS_KEYS.THEME}
                        <div
                            class="setting-item"
                            class:setting-highlighted={highlightedSetting ===
                                setting.key}
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
                                onchange={(e) =>
                                    handleSettingChange(
                                        setting.key,
                                        e.currentTarget.value,
                                    )}
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
                            class:setting-highlighted={highlightedSetting ===
                                setting.key}
                            data-setting-key={setting.key}
                        >
                            <div class="setting-label">
                                {setting.label}
                                {#if setting.helpText}
                                    <div class="flex items-center gap-1">
                                        {#if setting.key === SETTINGS_KEYS.BLOXDB_INTEGRATION_ENABLED}
                                            <IntegrationTooltip
                                                integrationType="bloxdb"
                                                statistics={$statistics}
                                            />
                                        {:else}
                                            <HelpIndicator
                                                text={setting.helpText}
                                            />
                                        {/if}
                                        {#if setting.key === SETTINGS_KEYS.ROTECTOR_INTEGRATION_ENABLED}
                                            <a
                                                style:background-color="#5865F2"
                                                style:color="white"
                                                class="
                            inline-flex size-4 items-center justify-center
                            rounded-sm transition-all duration-200
                            hover:scale-110
                          "
                                                aria-label="Join Rotector Discord for support"
                                                href="https://discord.gg/2Cn7kXqqhY"
                                                rel="noopener noreferrer"
                                                target="_blank"
                                                title="Join Rotector Discord for support"
                                            >
                                                <svg
                                                    class="size-2.5"
                                                    viewBox="0 0 24 24"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                >
                                                    <path
                                                        d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
                                                        fill="currentColor"
                                                    />
                                                </svg>
                                            </a>
                                        {:else if setting.key === SETTINGS_KEYS.BLOXDB_INTEGRATION_ENABLED}
                                            <a
                                                style:background-color="#5865F2"
                                                style:color="white"
                                                class="
                            inline-flex size-4 items-center justify-center
                            rounded-sm transition-all duration-200
                            hover:scale-110
                          "
                                                aria-label="Join BloxDB Discord for support"
                                                href="https://discord.gg/43TkrSbncS"
                                                rel="noopener noreferrer"
                                                target="_blank"
                                                title="Join BloxDB Discord for support"
                                            >
                                                <svg
                                                    class="size-2.5"
                                                    viewBox="0 0 24 24"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                >
                                                    <path
                                                        d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.30zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
                                                        fill="currentColor"
                                                    />
                                                </svg>
                                            </a>
                                        {/if}
                                    </div>
                                {:else}
                                    <span></span>
                                {/if}
                            </div>
                            <Toggle
                                checked={Boolean(
                                    $settings[setting.key] ?? false,
                                )}
                                disabled={setting.key ===
                                    SETTINGS_KEYS.ROTECTOR_INTEGRATION_ENABLED}
                                onchange={(value: boolean) =>
                                    handleSettingChange(setting.key, value)}
                                preventChange={setting.key ===
                                    SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED &&
                                    !($settings[setting.key] ?? false)}
                            />
                        </div>
                    {/if}
                {/each}
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
                            onChange={(value: number) =>
                                handleSettingChange(setting.key, value)}
                            value={Number($settings[setting.key] ?? 1)}
                        />
                    {:else if setting.key === SETTINGS_KEYS.API_BASE_URL}
                        <div class="api-base-url-container mt-2.5">
                            <div class="setting-label mb-1.5 w-full">
                                {setting.label}
                                {#if setting.helpText}
                                    <HelpIndicator text={setting.helpText} />
                                {/if}
                            </div>
                            <input
                                class="api-key-input"
                                class:border-red-500={apiBaseUrlError}
                                class:dark:border-red-400={apiBaseUrlError}
                                oninput={handleApiBaseUrlChange}
                                placeholder="https://roscoe.robalyx.com"
                                type="url"
                                value={String($settings[setting.key] ?? "")}
                            />
                            {#if apiBaseUrlError}
                                <p
                                    class="
                  mt-1 text-xs text-red-600
                  dark:text-red-400
                "
                                >
                                    {apiBaseUrlError}
                                </p>
                            {/if}
                        </div>
                    {:else}
                        <div
                            class="setting-item"
                            class:setting-highlighted={highlightedSetting ===
                                setting.key}
                            data-setting-key={setting.key}
                        >
                            <div class="setting-label">
                                {setting.label}
                                {#if setting.helpText}
                                    <HelpIndicator text={setting.helpText} />
                                {/if}
                            </div>
                            <Toggle
                                checked={Boolean(
                                    $settings[setting.key] ?? false,
                                )}
                                onchange={(value: boolean) =>
                                    handleSettingChange(setting.key, value)}
                            />
                        </div>
                    {/if}
                {/each}

                <!-- API Key input field -->
                <div class="api-key-container mt-2.5">
                    <div class="setting-label mb-1.5 w-full">
                        API Key (Optional)
                    </div>
                    <div class="flex items-center gap-1">
                        <input
                            class="api-key-input"
                            oninput={handleApiKeyChange}
                            placeholder="Enter your API key"
                            type={apiKeyVisible ? "text" : "password"}
                            value={$settings[SETTINGS_KEYS.API_KEY]}
                        />
                        <button
                            class="api-key-toggle"
                            onclick={toggleApiKeyVisibility}
                            title="Show/Hide API Key"
                            type="button"
                        >
                            <span class="text-xs select-none"
                                >{apiKeyVisible ? "HIDE" : "SHOW"}</span
                            >
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
                    <button
                        class="developer-reset-button"
                        onclick={resetDeveloperMode}
                        type="button"
                    >
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
        <strong>Advanced violation details may contain sensitive content</strong
        >
        that is referenced from user profiles and activities that violated platform
        policies.
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
                Specific examples of violations from user profiles and
                activities
            </li>
        </ul>
    </div>

    <div class="modal-content-section-warning">
        <h4 class="modal-content-heading">Important Considerations</h4>
        <ul class="modal-content-list">
            <li class="modal-content-list-item-warning">
                Content may include material that violates platform community
                standards
            </li>
            <li class="modal-content-list-item-warning">
                This information is intended for moderation and safety purposes
                only
            </li>
            <li class="modal-content-list-item-warning">
                If you prefer not to view detailed violation evidence, keep this
                setting disabled
            </li>
            <li class="modal-content-list-item-warning">
                You can disable this feature at any time in the settings
            </li>
        </ul>
    </div>

    <div class="modal-content-section-recommendation">
        <p class="m-0 text-sm leading-relaxed">
            <strong>Recommendation:</strong> Only enable this if you need detailed
            violation information for moderation purposes and understand that you
            may see content that violates community guidelines.
        </p>
    </div>
</Modal>
