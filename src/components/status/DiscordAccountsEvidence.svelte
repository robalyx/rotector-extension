<script lang="ts">
	import SiDiscord from '@icons-pack/svelte-simple-icons/icons/SiDiscord';
	import SiRoblox from '@icons-pack/svelte-simple-icons/icons/SiRoblox';
	import { ChevronRight, Users, Server, ChevronsDownUp, ChevronsUpDown } from 'lucide-svelte';
	import { _ } from 'svelte-i18n';
	import { SvelteSet } from 'svelte/reactivity';
	import { apiClient } from '@/lib/services/api-client';
	import type { DiscordAccountInfo, RobloxAltAccount } from '@/lib/types/api';
	import { VERIFICATION_SOURCE_NAMES } from '@/lib/types/api';
	import { formatShortDate, formatTimestamp } from '@/lib/utils/time';

	interface Props {
		robloxUserId: number;
		fallbackEvidence: string[];
	}

	let { robloxUserId, fallbackEvidence }: Props = $props();

	let discordAccounts = $state<DiscordAccountInfo[]>([]);
	let altAccounts = $state<RobloxAltAccount[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let expandedAccounts = new SvelteSet<string>();

	const hasData = $derived(discordAccounts.length > 0 || altAccounts.length > 0);
	const totalServers = $derived(
		discordAccounts.reduce((sum, account) => sum + account.servers.length, 0)
	);
	const allExpanded = $derived(
		discordAccounts.length > 0 &&
			discordAccounts.every((account) => expandedAccounts.has(account.id))
	);

	function getSourceNames(sources: number[]): string[] {
		return sources
			.map((source) => VERIFICATION_SOURCE_NAMES[source])
			.filter((name): name is string => name !== undefined);
	}

	function toggleAccount(accountId: string) {
		if (expandedAccounts.has(accountId)) {
			expandedAccounts.delete(accountId);
		} else {
			expandedAccounts.add(accountId);
		}
	}

	function toggleAll() {
		if (allExpanded) {
			expandedAccounts.clear();
		} else {
			for (const account of discordAccounts) {
				expandedAccounts.add(account.id);
			}
		}
	}

	$effect(() => {
		async function fetchDiscordData() {
			try {
				isLoading = true;
				error = null;
				const result = await apiClient.lookupRobloxUserDiscord(robloxUserId);
				discordAccounts = result.discordAccounts;
				altAccounts = result.altAccounts;
			} catch (err) {
				error = err instanceof Error ? err.message : 'Failed to fetch Discord data';
			} finally {
				isLoading = false;
			}
		}

		void fetchDiscordData();
	});
</script>

<div class="discord-evidence-container">
	{#if isLoading}
		<div class="discord-loading">
			<div class="discord-loading-shimmer"></div>
			<span class="discord-loading-text">{$_('tooltip_discord_loading')}</span>
		</div>
	{:else if error}
		{#each fallbackEvidence as evidence, index (index)}
			<div class="evidence-item">{evidence}</div>
		{/each}
	{:else if hasData}
		<!-- Summary bar -->
		<div class="discord-summary">
			<span class="discord-summary-item">
				<Users size={12} />
				{$_(
					discordAccounts.length === 1
						? 'tooltip_discord_accounts_singular'
						: 'tooltip_discord_accounts_plural',
					{ values: { 0: discordAccounts.length } }
				)}
			</span>
			<span class="discord-summary-separator"></span>
			<span class="discord-summary-item">
				<Server size={12} />
				{$_(
					totalServers === 1
						? 'tooltip_discord_servers_singular'
						: 'tooltip_discord_servers_plural',
					{ values: { 0: totalServers } }
				)}
			</span>
			{#if altAccounts.length > 0}
				<span class="discord-summary-separator"></span>
				<span class="discord-summary-item">
					<span class="discord-roblox-icon"><SiRoblox size={12} /></span>
					{$_(
						altAccounts.length === 1
							? 'tooltip_discord_alts_singular'
							: 'tooltip_discord_alts_plural',
						{ values: { 0: altAccounts.length } }
					)}
				</span>
			{/if}
			{#if discordAccounts.length > 0}
				<button
					class="discord-expand-all-btn"
					aria-label={$_(
						allExpanded ? 'tooltip_discord_collapse_all' : 'tooltip_discord_expand_all'
					)}
					onclick={toggleAll}
					title={$_(allExpanded ? 'tooltip_discord_collapse_all' : 'tooltip_discord_expand_all')}
					type="button"
				>
					{#if allExpanded}
						<ChevronsDownUp size={14} />
					{:else}
						<ChevronsUpDown size={14} />
					{/if}
				</button>
			{/if}
		</div>

		<!-- Discord accounts -->
		{#each discordAccounts as account (account.id)}
			{@const isExpanded = expandedAccounts.has(account.id)}
			{@const sourceNames = getSourceNames(account.sources)}
			<div class="discord-account-card" class:expanded={isExpanded}>
				<button
					class="discord-account-header"
					onclick={() => toggleAccount(account.id)}
					type="button"
				>
					<span
						style:transform={isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'}
						class="discord-chevron-wrapper"
					>
						<ChevronRight class="discord-chevron" size={14} />
					</span>
					<span class="discord-icon"><SiDiscord size={14} /></span>
					<span class="discord-account-id">
						{account.id}
					</span>
					{#if sourceNames.length > 0}
						{#each sourceNames as sourceName (sourceName)}
							<span class="discord-source-badge">{sourceName}</span>
						{/each}
					{/if}
					<span class="discord-server-count">
						{$_(
							account.servers.length === 1
								? 'tooltip_discord_servers_singular'
								: 'tooltip_discord_servers_plural',
							{ values: { 0: account.servers.length } }
						)}
					</span>
				</button>

				{#if isExpanded}
					<div class="discord-account-content">
						{#each account.servers as server (server.serverId)}
							<div class="discord-server-item">
								<div class="discord-server-info">
									<span class="discord-server-name">{server.serverName}</span>
									{#if server.isTase}
										<span class="discord-tase-badge" title={$_('tooltip_discord_tase_description')}
											>TASE</span
										>
									{/if}
								</div>
								<div class="discord-server-date">
									<span
										>{$_('tooltip_discord_joined', {
											values: {
												0: formatShortDate(server.joinedAt) ?? $_('tooltip_discord_unknown')
											}
										})}</span
									>
									<span class="discord-date-separator">•</span>
									<span
										>{$_('tooltip_discord_updated', {
											values: {
												0: server.updatedAt
													? formatTimestamp(server.updatedAt)
													: $_('tooltip_discord_unknown')
											}
										})}</span
									>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}

		<!-- Alt accounts (same card style as Discord accounts) -->
		{#each altAccounts as alt (alt.robloxUserId)}
			{@const altSourceNames = getSourceNames(alt.sources)}
			<div class="discord-account-card">
				<div class="discord-alt-header-static">
					<span class="discord-roblox-icon"><SiRoblox size={14} /></span>
					<a
						class="discord-alt-link"
						href="https://www.roblox.com/users/{alt.robloxUserId}/profile"
						rel="noopener noreferrer"
						target="_blank"
					>
						{alt.robloxUsername}
					</a>
					<span class="discord-alt-id"
						>{$_('tooltip_discord_id_label', { values: { 0: alt.robloxUserId } })}</span
					>
					{#if altSourceNames.length > 0}
						{#each altSourceNames as sourceName (sourceName)}
							<span class="discord-source-badge">{sourceName}</span>
						{/each}
					{/if}
					<span class="discord-server-count">
						{$_('tooltip_discord_updated', { values: { 0: formatTimestamp(alt.updatedAt) } })}
					</span>
				</div>
			</div>
		{/each}
	{:else}
		{#each fallbackEvidence as evidence, index (index)}
			<div class="evidence-item">{evidence}</div>
		{/each}
	{/if}
</div>
