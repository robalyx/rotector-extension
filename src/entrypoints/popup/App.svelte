<script lang="ts">
	import Navbar from '../../components/popup/Navbar.svelte';
	import StatsPage from '../../components/popup/StatsPage.svelte';
	import SettingsPage from '../../components/popup/SettingsPage.svelte';
	import QueuePage from '../../components/popup/QueuePage.svelte';
	import CustomApiManagement from '../../components/popup/api/CustomApiManagement.svelte';
	import CustomApiDocumentation from '../../components/popup/api/CustomApiDocumentation.svelte';
	import MembershipPage from '../../components/popup/membership/MembershipPage.svelte';
	import DeveloperLogsPage from '../../components/popup/developer/DeveloperLogsPage.svelte';
	import PerformanceDashboard from '../../components/popup/developer/PerformanceDashboard.svelte';
	import FooterSection from '../../components/popup/shared/FooterSection.svelte';
	import LegalPausedBanner from '../../components/popup/shared/LegalPausedBanner.svelte';
	import Toast from '../../components/ui/Toast.svelte';
	import { loadStoredLanguagePreference } from '@/lib/stores/i18n';
	import { loadQueueHistory } from '@/lib/stores/queue-history';
	import { loadDeveloperLogs } from '@/lib/stores/developer-logs';
	import { themeManager } from '@/lib/utils/theme';
	import { logger } from '@/lib/utils/logger';
	import { _ } from 'svelte-i18n';

	const IS_DEV = import.meta.env.USE_DEV_API === 'true';
	type Surface = 'popup' | 'options';

	type Page =
		| 'stats'
		| 'settings'
		| 'queue'
		| 'custom-apis'
		| 'custom-api-docs'
		| 'membership'
		| 'developer-logs'
		| 'performance';

	const LAST_PAGE_STORAGE_KEY = 'lastVisitedPage';
	interface Props {
		surface?: Surface;
	}

	let { surface = 'popup' }: Props = $props();

	const isPopupSurface = $derived(surface === 'popup');
	const isOptionsSurface = $derived(surface === 'options');
	let currentPage = $state<Page | null>(null);

	// Resolve the initial options page from a pending deep link on cold start
	$effect(() => {
		if (!isOptionsSurface || currentPage !== null) return;
		void (async () => {
			const { optionsDeepLink: target } = await browser.storage.local.get('optionsDeepLink');
			await browser.storage.local.remove('optionsDeepLink');
			currentPage = target === 'membership' ? 'membership' : 'custom-apis';
		})();
	});

	// Handle deep link navigation from popup to an already-open options tab
	$effect(() => {
		if (!isOptionsSurface) return;

		const handler = (changes: Record<string, { newValue?: unknown }>, area: string) => {
			if (area !== 'local') return;
			const target = changes['optionsDeepLink']?.newValue;
			if (typeof target === 'string') {
				currentPage = target as Page;
				void browser.storage.local.remove('optionsDeepLink');
			}
		};

		browser.storage.onChanged.addListener(handler);
		return () => browser.storage.onChanged.removeListener(handler);
	});

	function handlePageChange(page: Page) {
		currentPage = page;
	}

	async function openCustomApisOptionsPage() {
		await browser.storage.local.set({ optionsDeepLink: 'custom-apis' });
		await browser.runtime.openOptionsPage();
	}

	async function openMembershipOptionsPage() {
		await browser.storage.local.set({ optionsDeepLink: 'membership' });
		await browser.runtime.openOptionsPage();
	}

	$effect(() => {
		loadStoredLanguagePreference().catch((error: unknown) => {
			logger.error('Failed to load language preference:', error);
		});
		loadQueueHistory().catch((error: unknown) => {
			logger.error('Failed to load queue history:', error);
		});
		loadDeveloperLogs().catch((error: unknown) => {
			logger.error('Failed to load developer logs:', error);
		});
	});

	// Load last visited page from storage
	$effect(() => {
		if (!isPopupSurface) return;

		browser.storage.local
			.get(LAST_PAGE_STORAGE_KEY)
			.then((result) => {
				const savedPage = result[LAST_PAGE_STORAGE_KEY] as Page | undefined;
				if (
					savedPage &&
					savedPage !== 'custom-apis' &&
					savedPage !== 'custom-api-docs' &&
					savedPage !== 'membership' &&
					(!IS_DEV ? savedPage !== 'performance' : true)
				) {
					currentPage = savedPage;
				} else {
					currentPage = 'stats';
				}
			})
			.catch((error: unknown) => {
				logger.error('Failed to load last visited page:', error);
				currentPage = 'stats';
			});
	});

	// Save current page to storage
	$effect(() => {
		if (!isPopupSurface) return;

		if (currentPage) {
			browser.storage.local
				.set({ [LAST_PAGE_STORAGE_KEY]: currentPage })
				.catch((error: unknown) => {
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
	class={isOptionsSurface
		? 'app mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 overflow-x-clip px-4 py-6'
		: 'app flex min-h-[400px] w-[350px] flex-col gap-3 p-3'}
>
	<!-- Toast Notifications -->
	<Toast />

	{#if isPopupSurface}
		<!-- Header Section -->
		<div class="pb-2 text-center">
			<div class="mb-2 flex justify-center">
				<img class="h-20 w-auto max-w-[260px] object-contain" alt="Rotector" src={logoSrc} />
			</div>
			<p
				class="
      text-text-subtle dark:text-text-subtle-dark m-0
      text-xs
    "
			>
				{$_('popup_header_description')}
			</p>
		</div>

		<LegalPausedBanner />

		<!-- Navigation -->
		<Navbar {currentPage} onPageChange={handlePageChange} />
	{/if}

	{#if isOptionsSurface}
		<!-- Options Tab Bar -->
		<nav class="custom-api-tabs" aria-label={$_('custom_api_tab_navigation')}>
			<button
				class="custom-api-tab"
				class:active={currentPage === 'custom-apis'}
				aria-pressed={currentPage === 'custom-apis'}
				onclick={() => handlePageChange('custom-apis')}
				type="button"
			>
				{$_('custom_api_tab_manage')}
			</button>
			<button
				class="custom-api-tab"
				class:active={currentPage === 'membership'}
				aria-pressed={currentPage === 'membership'}
				onclick={() => handlePageChange('membership')}
				type="button"
			>
				{$_('membership_tab_label')}
			</button>
			<button
				class="custom-api-tab"
				class:active={currentPage === 'custom-api-docs'}
				aria-pressed={currentPage === 'custom-api-docs'}
				onclick={() => handlePageChange('custom-api-docs')}
				type="button"
			>
				{$_('custom_api_tab_docs')}
			</button>
		</nav>
	{/if}

	<!-- Page Content -->
	<div class="page-content">
		{#if currentPage !== null}
			{#if currentPage === 'stats'}
				<StatsPage />
			{:else if currentPage === 'settings'}
				<SettingsPage
					onNavigateToCustomApis={openCustomApisOptionsPage}
					onNavigateToDeveloperLogs={() => handlePageChange('developer-logs')}
					onNavigateToMembership={openMembershipOptionsPage}
					onNavigateToPerformance={IS_DEV ? () => handlePageChange('performance') : undefined}
				/>
			{:else if currentPage === 'queue'}
				<QueuePage />
			{:else if currentPage === 'custom-apis'}
				<CustomApiManagement />
			{:else if currentPage === 'custom-api-docs'}
				<CustomApiDocumentation />
			{:else if currentPage === 'membership'}
				<MembershipPage />
			{:else if currentPage === 'developer-logs'}
				<DeveloperLogsPage onBack={() => handlePageChange('settings')} />
			{:else if IS_DEV && currentPage === 'performance'}
				<PerformanceDashboard onBack={() => handlePageChange('settings')} />
			{/if}
		{/if}
	</div>

	{#if isPopupSurface}
		<!-- Footer Section -->
		<FooterSection />
	{/if}
</div>
