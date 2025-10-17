<script lang="ts">
    import WarZoneProfile from './WarZoneProfile.svelte';
    import WarZoneOverview from './WarZoneOverview.svelte';
    import ZoneTargetsView from './ZoneTargetsView.svelte';
    import LeaderboardView from './LeaderboardView.svelte';

    type ViewType = "overview" | "zone" | "profile" | "leaderboard";

    let currentView = $state<ViewType>("overview");
    let selectedZoneId = $state<number | null>(null);

    function switchView(view: ViewType) {
        currentView = view;
        if (view !== "zone") {
            selectedZoneId = null;
        }
    }

    function handleZoneSelect(zoneId: number) {
        selectedZoneId = zoneId;
        currentView = "zone";
    }

    function handleBackToOverview() {
        currentView = "overview";
        selectedZoneId = null;
    }
</script>

<div class="war-zone-section">
    <div class="war-zone-nav">
        <div class="war-zone-nav-tabs">
            <button
                class="war-zone-nav-tab"
                class:active={currentView === "overview" ||
                    currentView === "zone"}
                onclick={() => switchView("overview")}
                type="button"
            >
                War Zone
            </button>
            <button
                class="war-zone-nav-tab"
                class:active={currentView === "profile"}
                onclick={() => switchView("profile")}
                type="button"
            >
                Profile
            </button>
            <button
                class="war-zone-nav-tab"
                class:active={currentView === "leaderboard"}
                onclick={() => switchView("leaderboard")}
                type="button"
            >
                Leaderboard
            </button>
        </div>
    </div>

    <div class="war-zone-content">
        {#if currentView === "overview"}
            <WarZoneOverview onZoneSelect={handleZoneSelect} />
        {:else if currentView === "zone" && selectedZoneId !== null}
            <ZoneTargetsView
                onBack={handleBackToOverview}
                zoneId={selectedZoneId}
            />
        {:else if currentView === "profile"}
            <WarZoneProfile />
        {:else if currentView === "leaderboard"}
            <LeaderboardView />
        {/if}
    </div>
</div>
