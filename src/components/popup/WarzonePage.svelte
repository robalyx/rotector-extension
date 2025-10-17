<script lang="ts">
    import { authStore } from "@/lib/stores/auth";
    import HunterSection from "./warzone/HunterSection.svelte";
    import WarZoneSection from "./warzone/WarZoneSection.svelte";
</script>

<div class="warzone-page">
    {#if !$authStore.isAuthenticated}
        <!-- Show login/signup section if not authenticated -->
        <HunterSection />
    {:else}
        <!-- Show war zone content if authenticated -->
        <WarZoneSection />
    {/if}
</div>
