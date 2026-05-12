<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { unprocessedCount } from '@/lib/stores/queue-history';

	type NavPage = 'stats' | 'settings' | 'queue' | 'leaderboard';

	interface NavbarProps {
		currentPage: string | null;
		onPageChange: (page: NavPage) => void;
	}

	let { currentPage, onPageChange }: NavbarProps = $props();

	const tabs: Array<{ id: NavPage; labelKey: string }> = [
		{ id: 'stats', labelKey: 'navbar_tab_stats' },
		{ id: 'queue', labelKey: 'navbar_tab_queue' },
		{ id: 'leaderboard', labelKey: 'navbar_tab_leaderboard' },
		{ id: 'settings', labelKey: 'navbar_tab_settings' }
	];
</script>

<nav class="navbar-text-tabs" aria-label="Primary">
	{#each tabs as { id, labelKey } (id)}
		<button
			class="navbar-tab"
			class:active={currentPage === id}
			aria-current={currentPage === id ? 'page' : undefined}
			onclick={() => onPageChange(id)}
			type="button"
		>
			{$_(labelKey)}
			{#if id === 'queue' && $unprocessedCount > 0}
				<span class="navbar-tab-count">{$unprocessedCount}</span>
			{/if}
		</button>
	{/each}
</nav>
