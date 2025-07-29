<script lang="ts">
  import StatisticsSection from '../../components/popup/StatisticsSection.svelte';
  import SettingsSection from '../../components/popup/SettingsSection.svelte';
  import ChangelogBanner from '../../components/popup/ChangelogBanner.svelte';
  import AdvancedViolationBanner from '../../components/popup/AdvancedViolationBanner.svelte';
  import ChangelogSection from '../../components/popup/ChangelogSection.svelte';
  import FooterSection from '../../components/popup/FooterSection.svelte';

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
  <FooterSection />
</div>
