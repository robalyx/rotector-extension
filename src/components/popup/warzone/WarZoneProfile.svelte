<script lang="ts">
    import {
        authStore,
        updateAnonymous,
        logout,
    } from "../../../lib/stores/auth";
    import { apiClient } from "../../../lib/services/api-client";
    import { logger } from "../../../lib/utils/logger";
    import LoadingSpinner from "../../ui/LoadingSpinner.svelte";

    let isUpdatingAnonymous = $state(false);
    let isAnonymousInput = $state(false);
    let isResettingUuid = $state(false);
    let resetSuccess = $state(false);

    $effect(() => {
        if ($authStore.profile) {
            isAnonymousInput = $authStore.profile.isAnonymous;
        }
    });

    function formatPoints(points: number): string {
        if (points >= 1000) {
            return `${(points / 1000).toFixed(1)}k`;
        }
        return points.toString();
    }

    async function handleToggleAnonymous() {
        if (!$authStore.profile || isUpdatingAnonymous) return;

        const newValue = !isAnonymousInput;
        isUpdatingAnonymous = true;
        try {
            isAnonymousInput = newValue;
            await updateAnonymous(newValue);
        } catch (error) {
            logger.error("Failed to update anonymous status:", error);
            isAnonymousInput = $authStore.profile.isAnonymous;
        } finally {
            isUpdatingAnonymous = false;
        }
    }

    function getDiscordAvatarUrl(
        avatarHash: string | null,
        userId: string,
    ): string | null {
        if (!avatarHash) return null;
        return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=32`;
    }

    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }

    async function handleLogout() {
        const confirmed = confirm(
            "Are you sure you want to logout?\n\n" +
                "You can login again anytime using your Discord account.",
        );

        if (!confirmed) return;

        try {
            await logout();
        } catch (error) {
            logger.error("Logout failed:", error);
        }
    }

    async function handleResetUuid() {
        const confirmed = confirm(
            "Log out from all devices?\n\n" +
                "This will invalidate all active sessions on other devices. " +
                "You will remain logged in on this device, but all other devices will be logged out.\n\n" +
                "This is useful if you suspect your account has been compromised.",
        );

        if (!confirmed) return;

        isResettingUuid = true;
        resetSuccess = false;

        try {
            const result = await apiClient.resetUuid();

            // Store new UUID
            await browser.storage.local.set({ extension_uuid: result.uuid });

            // Update auth store with new UUID
            authStore.update((state) => ({
                ...state,
                uuid: result.uuid,
            }));

            resetSuccess = true;
            setTimeout(() => {
                resetSuccess = false;
            }, 3000);
        } catch (error) {
            logger.error("Failed to reset UUID:", error);
            alert("Failed to log out from all devices. Please try again.");
        } finally {
            isResettingUuid = false;
        }
    }
</script>

{#if $authStore.profile}
    <div class="war-zone-profile">
        <div class="war-zone-profile-header">
            <div class="war-zone-profile-info">
                <h3 class="war-zone-profile-title">Profile</h3>
            </div>

            <div class="war-zone-profile-stats">
                <div class="war-zone-profile-stat-item">
                    <span class="war-zone-profile-stat-value"
                        >{formatPoints($authStore.profile.totalPoints)}</span
                    >
                    <span class="war-zone-profile-stat-label">Points</span>
                </div>
            </div>
        </div>

        <div class="war-zone-profile-details">
            <div class="war-zone-detail-item">
                <span class="war-zone-detail-label">Discord</span>
                <div class="discord-info">
                    {#if $authStore.profile.discordAvatar && $authStore.profile.discordUserId}
                        <img
                            class="discord-avatar"
                            alt="Discord Avatar"
                            src={getDiscordAvatarUrl(
                                $authStore.profile.discordAvatar,
                                $authStore.profile.discordUserId,
                            )}
                        />
                    {/if}
                    <span class="war-zone-detail-value"
                        >{$authStore.profile.discordUsername}</span
                    >
                </div>
            </div>

            <div class="war-zone-detail-item">
                <div class="war-zone-detail-row">
                    <span class="war-zone-detail-label-inline">Visibility</span>
                    <div class="war-zone-visibility-toggle">
                        {#if isUpdatingAnonymous}
                            <LoadingSpinner size="small" />
                        {:else}
                            <label class="war-zone-toggle-switch">
                                <input
                                    checked={isAnonymousInput}
                                    disabled={isUpdatingAnonymous}
                                    onchange={handleToggleAnonymous}
                                    type="checkbox"
                                />
                                <span class="war-zone-toggle-slider"></span>
                                <span class="war-zone-toggle-label"
                                    >{isAnonymousInput
                                        ? "Anonymous"
                                        : "Public"}</span
                                >
                            </label>
                        {/if}
                    </div>
                </div>
            </div>

            <div class="war-zone-detail-item">
                <span class="war-zone-detail-label">Joined</span>
                <span class="war-zone-detail-value"
                    >{formatDate($authStore.profile.createdAt)}</span
                >
            </div>

            <div class="war-zone-detail-item">
                <span class="war-zone-detail-label">Last Active</span>
                <span class="war-zone-detail-value"
                    >{formatDate($authStore.profile.lastActive)}</span
                >
            </div>
        </div>

        <div class="war-zone-profile-actions">
            <button
                class="war-zone-profile-reset-button"
                disabled={isResettingUuid}
                onclick={handleResetUuid}
                type="button"
            >
                {#if isResettingUuid}
                    <LoadingSpinner size="small" />
                    Logging out...
                {:else if resetSuccess}
                    ✓ Logged out from all devices
                {:else}
                    Log Out From All Devices
                {/if}
            </button>

            <button
                class="war-zone-profile-logout-button"
                onclick={handleLogout}
                type="button"
            >
                Logout
            </button>
        </div>

        {#if $authStore.error}
            <div class="war-zone-profile-error">
                {$authStore.error}
            </div>
        {/if}
    </div>
{/if}
