<script lang="ts">
    import { onMount } from "svelte";
    import type { ZoneDetails } from "../../../lib/types/api";
    import { apiClient } from "../../../lib/services/api-client";
    import LoadingSpinner from "../../ui/LoadingSpinner.svelte";
    import ZoneHistoryChart from "./ZoneHistoryChart.svelte";
    import { ArrowLeft } from "lucide-svelte";

    interface Props {
        zoneId: number;
        onBack: () => void;
    }

    let { zoneId, onBack }: Props = $props();

    let zoneDetails = $state<ZoneDetails | null>(null);
    let isLoading = $state(true);
    let error = $state<string | null>(null);

    onMount(async () => {
        await loadZoneDetails();
    });

    async function loadZoneDetails() {
        isLoading = true;
        error = null;

        try {
            zoneDetails = await apiClient.getWarZone(zoneId);
        } catch (err) {
            error =
                err instanceof Error
                    ? err.message
                    : "Failed to load zone details";
        } finally {
            isLoading = false;
        }
    }

    function getProgressColor(progress: number): string {
        if (progress >= 75) return "var(--color-status-safe)";
        if (progress >= 50) return "var(--color-primary)";
        if (progress >= 25) return "var(--color-warning)";
        return "var(--color-error)";
    }
</script>

{#if isLoading}
    <div class="war-zone-loading">
        <LoadingSpinner />
        <p class="war-zone-loading-text">Loading zone details...</p>
    </div>
{:else if error}
    <div class="war-zone-error-container">
        <p class="error-message">{error}</p>
        <div class="error-actions">
            <button
                class="retry-button"
                onclick={loadZoneDetails}
                type="button"
            >
                Retry
            </button>
            <button class="back-button" onclick={onBack} type="button">
                Back to Overview
            </button>
        </div>
    </div>
{:else if zoneDetails}
    <div class="zone-targets-view">
        <!-- Zone Header -->
        <div class="zone-view-header">
            <button class="back-button" onclick={onBack} type="button">
                <ArrowLeft size={16} />
                Back to Overview
            </button>
            <div class="zone-title-section">
                <h4 class="zone-title">{zoneDetails.zone.name}</h4>
                <span class="zone-status">
                    {zoneDetails.zone.liberation.toFixed(1)}% Liberated
                </span>
            </div>
        </div>

        <!-- Zone Progress Bar -->
        <div class="zone-progress-section">
            <div class="progress-bar-large">
                <div
                    style:width="{zoneDetails.zone.liberation}%"
                    style:background-color={getProgressColor(
                        zoneDetails.zone.liberation,
                    )}
                    class="progress-bar-large-progress-fill"
                ></div>
            </div>
        </div>

        <!-- Zone Statistics -->
        <div class="zone-statistics-grid">
            <div class="zone-stat-card">
                <span class="stat-value"
                    >{zoneDetails.zone.totalUsers.toLocaleString()}</span
                >
                <span class="stat-label">Total Users</span>
            </div>
            <div class="zone-stat-card">
                <span class="stat-value">{zoneDetails.zone.bannedUsers}</span>
                <span class="stat-label">Banned</span>
            </div>
            <div class="zone-stat-card">
                <span class="stat-value">{zoneDetails.zone.flaggedUsers}</span>
                <span class="stat-label">Flagged</span>
            </div>
            <div class="zone-stat-card">
                <span class="stat-value">{zoneDetails.zone.confirmedUsers}</span
                >
                <span class="stat-label">Confirmed</span>
            </div>
        </div>

        <!-- Zone Historical Trends -->
        <div class="war-zone-stats-card">
            <h4 class="war-zone-stats-title">Zone Trends (30 Days)</h4>
            <ZoneHistoryChart {zoneId} />
        </div>
    </div>
{/if}
