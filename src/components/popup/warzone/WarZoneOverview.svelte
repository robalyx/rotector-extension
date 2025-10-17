<script lang="ts">
    import { onMount } from "svelte";
    import type { WarMapState } from "../../../lib/types/api";
    import { apiClient } from "../../../lib/services/api-client";
    import LoadingSpinner from "../../ui/LoadingSpinner.svelte";
    import MajorOrderCard from "./MajorOrderCard.svelte";
    import HexagonalZoneMap from "./HexagonalZoneMap.svelte";
    import GlobalHistoryChart from "./GlobalHistoryChart.svelte";
    import TargetCard from "./TargetCard.svelte";

    interface Props {
        onZoneSelect: (zoneId: number) => void;
    }

    let { onZoneSelect }: Props = $props();

    let warMap = $state<WarMapState | null>(null);
    let isLoading = $state(true);
    let error = $state<string | null>(null);
    let isFindingUser = $state(false);
    let findUserError = $state<string | null>(null);

    onMount(async () => {
        await loadWarMap();
    });

    async function loadWarMap() {
        isLoading = true;
        error = null;

        try {
            warMap = await apiClient.getWarMap();
        } catch (err) {
            error =
                err instanceof Error ? err.message : "Failed to load war map";
        } finally {
            isLoading = false;
        }
    }

    async function handleFindReportableUser() {
        isFindingUser = true;
        findUserError = null;

        try {
            const result = await apiClient.getReportableUser();

            // Open Roblox profile in new tab
            const profileUrl = `https://www.roblox.com/users/${result.userId}/profile`;
            await browser.tabs.create({ url: profileUrl });
        } catch (err) {
            const error = err as Error & { status?: number };

            if (error.status === 404) {
                findUserError =
                    "No reportable users available. Check back later!";
            } else if (error.status === 403) {
                findUserError =
                    "Authentication expired. Please logout and login again.";
            } else {
                findUserError =
                    error.message ||
                    "Failed to find reportable user. Please try again.";
            }
        } finally {
            isFindingUser = false;
        }
    }
</script>

{#if isLoading}
    <div class="war-zone-loading">
        <LoadingSpinner />
        <p class="war-zone-loading-text">Loading war map...</p>
    </div>
{:else if error}
    <div class="war-zone-error-container">
        <p class="error-message">{error}</p>
        <button class="retry-button" onclick={loadWarMap} type="button">
            Retry
        </button>
    </div>
{:else if warMap}
    <div class="war-zone-overview">
        <!-- Zones Section -->
        <div class="zones-section">
            <h4 class="section-title">War Zones</h4>
            <HexagonalZoneMap {onZoneSelect} zones={warMap.zones} />
        </div>

        <!-- Find Reportable User Section -->
        <div class="find-user-section">
            <button
                class="find-user-button"
                disabled={isFindingUser}
                onclick={handleFindReportableUser}
                type="button"
            >
                {#if isFindingUser}
                    <LoadingSpinner size="small" />
                    Finding user...
                {:else}
                    Find User to Report
                {/if}
            </button>
            {#if findUserError}
                <p class="find-user-error">{findUserError}</p>
            {/if}
        </div>

        <!-- Active Targets Section -->
        {#if warMap.activeTargets && warMap.activeTargets.length > 0}
            <div class="targets-section">
                <h4 class="section-title">Active Targets</h4>
                <div class="targets-grid">
                    {#each warMap.activeTargets as target (target.id)}
                        <TargetCard {target} />
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Global Statistics Card -->
        <div class="war-zone-stats-card">
            <h4 class="war-zone-stats-title">Global War Statistics</h4>
            <div class="war-zone-stats-grid overview-stats-grid">
                <div class="war-zone-stat-item">
                    <span class="war-zone-stat-value"
                        >{warMap.globalStats.totalZones}</span
                    >
                    <span class="war-zone-stat-label">Total Zones</span>
                </div>
                <div class="war-zone-stat-item">
                    <span class="war-zone-stat-value"
                        >{warMap.globalStats.averageLiberation.toFixed(
                            1,
                        )}%</span
                    >
                    <span class="war-zone-stat-label">Avg Liberation</span>
                </div>
                <div class="war-zone-stat-item">
                    <span class="war-zone-stat-value"
                        >{warMap.globalStats.totalBanned.toLocaleString()}</span
                    >
                    <span class="war-zone-stat-label">Total Banned</span>
                </div>
                <div class="war-zone-stat-item">
                    <span class="war-zone-stat-value"
                        >{warMap.globalStats.totalTargets.toLocaleString()}</span
                    >
                    <span class="war-zone-stat-label">Active Targets</span>
                </div>
            </div>
        </div>

        <!-- Global Historical Trends -->
        <div class="war-zone-stats-card">
            <h4 class="war-zone-stats-title">Global Trends (30 Days)</h4>
            <GlobalHistoryChart />
        </div>

        <!-- Major Orders Section -->
        {#if warMap.majorOrders && warMap.majorOrders.length > 0}
            <div class="major-orders-section">
                <h4 class="section-title">Active Major Orders</h4>
                <div class="major-orders-list">
                    {#each warMap.majorOrders.filter((o) => o.isActive) as order (order.id)}
                        <MajorOrderCard {order} />
                    {/each}
                </div>
            </div>
        {/if}
    </div>
{/if}
