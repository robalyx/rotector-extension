<script lang="ts">
  import { shouldShowAdvancedViolationBanner, dismissAdvancedViolationBanner } from '../../lib/stores/advanced-violation-banner.js';
  import { settings, updateSetting } from '../../lib/stores/settings.js';
  import { SETTINGS_KEYS } from '../../lib/types/settings.js';
  import type SettingsSection from './SettingsSection.svelte';

  interface Props {
    settingsSection?: SettingsSection;
  }

  let { settingsSection }: Props = $props();

  let isClosing = $state(false);

  // Handle dismiss button click
  async function handleDismiss() {
    isClosing = true;
    
    // Add a small delay to show the closing animation
    setTimeout(async () => {
      try {
        await dismissAdvancedViolationBanner();
      } catch (error) {
        console.error('Failed to dismiss advanced violation banner:', error);
        isClosing = false;
      }
    }, 200);
  }

  // Handle go to setting button click
  async function handleGoToSetting() {
    try {
      // Expand the settings section if it's not already expanded
      if (!$settings[SETTINGS_KEYS.SETTINGS_EXPANDED]) {
        await updateSetting(SETTINGS_KEYS.SETTINGS_EXPANDED, true);
      }
      
      // Wait for expansion animation then scroll and highlight
      setTimeout(() => {
        const settingsSectionElement = document.getElementById('settings-section');
        if (settingsSectionElement) {
          settingsSectionElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
        
        if (settingsSection && settingsSection.highlightSetting) {
          settingsSection.highlightSetting(SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED);
        }
      }, 150);
    } catch (error) {
      console.error('Failed to navigate to advanced violation setting:', error);
    }
  }
</script>

{#if $shouldShowAdvancedViolationBanner && !isClosing}
  <div class="advanced-violation-banner" class:closing={isClosing}>
    <div class="advanced-violation-banner-content">
      <!-- Header row with badge and dismiss -->
      <div class="advanced-violation-banner-header">
        <!-- Recommended badge -->
        <div class="advanced-violation-banner-badge">
          <span class="advanced-violation-badge-text">RECOMMENDED</span>
        </div>
        
        <!-- Dismiss button -->
        <button 
          class="advanced-violation-banner-dismiss"
          aria-label="Dismiss recommendation banner"
          onclick={handleDismiss}
          title="Dismiss recommendation"
          type="button"
        >
          <svg class="advanced-violation-dismiss-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
      
      <!-- Content -->
      <div class="advanced-violation-banner-body">
        <div class="advanced-violation-banner-title">
          Enhanced Experience Available
        </div>
        <div class="advanced-violation-banner-description">
          Enable "Show Advanced Violation Details" to see detailed violation messages and evidence for better understanding of detected issues.
        </div>
      </div>
      
      <!-- Go to Setting button -->
      <div class="advanced-violation-banner-footer">
        <button 
          class="advanced-violation-banner-enable"
          onclick={handleGoToSetting}
          title="Go to advanced violation details setting"
          type="button"
        >
          Go to Setting
        </button>
      </div>
    </div>
  </div>
{/if}