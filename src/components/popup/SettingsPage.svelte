<script lang="ts">
	import SettingsSection from './settings/SettingsSection.svelte';

	interface Props {
		onNavigateToCustomApis?: () => void;
		onNavigateToMembership?: () => void;
		onNavigateToDeveloperLogs?: () => void;
		onNavigateToPerformance?: (() => void) | undefined;
	}

	let {
		onNavigateToCustomApis,
		onNavigateToMembership,
		onNavigateToDeveloperLogs,
		onNavigateToPerformance
	}: Props = $props();
</script>

<div class="settings-page">
	<SettingsSection
		{onNavigateToCustomApis}
		{onNavigateToDeveloperLogs}
		{onNavigateToMembership}
		{onNavigateToPerformance}
	/>
</div>
