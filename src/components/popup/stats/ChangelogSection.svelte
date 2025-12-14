<script lang="ts">
	import { Bell, BellOff } from 'lucide-svelte';
	import { logger } from '@/lib/utils/logger';
	import ChangelogContent from './ChangelogContent.svelte';
	import {
		changelogs,
		changelogSectionExpanded,
		toggleChangelogSection,
		enableChangelogModal,
		disableChangelogModal
	} from '@/lib/stores/changelog';
	import { settings } from '@/lib/stores/settings';
	import { SETTINGS_KEYS } from '@/lib/types/settings';
	import { _ } from 'svelte-i18n';

	const isModalDisabled = $derived($settings[SETTINGS_KEYS.CHANGELOG_MODAL_DISABLED]);

	// Handle toggle of the changelog section
	async function handleToggle() {
		try {
			await toggleChangelogSection();
		} catch (error) {
			logger.error('Failed to toggle changelog section:', error);
		}
	}

	// Toggle changelog modal notifications
	async function handleToggleNotifications() {
		try {
			if (isModalDisabled) {
				await enableChangelogModal();
			} else {
				await disableChangelogModal();
			}
		} catch (error) {
			logger.error('Failed to toggle changelog notifications:', error);
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
			<span class="flex-1 text-left">{$_('stats_changelog_title')}</span>
			<span
				class="
            border-t-text-subtle size-0 border-t-[6px] border-r-4 border-l-4
            border-r-transparent border-l-transparent transition-transform
            duration-300 ease-in-out
            dark:border-t-text-subtle-dark
          "
				class:rotate-180={$changelogSectionExpanded}
			></span>
		</button>
		<button
			class="changelog-notification-toggle"
			class:disabled={isModalDisabled}
			onclick={handleToggleNotifications}
			title={isModalDisabled
				? $_('changelog_notifications_enable_tooltip')
				: $_('changelog_notifications_disable_tooltip')}
			type="button"
		>
			{#if isModalDisabled}
				<BellOff size={14} />
			{:else}
				<Bell size={14} />
			{/if}
		</button>
	</div>
</div>

<div
	id="changelog-section-content"
	class="border-(--color-border-subtle) bg-bg-content overflow-hidden rounded-lg border shadow-soft transition-all
      duration-300 ease-in-out
      dark:bg-bg-content-dark
    "
	class:border-transparent={!$changelogSectionExpanded}
	class:max-h-0={!$changelogSectionExpanded}
	class:max-h-[500px]={$changelogSectionExpanded}
	class:opacity-0={!$changelogSectionExpanded}
	class:opacity-100={$changelogSectionExpanded}
	class:p-0={!$changelogSectionExpanded}
	class:p-2={$changelogSectionExpanded}
>
	{#if $changelogSectionExpanded && $changelogs.length > 0}
		<div
			class="
      changelog-section-content max-h-[440px] scrollbar-styled overflow-y-auto
    "
		>
			{#each $changelogs as changelog, index (changelog.id)}
				<div class="changelog-section-item" class:first={index === 0}>
					<ChangelogContent {changelog} compact={false} />
				</div>
				{#if index < $changelogs.length - 1}
					<div class="changelog-section-divider"></div>
				{/if}
			{/each}
		</div>
	{:else if $changelogSectionExpanded}
		<div class="changelog-section-empty">
			<p
				class="
        text-text-subtle text-center
        dark:text-text-subtle-dark
      "
			>
				{$_('stats_changelog_empty')}
			</p>
		</div>
	{/if}
</div>
