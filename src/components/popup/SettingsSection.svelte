<script lang="ts">
  import Toggle from '../ui/Toggle.svelte';
  import HelpIndicator from '../ui/HelpIndicator.svelte';
  import Modal from '../ui/Modal.svelte';
  import NumberInput from '../ui/NumberInput.svelte';
  import { settings, updateSetting, initializeSettings } from '../../lib/stores/settings.js';
  import { SETTING_CATEGORIES, DEVELOPER_SETTING_CATEGORY, SETTINGS_KEYS } from '../../lib/types/settings.js';
  import type { SettingsKey } from '../../lib/types/settings.js';

  let isExpanded = $state(false);
  let apiKeyVisible = $state(false);
  let showMatureWarning = $state(false);
  let apiBaseUrlError = $state('');
  let highlightedSetting = $state<string | null>(null);
  
  // Developer mode unlock state
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let holdProgress = $state(0);
  let isHolding = $state(false);
  let showUnlockMessage = $state(false);

  // Toggle settings panel expanded/collapsed state
  function toggleExpanded() {
    isExpanded = !isExpanded;
    updateSetting(SETTINGS_KEYS.SETTINGS_EXPANDED, isExpanded);
  }

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
    const target = event.target as HTMLInputElement;
    await updateSetting(SETTINGS_KEYS.API_KEY, target.value.trim());
  }

  // Handle API base URL changes with validation
  async function handleApiBaseUrlChange(event: Event) {
    const target = event.target as HTMLInputElement;
    let url = target.value.trim();
    
    // Clear error if empty (will use default)
    if (!url) {
      apiBaseUrlError = '';
      await updateSetting(SETTINGS_KEYS.API_BASE_URL, url);
      return;
    }
    
    // URL validation
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      apiBaseUrlError = 'URL must start with http:// or https://';
      return;
    }
    
    try {
      new URL(url);
      apiBaseUrlError = '';
    } catch {
      apiBaseUrlError = 'Invalid URL format';
      return;
    }
    
    // Remove trailing slash
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    
    await updateSetting(SETTINGS_KEYS.API_BASE_URL, url);
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


  // Handle mouse down on header to start developer mode unlock sequence
  function handleHeaderMouseDown() {
    if ($settings[SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED]) {
      return;
    }
    
    isHolding = true;
    
    holdTimer = setTimeout(() => {
      startProgressAnimation();
    }, 500);
  }

  // Handle mouse up to cancel developer mode unlock sequence
  function handleHeaderMouseUp() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    isHolding = false;
    holdProgress = 0;
  }


  // Start animated progress ring for developer mode unlock
  function startProgressAnimation() {
    if (!isHolding) return;
    
    const duration = 2000;
    const startTime = Date.now();
    
    function animate() {
      if (!isHolding) {
        holdProgress = 0;
        return;
      }
      
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      holdProgress = progress;
      
      if (progress >= 1) {
        unlockDeveloperMode();
      } else {
        requestAnimationFrame(animate);
      }
    }
    
    requestAnimationFrame(animate);
  }

  // Unlock developer mode and show success message
  async function unlockDeveloperMode() {
    await updateSetting(SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED, true);
    isHolding = false;
    holdProgress = 0;
    showUnlockMessage = true;
    
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    
    setTimeout(() => {
      showUnlockMessage = false;
    }, 3000);
  }

  // Reset developer mode to locked state
  async function resetDeveloperMode() {
    await updateSetting(SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED, false);
    isHolding = false;
    holdProgress = 0;
    showUnlockMessage = false;
    
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  // Highlight a specific setting temporarily
  export function highlightSetting(settingKey: string) {
    highlightedSetting = settingKey;
    
    setTimeout(() => {
      highlightedSetting = null;
    }, 4000);
  }

  $effect(() => {
    initializeSettings();
    isExpanded = $settings[SETTINGS_KEYS.SETTINGS_EXPANDED];
  });
</script>

<div id="settings-section" class="mb-1.5">
  <button 
    class="settings-header"
    class:expanded={isExpanded}
    class:holding={isHolding}
    onclick={toggleExpanded}
    onmousedown={handleHeaderMouseDown}
    onmouseleave={handleHeaderMouseUp}
    onmouseup={handleHeaderMouseUp}
    type="button"
  >
    <span class="flex-1 text-left">Settings</span>
    {#if isHolding && holdProgress > 0}
      <div class="progress-ring mr-2">
        <svg class="w-4 h-4" viewBox="0 0 16 16">
          <circle
            class="progress-ring-bg"
            cx="8"
            cy="8"
            fill="none"
            opacity="0.3"
            r="6"
            stroke="currentColor"
            stroke-width="2"
          />
          <circle
            class="progress-ring-progress"
            cx="8"
            cy="8"
            fill="none"
            r="6"
            stroke="currentColor"
            stroke-dasharray="37.7"
            stroke-dashoffset={37.7 - (37.7 * holdProgress)}
            stroke-linecap="round"
            stroke-width="2"
            transform="rotate(-90 8 8)"
          />
        </svg>
      </div>
    {/if}
    <span 
      class="w-0 h-0 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent border-t-text-subtle dark:border-t-text-subtle-dark transition-transform duration-300 ease-in-out"
      class:rotate-180={isExpanded}
    ></span>
  </button>
</div>

<!-- Developer mode unlock success message -->
{#if showUnlockMessage}
  <div class="mb-2 p-2 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded text-sm text-green-800 dark:text-green-200">
    🎉 Developer mode unlocked! Advanced settings are now available.
  </div>
{/if}

<div 
  style:box-shadow="0 1px 3px var(--shadow-soft)"
  style:border-color="var(--color-border-subtle)"
  class="overflow-hidden transition-all duration-300 ease-in-out bg-bg-content dark:bg-bg-content-dark border rounded-lg shadow-soft"
  class:border-transparent={!isExpanded}
  class:max-h-0={!isExpanded}
  class:max-h-[1000px]={isExpanded}
  class:opacity-0={!isExpanded}
  class:opacity-100={isExpanded}
  class:p-0={!isExpanded}
  class:p-3={isExpanded}
>
  {#each SETTING_CATEGORIES as category (category.title)}
    <fieldset style:border-color="var(--color-border-subtle)" class="border rounded-sm p-2 px-3 pb-3 m-0 mb-3 last:mb-0">
      <legend class="text-xs font-medium text-text-subtle dark:text-text-subtle-dark px-1 ml-0.5">{category.title}</legend>
      <div class="settings-category">
        {#each category.settings as setting (setting.key)}
          {#if setting.key === SETTINGS_KEYS.CACHE_DURATION_MINUTES}
            <NumberInput
              helpText={setting.helpText}
              label={setting.label}
              max={10}
              min={1}
              onChange={(value) => handleSettingChange(setting.key, value)}
              value={$settings[setting.key] as number}
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
                onchange={(e) => handleSettingChange(setting.key, (e.target as HTMLSelectElement).value)}
                value={$settings[setting.key]}
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
                checked={$settings[setting.key] as boolean}
                onchange={(value) => handleSettingChange(setting.key, value)}
                preventChange={setting.key === SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED && !$settings[setting.key]}
              />
            </div>
          {/if}
        {/each}
      </div>
    </fieldset>
  {/each}
  
  <!-- Developer settings (shown only when unlocked) -->
  {#if $settings[SETTINGS_KEYS.DEVELOPER_MODE_UNLOCKED]}
    <fieldset style:border-color="var(--color-border-subtle)" class="border rounded-sm p-2 px-3 pb-3 m-0 mb-3 last:mb-0 bg-yellow-50 dark:bg-yellow-900/20">
      <legend class="text-xs font-medium text-text-subtle dark:text-text-subtle-dark px-1 ml-0.5">
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
              onChange={(value) => handleSettingChange(setting.key, value)}
              value={$settings[setting.key] as number}
            />
          {:else if setting.key === SETTINGS_KEYS.API_BASE_URL}
            <div class="api-base-url-container mt-2.5">
              <div class="setting-label w-full mb-1.5">
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
                value={$settings[setting.key] as string}
              />
              {#if apiBaseUrlError}
                <p class="text-xs text-red-600 dark:text-red-400 mt-1">{apiBaseUrlError}</p>
              {/if}
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
                checked={$settings[setting.key] as boolean}
                onchange={(value) => handleSettingChange(setting.key, value)}
              />
            </div>
          {/if}
        {/each}
        
        <!-- API Key input field -->
        <div class="api-key-container mt-2.5">
          <div class="setting-label w-full mb-1.5">API Key (Optional)</div>
          <div class="flex gap-1 items-center">
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
              <span class="select-none text-xs">{apiKeyVisible ? 'HIDE' : 'SHOW'}</span>
            </button>
          </div>
        </div>
        
        <!-- Reset developer mode button -->
        <div class="mt-3 pt-3 border-t border-border dark:border-border-dark">
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
  <p class="mb-4 text-sm leading-relaxed"><strong>Advanced violation details may contain sensitive content</strong> that is referenced from user profiles and activities that violated platform policies.</p>
  
  <div class="modal-content-section-info">
    <h4 class="modal-content-heading">What you'll see when enabled:</h4>
    <ul class="modal-content-list">
      <li class="modal-content-list-item-info">Detailed violation messages explaining why a user was flagged</li>
      <li class="modal-content-list-item-info">Evidence snippets containing the policy-violating content found</li>
      <li class="modal-content-list-item-info">Specific examples of violations from user profiles and activities</li>
    </ul>
  </div>
  
  <div class="modal-content-section-warning">
    <h4 class="modal-content-heading">Important Considerations</h4>
    <ul class="modal-content-list">
      <li class="modal-content-list-item-warning">Content may include material that violates platform community standards</li>
      <li class="modal-content-list-item-warning">This information is intended for moderation and safety purposes only</li>
      <li class="modal-content-list-item-warning">If you prefer not to view detailed violation evidence, keep this setting disabled</li>
      <li class="modal-content-list-item-warning">You can disable this feature at any time in the settings</li>
    </ul>
  </div>
  
  <div class="modal-content-section-recommendation">
    <p class="text-sm leading-relaxed m-0"><strong>Recommendation:</strong> Only enable this if you need detailed violation information for moderation purposes and understand that you may see content that violates community guidelines.</p>
  </div>
</Modal> 