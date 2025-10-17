<script lang="ts">
    import LoadingSpinner from "../../ui/LoadingSpinner.svelte";
    import { Ban, ShieldHalf } from "lucide-svelte";
    import {
        formatNumber,
        lastUpdatedFormatted,
        loadStatistics,
        refreshStatistics,
        statistics,
        statisticsState,
    } from "@/lib/stores/statistics";
    import { logger } from "@/lib/utils/logger";

    let isRefreshing = $state(false);

    // Handle refresh button click to reload statistics
    async function handleRefresh() {
        if (isRefreshing) return;

        isRefreshing = true;
        try {
            await refreshStatistics();
        } catch (error) {
            logger.error("Failed to refresh statistics:", error);
        } finally {
            isRefreshing = false;
        }
    }

    $effect(() => {
        loadStatistics().catch((error) => {
            logger.error("Failed to load statistics:", error);
        });
    });
</script>

<div class="stat-container">
    <div
        class="
    border-border mb-3 flex items-center justify-between border-b pb-1.5
    dark:border-border-dark
  "
    >
        <h2
            class="
      text-text-heading m-0 flex items-center gap-1.5 text-base font-semibold
      tracking-tight
      dark:text-text-heading-dark
    "
        >
            System Statistics
        </h2>
        <button
            class="refresh-stats-button"
            disabled={isRefreshing}
            onclick={handleRefresh}
            title="Refresh Statistics"
            type="button"
        >
            <span class="inline-block size-4 transition-transform duration-300">
                {#if isRefreshing}
                    <LoadingSpinner size="small" />
                {:else}
                    <svg
                        class="size-4 fill-current"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
                        />
                    </svg>
                {/if}
            </span>
        </button>
    </div>

    {#if $statisticsState === "loading"}
        <div
            class="
      text-text-subtle flex flex-col items-center gap-3 py-8 text-sm
      dark:text-text-subtle-dark
    "
        >
            <LoadingSpinner size="medium" />
            <span>Loading statistics...</span>
        </div>
    {:else if $statisticsState === "error"}
        <div class="py-8 text-center">
            <div class="text-error mb-3 text-sm font-medium">
                Failed to load statistics
            </div>
            <button
                style:background-color="var(--color-primary)"
                class="
            rounded-md px-4 py-2 text-sm font-medium text-white
            btn-focus
            transition-colors duration-200
            hover:bg-(--color-primary-hover)
          "
                onclick={handleRefresh}
                type="button"
            >
                Retry
            </button>
        </div>
    {:else if $statistics}
        <div class="stat-grid">
            <!-- Users -->
            <div class="stat-category">
                <h3 class="stat-category-title">Users</h3>
                <div class="grid grid-cols-2 gap-2">
                    <div class="stat-item">
                        <div class="stat-value">
                            {formatNumber($statistics?.totalFlaggedUsers)}
                        </div>
                        <div class="stat-label">Flagged</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">
                            {formatNumber($statistics?.totalConfirmedUsers)}
                        </div>
                        <div class="stat-label">Confirmed</div>
                    </div>
                </div>
                <div class="mt-3 text-center">
                    <div
                        class="
            text-text-subtle flex items-center justify-center gap-1 text-2xs
            dark:text-text-subtle-dark
          "
                    >
                        <Ban
                            class="
                  size-3
                  text-orange-600
                  dark:text-orange-400
                "
                        />
                        <span class="font-medium"
                            >{formatNumber($statistics?.totalBannedUsers)}</span
                        >
                        other users banned by Roblox
                    </div>
                </div>
            </div>

            <!-- Groups -->
            <div class="stat-category">
                <h3 class="stat-category-title">Groups</h3>
                <div class="grid grid-cols-2 gap-2">
                    <div class="stat-item">
                        <div class="stat-value">
                            {formatNumber($statistics?.totalFlaggedGroups)}
                        </div>
                        <div class="stat-label">Flagged</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">
                            {formatNumber($statistics?.totalConfirmedGroups)}
                        </div>
                        <div class="stat-label">Confirmed</div>
                    </div>
                </div>
                <div class="mt-3 text-center">
                    <div
                        class="
            text-text-subtle flex items-center justify-center gap-1 text-2xs
            dark:text-text-subtle-dark
          "
                    >
                        <ShieldHalf
                            class="
                  size-3
                  text-amber-600
                  dark:text-amber-400
                "
                        />
                        <span class="font-medium"
                            >{formatNumber($statistics?.totalMixedGroups)}</span
                        >
                        groups with mixed content
                    </div>
                </div>
            </div>

            <!-- Community -->
            <div class="col-span-full stat-category">
                <h3 class="stat-category-title">Community</h3>
                <div class="grid grid-cols-2 gap-2">
                    <div class="stat-item">
                        <div class="stat-value">
                            {formatNumber($statistics?.totalVotesCast)}
                        </div>
                        <div class="stat-label">Total Votes Cast</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">
                            {formatNumber($statistics?.totalQueuedUsers)}
                        </div>
                        <div class="stat-label">Queued Users</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="statistics-last-updated">
            Last updated: <span class="last-updated-time"
                >{$lastUpdatedFormatted}</span
            >
        </div>
    {/if}
</div>
