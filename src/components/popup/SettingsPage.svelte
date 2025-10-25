<script lang="ts">
	import SettingsSection from './settings/SettingsSection.svelte';
	import AdvancedViolationBanner from './shared/AdvancedViolationBanner.svelte';
	import type { SettingsSectionInstance } from '@/lib/types/components';

	let settingsSection = $state<SettingsSectionInstance>();

	// Expose unlock method for parent component
	export async function unlockDeveloperMode() {
		await settingsSection?.unlockDeveloperMode();
	}
</script>

<div class="settings-page">
	<!-- Advanced Violation Banner -->
	<AdvancedViolationBanner {settingsSection} />

	<!-- Settings Section -->
	<SettingsSection bind:this={settingsSection} />
</div>
