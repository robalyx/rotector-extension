<script lang="ts">
	import SiDiscord from '@icons-pack/svelte-simple-icons/icons/SiDiscord';
	import SiRoblox from '@icons-pack/svelte-simple-icons/icons/SiRoblox';
	import {
		ChevronRight,
		CircleUserRound,
		Users,
		Server,
		ChevronsDownUp,
		ChevronsUpDown,
		Copy,
		Check,
		X
	} from 'lucide-svelte';
	import { _ } from 'svelte-i18n';
	import { SvelteSet } from 'svelte/reactivity';
	import BloxlinkIcon from '@/components/icons/BloxlinkIcon.svelte';
	import RoVerIcon from '@/components/icons/RoVerIcon.svelte';
	import { apiClient } from '@/lib/services/api-client';
	import type { DiscordAccountInfo, RobloxAltAccount } from '@/lib/types/api';
	import { VERIFICATION_SOURCE_NAMES, VERIFICATION_SOURCE_URLS } from '@/lib/types/api';
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
	let copySuccess = $state(false);
	let copyError = $state(false);

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

	function getSourceInfo(sources: number[]) {
		return sources
			.map((source) => {
				const name = VERIFICATION_SOURCE_NAMES[source];
				const url = VERIFICATION_SOURCE_URLS[source];
				return name && url ? { code: source, name, url } : null;
			})
			.filter((info): info is NonNullable<typeof info> => info !== null);
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

	async function handleCopyDiscordSummary(event: MouseEvent) {
		event.stopPropagation();

		const lines: string[] = [];

		// Header with Roblox user ID
		lines.push(`Roblox User ID: ${robloxUserId}`);
		lines.push('');

		// Summary counts
		lines.push(`Discord Accounts: ${discordAccounts.length}`);
		lines.push(`Total Servers: ${totalServers}`);
		if (altAccounts.length > 0) {
			lines.push(`Alt Accounts: ${altAccounts.length}`);
		}
		lines.push('');

		// Discord accounts with server details
		for (const account of discordAccounts) {
			lines.push(`--- Discord Account ${account.id} ---`);

			const sourceNames = getSourceNames(account.sources);
			if (sourceNames.length > 0) {
				lines.push(`Sources: ${sourceNames.join(', ')}`);
			}

			lines.push(`Servers (${account.servers.length}):`);
			for (const server of account.servers) {
				const taseTag = server.isTase ? ' [TASE]' : '';
				const joinedDate = formatShortDate(server.joinedAt) ?? 'Unknown';
				lines.push(`  - ${server.serverName}${taseTag} - Joined ${joinedDate}`);
			}
			lines.push('');
		}

		// Alt accounts
		if (altAccounts.length > 0) {
			lines.push('--- Roblox Alt Accounts ---');
			for (const alt of altAccounts) {
				const altSourceNames = getSourceNames(alt.sources);
				const sourcesStr =
					altSourceNames.length > 0 ? ` - Sources: ${altSourceNames.join(', ')}` : '';
				const updatedStr = formatTimestamp(alt.updatedAt);
				lines.push(
					`  - ${alt.robloxUsername} (ID: ${alt.robloxUserId})${sourcesStr} - Updated ${updatedStr}`
				);
			}
		}

		try {
			await navigator.clipboard.writeText(lines.join('\n').trim());
			copySuccess = true;
			copyError = false;

			setTimeout(() => {
				copySuccess = false;
			}, 2000);
		} catch {
			copyError = true;
			copySuccess = false;

			setTimeout(() => {
				copyError = false;
			}, 2000);
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

<!-- eslint-disable svelte/no-navigation-without-resolve -->
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
				<div class="discord-summary-actions">
					<button
						class="discord-copy-btn"
						class:error={copyError}
						aria-label={$_(
							copyError
								? 'tooltip_discord_copy_failed'
								: copySuccess
									? 'tooltip_discord_copied'
									: 'tooltip_discord_copy'
						)}
						onclick={handleCopyDiscordSummary}
						title={$_(
							copyError
								? 'tooltip_discord_copy_failed'
								: copySuccess
									? 'tooltip_discord_copied'
									: 'tooltip_discord_copy'
						)}
						type="button"
					>
						{#if copyError}
							<X size={14} />
						{:else if copySuccess}
							<Check size={14} />
						{:else}
							<Copy size={14} />
						{/if}
					</button>
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
				</div>
			{/if}
		</div>

		<!-- Discord accounts -->
		{#each discordAccounts as account (account.id)}
			{@const isExpanded = expandedAccounts.has(account.id)}
			{@const sourceInfo = getSourceInfo(account.sources)}
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
					{#each sourceInfo as source (source.code)}
						<a
							class="discord-source-link"
							href={source.url}
							onclick={(e) => e.stopPropagation()}
							rel="noopener noreferrer"
							target="_blank"
							title={source.name}
						>
							{#if source.code === 0}
								<BloxlinkIcon size={14} />
							{:else if source.code === 1}
								<RoVerIcon size={14} />
							{:else}
								<CircleUserRound size={14} />
							{/if}
						</a>
					{/each}
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

		<!-- Alt accounts -->
		{#each altAccounts as alt (alt.robloxUserId)}
			{@const altSourceInfo = getSourceInfo(alt.sources)}
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
					{#each altSourceInfo as source (source.code)}
						<a
							class="discord-source-link"
							href={source.url}
							rel="noopener noreferrer"
							target="_blank"
							title={source.name}
						>
							{#if source.code === 0}
								<BloxlinkIcon size={14} />
							{:else if source.code === 1}
								<RoVerIcon size={14} />
							{:else}
								<CircleUserRound size={14} />
							{/if}
						</a>
					{/each}
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
