<script lang="ts">
  import StatisticsSection from '../../components/popup/StatisticsSection.svelte';
  import SettingsSection from '../../components/popup/SettingsSection.svelte';
  import ChangelogBanner from '../../components/popup/ChangelogBanner.svelte';
  import AdvancedViolationBanner from '../../components/popup/AdvancedViolationBanner.svelte';
  import ChangelogSection from '../../components/popup/ChangelogSection.svelte';

  let settingsSection = $state<SettingsSection>();
  import { initializeSettings } from '../../lib/stores/settings.js';
  import { themeManager } from '../../lib/utils/theme.js';

  $effect(() => {
    initializeSettings();
    themeManager.initializePopupThemeSync();
  });

  const theme = themeManager.effectiveTheme;
  const logoSrc = $derived($theme === 'dark' ? '/assets/rotector-logo-dark.png' : '/assets/rotector-logo-light.png');
</script>

<div class="flex flex-col gap-3 p-3 w-[350px] min-h-[400px] scrollbar-styled">
  <!-- Header Section -->
  <div class="text-center pb-2">
    <div class="flex justify-center mb-2">
      <img 
        class="h-20 w-auto max-w-[260px] object-contain" 
        alt="Rotector" 
        src={logoSrc}
      />
    </div>
    <p class="m-0 text-text-subtle dark:text-text-subtle-dark text-xs">
      Uses AI and smart algorithms to identify inappropriate Roblox accounts, helping create safer online communities.
    </p>
  </div>

  <!-- Changelog Banner -->
  <ChangelogBanner />

  <!-- Advanced Violation Banner -->
  <AdvancedViolationBanner {settingsSection} />

  <!-- Statistics Section -->
  <StatisticsSection />

  <!-- Settings Section -->
  <SettingsSection bind:this={settingsSection} />

  <!-- Changelog Section -->
  <ChangelogSection />

  <!-- Footer Section -->
  <div class="flex flex-col gap-2 items-center mt-auto pt-3 text-xs">
    <!-- Social Media / Community Links -->
    <div class="flex justify-center gap-4">
      <a class="social-link" href="https://discord.gg/2Cn7kXqqhY" target="_blank">
        <svg class="social-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
        Discord
      </a>
      <a class="social-link" href="https://github.com/robalyx" target="_blank">
        <svg class="social-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        GitHub
      </a>
    </div>

    <!-- Help Link -->
    <div class="mt-1">
      <a class="help-link" href="https://rotector.com" target="_blank">
        <svg class="help-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
        </svg>
        Help & About
      </a>
    </div>

    <!-- Legal Links -->
    <div class="flex items-center gap-2 mt-1">
      <a class="legal-link" href="https://rotector.com/privacy" target="_blank">Privacy Policy</a>
      <span class="legal-divider">|</span>
      <a class="legal-link" href="https://rotector.com/terms" target="_blank">Terms of Service</a>
    </div>

    <!-- Creator Credit -->
    <p class="m-0 mt-1 text-text-subtle dark:text-text-subtle-dark text-2xs">Made by jaxron</p>
  </div>
</div>
