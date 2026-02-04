<script lang="ts">
	import SettingsSection from './settings/SettingsSection.svelte';

	interface Props {
		onNavigateToCustomApis?: () => void;
		onNavigateToDeveloperLogs?: () => void;
		onNavigateToPerformance?: () => void;
	}

	let { onNavigateToCustomApis, onNavigateToDeveloperLogs, onNavigateToPerformance }: Props =
		$props();
</script>

<div class="settings-page">
	<SettingsSection {onNavigateToCustomApis} {onNavigateToDeveloperLogs} {onNavigateToPerformance} />
</div>
