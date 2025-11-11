<script lang="ts">
	import SettingsSection from './settings/SettingsSection.svelte';
	import AdvancedViolationBanner from './shared/AdvancedViolationBanner.svelte';
	import type { SettingsSectionInstance } from '@/lib/types/components';

	interface Props {
		onNavigateToCustomApis?: () => void;
		onNavigateToRotectorDocs?: () => void;
	}

	let { onNavigateToCustomApis, onNavigateToRotectorDocs }: Props = $props();

	let settingsSection = $state<SettingsSectionInstance>();
</script>

<div class="settings-page">
	<!-- Advanced Violation Banner -->
	<AdvancedViolationBanner {settingsSection} />

	<!-- Settings Section -->
	<SettingsSection
		bind:this={settingsSection}
		{onNavigateToCustomApis}
		{onNavigateToRotectorDocs}
	/>
</div>
