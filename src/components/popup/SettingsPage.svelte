<script lang="ts">
	import SettingsSection from './settings/SettingsSection.svelte';

	interface Props {
		onNavigateToCustomApis?: () => void;
		onNavigateToRotectorDocs?: () => void;
	}

	let { onNavigateToCustomApis, onNavigateToRotectorDocs }: Props = $props();
</script>

<div class="settings-page">
	<SettingsSection {onNavigateToCustomApis} {onNavigateToRotectorDocs} />
</div>
