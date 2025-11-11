<script lang="ts">
	import { BarChart3, Settings, Swords } from 'lucide-svelte';
	import { t } from '@/lib/stores/i18n';

	type NavPage = 'stats' | 'settings' | 'warzone';

	interface NavbarProps {
		currentPage: string | null;
		onPageChange: (page: NavPage) => void;
	}

	let { currentPage, onPageChange }: NavbarProps = $props();
</script>

<nav class="navbar">
	<button
		class="navbar-tab"
		class:active={currentPage === 'stats'}
		aria-current={currentPage === 'stats' ? 'page' : undefined}
		onclick={() => onPageChange('stats')}
		type="button"
	>
		<span class="navbar-icon">
			<BarChart3 size={18} strokeWidth={2.5} />
		</span>
		<span class="navbar-label">{t('navbar_tab_stats')}</span>
	</button>

	<button
		class="navbar-tab"
		class:active={currentPage === 'warzone'}
		aria-current={currentPage === 'warzone' ? 'page' : undefined}
		onclick={() => onPageChange('warzone')}
		type="button"
	>
		<span class="navbar-icon">
			<Swords size={18} strokeWidth={2.5} />
		</span>
		<span class="navbar-label">{t('navbar_tab_warzone')}</span>
	</button>

	<button
		class="navbar-tab"
		class:active={currentPage === 'settings'}
		aria-current={currentPage === 'settings' ? 'page' : undefined}
		onclick={() => onPageChange('settings')}
		type="button"
	>
		<span class="navbar-icon">
			<Settings size={18} strokeWidth={2.5} />
		</span>
		<span class="navbar-label">{t('navbar_tab_settings')}</span>
	</button>
</nav>
