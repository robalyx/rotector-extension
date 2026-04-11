<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Bell, BellOff, ChevronRight } from '@lucide/svelte';
	import {
		changelogs,
		changelogSectionExpanded,
		toggleChangelogSection,
		enableChangelogModal,
		disableChangelogModal
	} from '@/lib/stores/changelog';
	import { settings } from '@/lib/stores/settings';
	import { SETTINGS_KEYS } from '@/lib/types/settings';
	import { logger } from '@/lib/utils/logger';
	import ChangelogContent from './ChangelogContent.svelte';

	const latest = $derived(changelogs[0]);
	const isModalDisabled = $derived($settings[SETTINGS_KEYS.CHANGELOG_MODAL_DISABLED]);

	async function handleToggle() {
		try {
			await toggleChangelogSection();
		} catch (error) {
			logger.error('Failed to toggle changelog section:', error);
		}
	}

	async function handleToggleNotifications(event: MouseEvent) {
		event.stopPropagation();
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

<section class="changelog-compact">
	<button
		class="changelog-compact-row"
		class:expanded={$changelogSectionExpanded}
		aria-expanded={$changelogSectionExpanded}
		onclick={handleToggle}
		type="button"
	>
		<span class="popup-section-title">{$_('stats_changelog_title')}</span>
		{#if latest}
			<span class="changelog-compact-version">v{latest.version}</span>
		{/if}
		<span class="changelog-compact-spacer"></span>
		<ChevronRight class="changelog-compact-chevron" size={14} strokeWidth={2.25} />
	</button>

	{#if $changelogSectionExpanded}
		<div class="changelog-compact-body">
			{#if latest}
				<ChangelogContent changelog={latest} compact={false} />
				<button
					class="changelog-compact-notification-toggle"
					onclick={handleToggleNotifications}
					title={isModalDisabled
						? $_('changelog_notifications_enable_tooltip')
						: $_('changelog_notifications_disable_tooltip')}
					type="button"
				>
					{#if isModalDisabled}
						<BellOff size={12} />
						<span>{$_('changelog_notifications_enable_tooltip')}</span>
					{:else}
						<Bell size={12} />
						<span>{$_('changelog_notifications_disable_tooltip')}</span>
					{/if}
				</button>
			{:else}
				<p class="changelog-compact-empty">{$_('stats_changelog_empty')}</p>
			{/if}
		</div>
	{/if}
</section>
