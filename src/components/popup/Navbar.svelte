<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { unprocessedCount } from '@/lib/stores/queue-history';

	type NavPage = 'stats' | 'settings' | 'queue';

	interface NavbarProps {
		currentPage: string | null;
		onPageChange: (page: NavPage) => void;
	}

	let { currentPage, onPageChange }: NavbarProps = $props();
</script>

<nav class="navbar-text-tabs" aria-label="Primary">
	<button
		class="navbar-tab"
		class:active={currentPage === 'stats'}
		aria-current={currentPage === 'stats' ? 'page' : undefined}
		onclick={() => onPageChange('stats')}
		type="button"
	>
		{$_('navbar_tab_stats')}
	</button>

	<button
		class="navbar-tab"
		class:active={currentPage === 'queue'}
		aria-current={currentPage === 'queue' ? 'page' : undefined}
		onclick={() => onPageChange('queue')}
		type="button"
	>
		{$_('navbar_tab_queue')}
		{#if $unprocessedCount > 0}
			<span class="navbar-tab-count">{$unprocessedCount}</span>
		{/if}
	</button>

	<button
		class="navbar-tab"
		class:active={currentPage === 'settings'}
		aria-current={currentPage === 'settings' ? 'page' : undefined}
		onclick={() => onPageChange('settings')}
		type="button"
	>
		{$_('navbar_tab_settings')}
	</button>
</nav>
