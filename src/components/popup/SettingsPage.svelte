<script lang="ts">
	import SettingsSection from './settings/SettingsSection.svelte';

	interface Props {
		onNavigateToCustomApis?: () => void;
		onNavigateToRotectorDocs?: () => void;
		onNavigateToDeveloperLogs?: () => void;
		onNavigateToPerformance?: () => void;
	}

	let {
		onNavigateToCustomApis,
		onNavigateToRotectorDocs,
		onNavigateToDeveloperLogs,
		onNavigateToPerformance
	}: Props = $props();
</script>

<div class="settings-page">
	<SettingsSection
		{onNavigateToCustomApis}
		{onNavigateToDeveloperLogs}
		{onNavigateToPerformance}
		{onNavigateToRotectorDocs}
	/>
</div>
