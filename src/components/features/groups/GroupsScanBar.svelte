<script lang="ts">
	import { scanGroupsForUser } from '@/lib/services/rotector/scan-jobs';
	import ScanBar from '../scan/ScanBar.svelte';

	interface Props {
		userId: string;
	}

	let { userId }: Props = $props();

	function scan(onProgress: (pct: number) => void, signal: AbortSignal) {
		return scanGroupsForUser(userId, onProgress, signal);
	}
</script>

<ScanBar label="groups" {scan} />
