<script lang="ts">
	import { onMount } from 'svelte';
	import type { ZoneDetails } from '../../../lib/types/api';
	import { apiClient } from '../../../lib/services/api-client';
	import { _ } from 'svelte-i18n';
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';
	import WarZoneHistoryChart from './WarZoneHistoryChart.svelte';
	import { ArrowLeft } from 'lucide-svelte';

	interface Props {
		zoneId: number;
		onBack: () => void;
	}

	let { zoneId, onBack }: Props = $props();

	let zoneDetails = $state<ZoneDetails | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		await loadZoneDetails();
	});

	async function loadZoneDetails() {
		isLoading = true;
		error = null;

		try {
			zoneDetails = await apiClient.getWarZone(zoneId);
		} catch (err) {
			error = err instanceof Error ? err.message : $_('warzone_zone_error_load');
		} finally {
			isLoading = false;
		}
	}

	function getProgressColor(progress: number): string {
		if (progress >= 75) return 'var(--color-status-safe)';
		if (progress >= 50) return 'var(--color-primary)';
		if (progress >= 25) return 'var(--color-warning)';
		return 'var(--color-error)';
	}
</script>

{#if isLoading}
	<div class="war-zone-loading">
		<LoadingSpinner />
		<p class="war-zone-loading-text">{$_('warzone_zone_loading')}</p>
	</div>
{:else if error}
	<div class="war-zone-error-container">
		<p class="error-message">{error}</p>
		<div class="error-actions">
			<button class="retry-button" onclick={loadZoneDetails} type="button">
				{$_('warzone_common_button_retry')}
			</button>
			<button class="back-button" onclick={onBack} type="button">
				{$_('warzone_zone_button_back')}
			</button>
		</div>
	</div>
{:else if zoneDetails}
	<div class="zone-targets-view">
		<!-- Zone Header -->
		<div class="zone-view-header">
			<button class="back-button" onclick={onBack} type="button">
				<ArrowLeft size={16} />
				{$_('warzone_zone_button_back')}
			</button>
			<div class="zone-title-section">
				<h4 class="zone-title">{zoneDetails.zone.name}</h4>
				<span class="zone-status">
					{zoneDetails.zone.liberation.toFixed(1)}{$_('warzone_zone_status_liberated_suffix')}
				</span>
			</div>
		</div>

		<!-- Zone Progress Bar -->
		<div class="zone-progress-section">
			<div class="progress-bar-large">
				<div
					style:width="{zoneDetails.zone.liberation}%"
					style:background-color={getProgressColor(zoneDetails.zone.liberation)}
					class="progress-bar-large-progress-fill"
				></div>
			</div>
		</div>

		<!-- Zone Statistics -->
		<div class="zone-statistics-grid">
			<div class="zone-stat-card">
				<span class="stat-value">{zoneDetails.zone.totalUsers.toLocaleString()}</span>
				<span class="stat-label">{$_('warzone_zone_stat_total_users')}</span>
			</div>
			<div class="zone-stat-card">
				<span class="stat-value">{zoneDetails.zone.bannedUsers}</span>
				<span class="stat-label">{$_('warzone_zone_stat_banned')}</span>
			</div>
			<div class="zone-stat-card">
				<span class="stat-value">{zoneDetails.zone.flaggedUsers}</span>
				<span class="stat-label">{$_('warzone_zone_stat_flagged')}</span>
			</div>
			<div class="zone-stat-card">
				<span class="stat-value">{zoneDetails.zone.confirmedUsers}</span>
				<span class="stat-label">{$_('warzone_zone_stat_confirmed')}</span>
			</div>
		</div>

		<!-- Zone Historical Trends -->
		<div class="war-zone-stats-card">
			<h4 class="war-zone-stats-title">{$_('warzone_zone_section_trends')}</h4>
			<WarZoneHistoryChart mode="zone" {zoneId} />
		</div>
	</div>
{/if}
