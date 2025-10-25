<script lang="ts">
	import {
		dismissAdvancedViolationBanner,
		shouldShowAdvancedViolationBanner
	} from '@/lib/stores/advanced-violation-banner';
	import { settings, updateSetting } from '@/lib/stores/settings';
	import { SETTINGS_KEYS } from '@/lib/types/settings';
	import type { SettingsSectionInstance } from '@/lib/types/components';
	import { logger } from '@/lib/utils/logger';

	interface Props {
		settingsSection?: SettingsSectionInstance;
	}

	let { settingsSection }: Props = $props();

	let isClosing = $state(false);

	// Dismisses the banner with animation
	function handleDismiss() {
		isClosing = true;

		// Animation delay before hiding
		setTimeout(() => {
			dismissAdvancedViolationBanner().catch((error) => {
				logger.error('Failed to dismiss advanced violation banner:', error);
				isClosing = false;
			});
		}, 200);
	}

	// Navigates to settings and highlights the advanced violation option
	async function handleGoToSetting() {
		try {
			// Hide banner when user takes action
			await dismissAdvancedViolationBanner();

			// Open settings section if needed
			if (!$settings[SETTINGS_KEYS.SETTINGS_EXPANDED]) {
				await updateSetting(SETTINGS_KEYS.SETTINGS_EXPANDED, true);
			}

			// Navigate to and highlight the setting
			setTimeout(() => {
				const settingsSectionElement = document.getElementById('settings-section');
				if (settingsSectionElement) {
					settingsSectionElement.scrollIntoView({
						behavior: 'smooth',
						block: 'start'
					});
				}

				settingsSection?.highlightSetting(SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED);
			}, 150);
		} catch (error) {
			logger.error('Failed to navigate to advanced violation setting:', error);
		}
	}
</script>

{#if $shouldShowAdvancedViolationBanner || isClosing}
	<div class="advanced-violation-banner" class:closing={isClosing}>
		<div class="advanced-violation-banner-content">
			<!-- Banner content and controls -->
			<div class="advanced-violation-banner-body">
				<!-- Close button -->
				<button
					class="advanced-violation-banner-dismiss"
					aria-label="Dismiss recommendation banner"
					onclick={handleDismiss}
					title="Dismiss recommendation"
					type="button"
				>
					<svg
						class="advanced-violation-dismiss-icon"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
						/>
					</svg>
				</button>
				<p class="advanced-violation-banner-message">
					Enable advanced violation details for better insights
				</p>
				<button
					class="advanced-violation-banner-enable"
					onclick={handleGoToSetting}
					title="Go to advanced violation details setting"
					type="button"
				>
					Go to Setting
				</button>
			</div>
		</div>
	</div>
{/if}
