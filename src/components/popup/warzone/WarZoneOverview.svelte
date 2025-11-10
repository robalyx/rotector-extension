<script lang="ts">
	import { onMount } from 'svelte';
	import type { WarMapState } from '../../../lib/types/api';
	import { apiClient } from '../../../lib/services/api-client';
	import { t } from '../../../lib/stores/i18n';
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';
	import MajorOrderCard from './MajorOrderCard.svelte';
	import HexagonalZoneMap from './HexagonalZoneMap.svelte';
	import WarZoneHistoryChart from './WarZoneHistoryChart.svelte';
	import TargetCard from './TargetCard.svelte';

	interface Props {
		onZoneSelect: (zoneId: number) => void;
	}

	let { onZoneSelect }: Props = $props();

	let warMap = $state<WarMapState | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let isFindingUser = $state(false);
	let findUserError = $state<string | null>(null);

	onMount(async () => {
		await loadWarMap();
	});

	async function loadWarMap() {
		isLoading = true;
		error = null;

		try {
			warMap = await apiClient.getWarMap();
		} catch (err) {
			error = err instanceof Error ? err.message : t('warzone_overview_error_load');
		} finally {
			isLoading = false;
		}
	}

	async function handleFindReportableUser() {
		isFindingUser = true;
		findUserError = null;

		try {
			const result = await apiClient.getReportableUser();

			// Open Roblox profile in new tab
			const profileUrl = `https://www.roblox.com/users/${result.userId}/profile`;
			await browser.tabs.create({ url: profileUrl });
		} catch (err) {
			const error = err as Error & { status?: number };

			if (error.status === 404) {
				findUserError = t('warzone_overview_error_no_users');
			} else if (error.status === 403) {
				findUserError = t('warzone_overview_error_auth_expired');
			} else {
				findUserError = error.message || t('warzone_overview_error_find_user');
			}
		} finally {
			isFindingUser = false;
		}
	}
</script>

{#if isLoading}
	<div class="war-zone-loading">
		<LoadingSpinner />
		<p class="war-zone-loading-text">{t('warzone_overview_loading')}</p>
	</div>
{:else if error}
	<div class="war-zone-error-container">
		<p class="error-message">{error}</p>
		<button class="retry-button" onclick={loadWarMap} type="button">
			{t('warzone_common_button_retry')}
		</button>
	</div>
{:else if warMap}
	<div class="war-zone-overview">
		<!-- Zones Section -->
		<div class="zones-section">
			<h4 class="section-title">{t('warzone_overview_section_zones')}</h4>
			<HexagonalZoneMap {onZoneSelect} zones={warMap.zones} />
		</div>

		<!-- Find Reportable User Section -->
		<div class="find-user-section">
			<button
				class="find-user-button"
				disabled={isFindingUser}
				onclick={handleFindReportableUser}
				type="button"
			>
				{#if isFindingUser}
					<LoadingSpinner size="small" />
					{t('warzone_overview_finding_user_loading')}
				{:else}
					{t('warzone_overview_button_find_user')}
				{/if}
			</button>
			{#if findUserError}
				<p class="find-user-error">{findUserError}</p>
			{/if}
		</div>

		<!-- Active Targets Section -->
		{#if warMap.activeTargets && warMap.activeTargets.length > 0}
			<div class="targets-section">
				<h4 class="section-title">{t('warzone_overview_section_targets')}</h4>
				<div class="targets-grid">
					{#each warMap.activeTargets as target (target.id)}
						<TargetCard {target} />
					{/each}
				</div>
			</div>
		{/if}

		<!-- Global Statistics Card -->
		<div class="war-zone-stats-card">
			<h4 class="war-zone-stats-title">{t('warzone_overview_section_global_stats')}</h4>
			<div class="war-zone-stats-grid overview-stats-grid">
				<div class="war-zone-stat-item">
					<span class="war-zone-stat-value">{warMap.globalStats.totalZones}</span>
					<span class="war-zone-stat-label">{t('warzone_overview_stat_total_zones')}</span>
				</div>
				<div class="war-zone-stat-item">
					<span class="war-zone-stat-value">{warMap.globalStats.averageLiberation.toFixed(1)}%</span
					>
					<span class="war-zone-stat-label">{t('warzone_overview_stat_avg_liberation')}</span>
				</div>
				<div class="war-zone-stat-item">
					<span class="war-zone-stat-value">{warMap.globalStats.totalBanned.toLocaleString()}</span>
					<span class="war-zone-stat-label">{t('warzone_overview_stat_total_banned')}</span>
				</div>
				<div class="war-zone-stat-item">
					<span class="war-zone-stat-value">{warMap.globalStats.totalTargets.toLocaleString()}</span
					>
					<span class="war-zone-stat-label">{t('warzone_overview_stat_active_targets')}</span>
				</div>
			</div>
		</div>

		<!-- Global Historical Trends -->
		<div class="war-zone-stats-card">
			<h4 class="war-zone-stats-title">{t('warzone_overview_section_global_trends')}</h4>
			<WarZoneHistoryChart mode="global" />
		</div>

		<!-- Major Orders Section -->
		{#if warMap.majorOrders && warMap.majorOrders.length > 0}
			<div class="major-orders-section">
				<h4 class="section-title">{t('warzone_overview_section_major_orders')}</h4>
				<div class="major-orders-list">
					{#each warMap.majorOrders.filter((o) => o.isActive) as order (order.id)}
						<MajorOrderCard {order} />
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}
