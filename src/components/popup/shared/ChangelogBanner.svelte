<script lang="ts">
	import {
		changelogSectionExpanded,
		dismissChangelogBanner,
		latestChangelog,
		shouldShowChangelogBanner,
		toggleChangelogSection
	} from '@/lib/stores/changelog';
	import { logger } from '@/lib/utils/logger';
	import { formatTimeAgo } from '@/lib/utils/time';
	import { t } from '@/lib/stores/i18n';

	let isClosing = $state(false);

	const releaseTimeText = $derived(
		$latestChangelog ? t('banner_changelog_message', [formatTimeAgo($latestChangelog.date)]) : ''
	);

	// Dismisses the banner with animation
	function handleDismiss() {
		isClosing = true;

		// Animation delay before hiding
		setTimeout(() => {
			dismissChangelogBanner().catch((error) => {
				logger.error('Failed to dismiss changelog banner:', error);
				isClosing = false;
			});
		}, 200);
	}

	// Reset isClosing after animation completes to allow proper unmounting
	function handleCloseAnimationEnd() {
		if (isClosing && !$shouldShowChangelogBanner) {
			isClosing = false;
		}
	}

	// Opens the full changelog section
	async function handleViewDetails() {
		try {
			// Expand changelog section if needed
			if (!$changelogSectionExpanded) {
				await toggleChangelogSection();
			}

			// Hide banner once user accesses details
			await dismissChangelogBanner();

			// Navigate to changelog content
			setTimeout(() => {
				const changelogSection = document.getElementById('changelog-section-content');
				if (changelogSection) {
					changelogSection.scrollIntoView({
						behavior: 'smooth',
						block: 'start'
					});
				}
			}, 100);
		} catch (error) {
			logger.error('Failed to navigate to changelog section:', error);
		}
	}
</script>

{#if ($shouldShowChangelogBanner && $latestChangelog) || isClosing}
	<div
		class="changelog-banner"
		class:closing={isClosing}
		onanimationend={handleCloseAnimationEnd}
		ontransitionend={handleCloseAnimationEnd}
	>
		<div class="changelog-banner-content">
			<!-- Banner content and controls -->
			<div class="changelog-banner-body">
				<p class="changelog-banner-message">{releaseTimeText}</p>
				<button
					class="changelog-banner-view-details"
					onclick={handleViewDetails}
					title={t('banner_changelog_title_view_details')}
					type="button"
				>
					{t('banner_changelog_button_view_details')}
				</button>
				<!-- Close button -->
				<button
					class="changelog-banner-dismiss"
					aria-label={t('banner_changelog_aria_dismiss')}
					onclick={handleDismiss}
					title={t('banner_changelog_title_dismiss')}
					type="button"
				>
					<svg
						class="changelog-dismiss-icon"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
						/>
					</svg>
				</button>
			</div>
		</div>
	</div>
{/if}
