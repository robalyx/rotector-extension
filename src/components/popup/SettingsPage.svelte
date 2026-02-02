<script lang="ts">
	import SettingsSection from './settings/SettingsSection.svelte';

	interface Props {
		onNavigateToCustomApis?: () => void;
		onNavigateToRotectorDocs?: () => void;
		onNavigateToDeveloperLogs?: () => void;
	}

	let { onNavigateToCustomApis, onNavigateToRotectorDocs, onNavigateToDeveloperLogs }: Props =
		$props();
</script>

<div class="settings-page">
	<SettingsSection
		{onNavigateToCustomApis}
		{onNavigateToDeveloperLogs}
		{onNavigateToRotectorDocs}
	/>
</div>
