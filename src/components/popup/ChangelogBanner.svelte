<script lang="ts">
  import ChangelogContent from './ChangelogContent.svelte';
  import { shouldShowChangelogBanner, latestChangelog, dismissChangelogBanner, toggleChangelogSection, changelogSectionExpanded, changelogTechnicalMode } from '../../lib/stores/changelog.js';

  let isClosing = $state(false);

  // Handle dismiss button click
  async function handleDismiss() {
    isClosing = true;
    
    // Add a small delay to show the closing animation
    setTimeout(async () => {
      try {
        await dismissChangelogBanner();
      } catch (error) {
        console.error('Failed to dismiss changelog banner:', error);
        isClosing = false;
      }
    }, 200);
  }

  // Handle view details button click
  async function handleViewDetails() {
    try {
      // Expand the changelog section if it's not already expanded
      if (!$changelogSectionExpanded) {
        await toggleChangelogSection();
      }
      
      // Scroll to the changelog section
      setTimeout(() => {
        const changelogSection = document.getElementById('changelog-section-content');
        if (changelogSection) {
          changelogSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 100); // Small delay to allow expansion animation
    } catch (error) {
      console.error('Failed to navigate to changelog section:', error);
    }
  }
</script>

{#if $shouldShowChangelogBanner && $latestChangelog && !isClosing}
  <div class="changelog-banner" class:closing={isClosing}>
    <div class="changelog-banner-content">
      <!-- Header row with badge and dismiss -->
      <div class="changelog-banner-header">
        <!-- New badge -->
        <div class="changelog-banner-badge">
          <span class="changelog-badge-text">NEW</span>
        </div>
        
        <!-- Dismiss button -->
        <button 
          class="changelog-banner-dismiss"
          aria-label="Dismiss changelog banner"
          onclick={handleDismiss}
          title="Dismiss changelog"
          type="button"
        >
          <svg class="changelog-dismiss-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
      
      <!-- Content -->
      <div class="changelog-banner-body">
        <ChangelogContent changelog={$latestChangelog} compact={true} technicalMode={$changelogTechnicalMode} />
      </div>
      
      <!-- View Details button -->
      <div class="changelog-banner-footer">
        <button 
          class="changelog-banner-view-details"
          onclick={handleViewDetails}
          title="View full changelog details"
          type="button"
        >
          View Details
        </button>
      </div>
    </div>
  </div>
{/if}