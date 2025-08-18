<script lang="ts">
    import LoadingSpinner from '../ui/LoadingSpinner.svelte';
    import {
        formatNumber,
        lastUpdatedFormatted,
        loadStatistics,
        refreshStatistics,
        statistics,
        statisticsState
    } from '@/lib/stores/statistics';
    import {updateSetting} from '@/lib/stores/settings';
    import {SETTINGS_KEYS} from '@/lib/types/settings';

    // Props
    let {settingsSection}: { settingsSection?: { highlightSetting: (key: string) => void } } = $props();

    let isRefreshing = $state(false);

    // Handle refresh button click to reload statistics
    async function handleRefresh() {
        if (isRefreshing) return;

        isRefreshing = true;
        try {
            await refreshStatistics();
        } catch (error) {
            console.error('Failed to refresh statistics:', error);
        } finally {
            isRefreshing = false;
        }
    }

    // Handle BloxDB card click to navigate to BloxDB setting
    function handleBloxDBCardClick() {
        if (settingsSection?.highlightSetting) {
            // Expand the settings section if it's collapsed
            updateSetting(SETTINGS_KEYS.SETTINGS_EXPANDED, true);

            // Highlight the BloxDB integration setting
            setTimeout(() => {
                settingsSection.highlightSetting(SETTINGS_KEYS.BLOXDB_INTEGRATION_ENABLED);

                // Scroll to the setting
                const settingElement = document.querySelector(`[data-setting-key="${SETTINGS_KEYS.BLOXDB_INTEGRATION_ENABLED}"]`);
                if (settingElement) {
                    settingElement.scrollIntoView({behavior: 'smooth', block: 'center'});
                }
            }, 300);
        }
    }

    // Handle keyboard events for accessibility
    function handleBloxDBCardKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleBloxDBCardClick();
        }
    }

    $effect(() => {
        loadStatistics();
    });
</script>

<div class="stat-container">
  <div class="flex items-center justify-between mb-3 pb-1.5 border-b border-border dark:border-border-dark">
    <h2 class="m-0 text-base font-semibold text-text-heading dark:text-text-heading-dark flex items-center gap-1.5 tracking-tight">
      System Statistics
    </h2>
    <button
        class="refresh-stats-button"
        class:spin-smooth={isRefreshing}
        disabled={isRefreshing}
        onclick={handleRefresh}
        title="Refresh Statistics"
        type="button"
    >
      <span class="w-4 h-4 transition-transform duration-300 inline-block">
        {#if isRefreshing}
          <LoadingSpinner size="small"/>
        {:else}
          <svg
              class="w-4 h-4 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
          >
            <path
                d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
        {/if}
      </span>
    </button>
  </div>

  {#if $statisticsState === 'loading'}
    <div class="flex flex-col items-center gap-3 py-8 text-text-subtle dark:text-text-subtle-dark text-sm">
      <LoadingSpinner size="medium"/>
      <span>Loading statistics...</span>
    </div>
  {:else if $statisticsState === 'error'}
    <div class="text-center py-8">
      <div class="text-error text-sm font-medium mb-3">Failed to load statistics</div>
      <button
          class="btn-focus px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm font-medium"
          onclick={handleRefresh}
          type="button"
      >
        Retry
      </button>
    </div>
  {:else if $statistics}
    <div class="stat-grid">
      <!-- Rotector System -->
      <div class="stat-category">
        <h3 class="stat-category-title">Rotector System</h3>
        <div class="grid grid-cols-2 gap-2">
          <div class="stat-item">
            <div class="stat-value">{formatNumber($statistics?.totalFlaggedUsers)}</div>
            <div class="stat-label">Total Flagged</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{formatNumber($statistics?.totalConfirmedUsers)}</div>
            <div class="stat-label">Confirmed</div>
          </div>
        </div>
        <div class="mt-3 text-center">
          <div class="text-2xs text-text-subtle dark:text-text-subtle-dark flex items-center justify-center gap-1">
            <span class="text-orange-600 dark:text-orange-400">🚫</span>
            <span class="font-medium">{formatNumber($statistics?.totalBannedUsers)}</span>
            other users banned by Roblox
          </div>
        </div>
      </div>

      <!-- Integrated Systems -->
      <div class="stat-category col-span-full">
        <h3 class="stat-category-title">Integrated Systems</h3>
        <div class="flex justify-center">
          <div
              style:max-width="200px"
              style:width="100%"
              class="stat-item cursor-pointer hover:shadow-lg transition-all duration-200"
              onclick={handleBloxDBCardClick}
              onkeydown={handleBloxDBCardKeydown}
              role="button"
              tabindex="0"
              title="Click to view BloxDB integration settings"
          >
            <div class="stat-value">{formatNumber($statistics?.totalBloxdbUniqueUsers)}</div>
            <div class="stat-label">BloxDB Unique Users</div>
            <div
                style:border-color="var(--color-border-subtle)"
                style:color="var(--color-text-subtle)"
                class="mt-2 -mx-2 px-2 pt-2 border-t text-2xs"
            >
              {formatNumber($statistics?.totalBloxdbExistingUsers)} existing users
            </div>
          </div>
        </div>
      </div>

      <!-- Queue System Flow -->
      <div class="stat-category">
        <h3 class="stat-category-title">Queue System</h3>
        <div class="queue-flow-container">
          <!-- Input -->
          <div class="queue-stage">
            <div class="stage-label">Input</div>
            <div class="stat-item queue-pending">
              <div class="stat-value">{formatNumber($statistics?.pendingQueuedUsers)}</div>
              <div class="stat-label">Pending</div>
            </div>
          </div>

          <!-- Arrow -->
          <div class="queue-arrow">
            <svg
                class="w-full h-full fill-current"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
            </svg>
          </div>

          <!-- Output Grid -->
          <div class="queue-stage">
            <div class="stage-label">Output</div>
            <div class="queue-output-grid">
              <div class="stat-item queue-flagged">
                <div class="stat-value">{formatNumber($statistics?.queuedUsersFlagged)}</div>
                <div class="stat-label">Flagged</div>
              </div>
              <div class="stat-item queue-safe">
                <div class="stat-value">{formatNumber($statistics?.queuedUsersNotFlagged)}</div>
                <div class="stat-label">Safe</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Community -->
      <div class="stat-category col-span-full">
        <h3 class="stat-category-title">Community</h3>
        <div class="flex justify-center">
          <div
              style:max-width="200px"
              style:width="100%"
              class="stat-item"
          >
            <div class="stat-value">{formatNumber($statistics?.totalVotesCast)}</div>
            <div class="stat-label">Total Votes Cast</div>
          </div>
        </div>
      </div>

    </div>

    <div class="statistics-last-updated">
      Last updated: <span class="last-updated-time">{$lastUpdatedFormatted}</span>
    </div>
  {/if}
</div> 