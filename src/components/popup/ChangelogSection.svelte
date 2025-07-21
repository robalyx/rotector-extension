<script lang="ts">
  import ChangelogContent from './ChangelogContent.svelte';
  import { changelogs, changelogSectionExpanded, toggleChangelogSection, changelogTechnicalMode, toggleChangelogTechnicalMode } from '../../lib/stores/changelog.js';

  // Handle toggle of the changelog section
  async function handleToggle() {
    try {
      await toggleChangelogSection();
    } catch (error) {
      console.error('Failed to toggle changelog section:', error);
    }
  }

  // Handle toggle of the technical mode
  async function handleTechnicalModeToggle() {
    try {
      await toggleChangelogTechnicalMode();
    } catch (error) {
      console.error('Failed to toggle changelog technical mode:', error);
    }
  }
</script>

<div class="mb-1.5">
  <div class="flex items-center gap-2">
    <button 
      class="changelog-section-header flex-1"
      class:expanded={$changelogSectionExpanded}
      aria-controls="changelog-section-content"
      aria-expanded={$changelogSectionExpanded}
      onclick={handleToggle}
      type="button"
    >
      <span class="flex-1 text-left">Changelog</span>
      <span 
        class="w-0 h-0 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent border-t-text-subtle dark:border-t-text-subtle-dark transition-transform duration-300 ease-in-out"
        class:rotate-180={$changelogSectionExpanded}
      ></span>
    </button>
    
    <!-- Technical mode toggle button -->
    <button 
      class="changelog-technical-toggle"
      class:active={$changelogTechnicalMode}
      aria-label={$changelogTechnicalMode ? 'Switch to user-friendly descriptions' : 'Switch to technical descriptions'}
      onclick={handleTechnicalModeToggle}
      title={$changelogTechnicalMode ? 'Show simplified descriptions' : 'Show technical details'}
      type="button"
    >
      {$changelogTechnicalMode ? '📝' : '🔧'}
    </button>
  </div>
</div>

<div 
  id="changelog-section-content"
  style:box-shadow="0 1px 3px var(--shadow-soft)"
  style:border-color="var(--color-border-subtle)"
  class="overflow-hidden transition-all duration-300 ease-in-out bg-bg-content dark:bg-bg-content-dark border rounded-lg shadow-soft"
  class:border-transparent={!$changelogSectionExpanded}
  class:max-h-0={!$changelogSectionExpanded}
  class:max-h-[500px]={$changelogSectionExpanded}
  class:opacity-0={!$changelogSectionExpanded}
  class:opacity-100={$changelogSectionExpanded}
  class:p-0={!$changelogSectionExpanded}
  class:p-3={$changelogSectionExpanded}
>
  {#if $changelogSectionExpanded && $changelogs.length > 0}
    <div class="changelog-section-content overflow-y-auto scrollbar-styled max-h-[440px]">
      {#each $changelogs as changelog, index (changelog.id)}
        <div class="changelog-section-item" class:first={index === 0}>
          <ChangelogContent {changelog} compact={false} technicalMode={$changelogTechnicalMode} />
        </div>
        {#if index < $changelogs.length - 1}
          <div class="changelog-section-divider"></div>
        {/if}
      {/each}
    </div>
  {:else if $changelogSectionExpanded}
    <div class="changelog-section-empty">
      <p class="text-center text-text-subtle dark:text-text-subtle-dark">No changelog entries available.</p>
    </div>
  {/if}
</div>