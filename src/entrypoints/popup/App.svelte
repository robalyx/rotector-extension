<script lang="ts">
	import Navbar from '../../components/popup/Navbar.svelte';
	import StatsPage from '../../components/popup/StatsPage.svelte';
	import SettingsPage from '../../components/popup/SettingsPage.svelte';
	import WarzonePage from '../../components/popup/WarzonePage.svelte';
	import QueuePage from '../../components/popup/QueuePage.svelte';
	import CustomApiManagement from '../../components/popup/api/CustomApiManagement.svelte';
	import CustomApiDocumentation from '../../components/popup/api/CustomApiDocumentation.svelte';
	import DeveloperLogsPage from '../../components/popup/developer/DeveloperLogsPage.svelte';
	import PerformanceDashboard from '../../components/popup/developer/PerformanceDashboard.svelte';
	import FooterSection from '../../components/popup/shared/FooterSection.svelte';
	import { initializeSettings, settings } from '@/lib/stores/settings';
	import { SETTINGS_KEYS } from '@/lib/types/settings';
	import { loadStoredLanguagePreference } from '@/lib/stores/i18n';
	import { loadQueueHistory } from '@/lib/stores/queue-history';
	import { loadDeveloperLogs } from '@/lib/stores/developer-logs';
	import { loadPerformanceEntries } from '@/lib/stores/performance';
	import { themeManager } from '@/lib/utils/theme';
	import { logger } from '@/lib/utils/logger';
	import { _ } from 'svelte-i18n';

	type Page =
		| 'stats'
		| 'settings'
		| 'warzone'
		| 'queue'
		| 'custom-apis'
		| 'custom-api-docs'
		| 'developer-logs'
		| 'performance';

	const LAST_PAGE_STORAGE_KEY = 'lastVisitedPage';

	let currentPage = $state<Page | null>(null);
	const showWarzone = $derived($settings[SETTINGS_KEYS.EXPERIMENTAL_WARZONE_ENABLED] ?? false);

	function handlePageChange(page: Page) {
		currentPage = page;
	}

	$effect(() => {
		loadStoredLanguagePreference().catch((error) => {
			logger.error('Failed to load language preference:', error);
		});
		initializeSettings().catch((error) => {
			logger.error('Failed to initialize settings:', error);
		});
		themeManager.initializePopupThemeSync().catch((error) => {
			logger.error('Failed to initialize popup theme sync:', error);
		});
		loadQueueHistory().catch((error) => {
			logger.error('Failed to load queue history:', error);
		});
		loadDeveloperLogs().catch((error) => {
			logger.error('Failed to load developer logs:', error);
		});
		loadPerformanceEntries().catch((error) => {
			logger.error('Failed to load performance entries:', error);
		});
	});

	// Load last visited page from storage on mount
	$effect(() => {
		browser.storage.local
			.get(LAST_PAGE_STORAGE_KEY)
			.then((result) => {
				const savedPage = result[LAST_PAGE_STORAGE_KEY] as Page | undefined;
				if (
					savedPage &&
					(savedPage === 'stats' ||
						savedPage === 'settings' ||
						savedPage === 'warzone' ||
						savedPage === 'queue' ||
						savedPage === 'custom-apis' ||
						savedPage === 'custom-api-docs' ||
						savedPage === 'developer-logs' ||
						savedPage === 'performance')
				) {
					currentPage = savedPage;
				} else {
					currentPage = 'stats';
				}
			})
			.catch((error) => {
				logger.error('Failed to load last visited page:', error);
				currentPage = 'stats';
			});
	});

	// Save current page to storage whenever it changes
	$effect(() => {
		if (currentPage) {
			browser.storage.local.set({ [LAST_PAGE_STORAGE_KEY]: currentPage }).catch((error) => {
				logger.error('Failed to save last visited page:', error);
			});
		}
	});

	const theme = themeManager.effectiveTheme;
	const logoSrc = $derived(
		$theme === 'dark' ? '/assets/rotector-logo-dark.webp' : '/assets/rotector-logo-light.webp'
	);
</script>

<div
	class="
  app flex min-h-[400px] w-[350px] flex-col gap-3 p-3
"
>
	<!-- Header Section -->
	<div class="pb-2 text-center">
		<div class="mb-2 flex justify-center">
			<img class="h-20 w-auto max-w-[260px] object-contain" alt="Rotector" src={logoSrc} />
		</div>
		<p
			class="
      text-text-subtle m-0 text-xs
      dark:text-text-subtle-dark
    "
		>
			{$_('popup_header_description')}
		</p>
	</div>

	<!-- Navigation -->
	<Navbar {currentPage} onPageChange={handlePageChange} {showWarzone} />

	<!-- Page Content -->
	<div class="page-content">
		{#if currentPage !== null}
			{#if currentPage === 'stats'}
				<StatsPage />
			{:else if currentPage === 'settings'}
				<SettingsPage
					onNavigateToCustomApis={() => handlePageChange('custom-apis')}
					onNavigateToDeveloperLogs={() => handlePageChange('developer-logs')}
					onNavigateToPerformance={() => handlePageChange('performance')}
				/>
			{:else if currentPage === 'warzone'}
				<WarzonePage />
			{:else if currentPage === 'queue'}
				<QueuePage />
			{:else if currentPage === 'custom-apis'}
				<CustomApiManagement
					onBack={() => handlePageChange('settings')}
					onNavigateToDocumentation={() => handlePageChange('custom-api-docs')}
				/>
			{:else if currentPage === 'custom-api-docs'}
				<CustomApiDocumentation onBack={() => handlePageChange('custom-apis')} />
			{:else if currentPage === 'developer-logs'}
				<DeveloperLogsPage onBack={() => handlePageChange('settings')} />
			{:else if currentPage === 'performance'}
				<PerformanceDashboard onBack={() => handlePageChange('settings')} />
			{/if}
		{/if}
	</div>

	<!-- Footer Section -->
	<FooterSection />
</div>
