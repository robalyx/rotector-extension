<script lang="ts">
    import {BarChart3, Settings, Swords} from 'lucide-svelte';

    type Page = 'stats' | 'settings' | 'warzone';

    interface NavbarProps {
        currentPage: Page | null;
        onPageChange: (page: Page) => void;
        onDeveloperUnlock: () => void;
    }

    let {currentPage, onPageChange, onDeveloperUnlock}: NavbarProps = $props();

    function handleSettingsClick(event: MouseEvent) {
        if (event.altKey) {
            onDeveloperUnlock();
        } else {
            onPageChange('settings');
        }
    }
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
        <span class="navbar-label">Stats</span>
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
        <span class="navbar-label">War Zone</span>
    </button>

    <button
        class="navbar-tab"
        class:active={currentPage === 'settings'}
        aria-current={currentPage === 'settings' ? 'page' : undefined}
        onclick={handleSettingsClick}
        title="Settings (Alt+Click for developer mode)"
        type="button"
    >
        <span class="navbar-icon">
            <Settings size={18} strokeWidth={2.5} />
        </span>
        <span class="navbar-label">Settings</span>
    </button>
</nav>
