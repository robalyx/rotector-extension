<script lang="ts">
    import StatisticsSection from '../../components/popup/StatisticsSection.svelte';
    import SettingsSection from '../../components/popup/SettingsSection.svelte';
    import ChangelogBanner from '../../components/popup/ChangelogBanner.svelte';
    import AdvancedViolationBanner from '../../components/popup/AdvancedViolationBanner.svelte';
    import ChangelogSection from '../../components/popup/ChangelogSection.svelte';
    import FinancialSection from '../../components/popup/FinancialSection.svelte';
    import FooterSection from '../../components/popup/FooterSection.svelte';
    import {initializeSettings} from '@/lib/stores/settings';
    import {themeManager} from '@/lib/utils/theme';
    import type {SettingsSectionInstance} from '@/lib/types/components';

    let settingsSection = $state<SettingsSectionInstance>();

    $effect(() => {
        initializeSettings().catch(error => {
            console.error('Failed to initialize settings:', error);
        });
        themeManager.initializePopupThemeSync().catch(error => {
            console.error('Failed to initialize popup theme sync:', error);
        });
    });

    const theme = themeManager.effectiveTheme;
    const logoSrc = $derived($theme === 'dark' ? '/assets/rotector-logo-dark.png' : '/assets/rotector-logo-light.png');
</script>

<div class="
  app flex min-h-[400px] scrollbar-styled w-[350px] flex-col gap-3 p-3
">
  <!-- Header Section -->
  <div class="pb-2 text-center">
    <div class="mb-2 flex justify-center">
      <img
          class="h-20 w-auto max-w-[260px] object-contain"
          alt="Rotector"
          src={logoSrc}
      />
    </div>
    <p class="
      text-text-subtle m-0 text-xs
      dark:text-text-subtle-dark
    ">
      Real-time safety indicators that warn you about inappropriate Roblox users before you interact with them.
    </p>
  </div>

  <!-- Changelog Banner -->
  <ChangelogBanner/>

  <!-- Advanced Violation Banner -->
  <AdvancedViolationBanner {settingsSection}/>

  <!-- Statistics Section -->
  <StatisticsSection {settingsSection}/>

  <!-- Settings Section -->
  <SettingsSection bind:this={settingsSection}/>

  <!-- Changelog Section -->
  <ChangelogSection/>

  <!-- Financial Section -->
  <FinancialSection/>

  <!-- Footer Section -->
  <FooterSection/>
</div>
