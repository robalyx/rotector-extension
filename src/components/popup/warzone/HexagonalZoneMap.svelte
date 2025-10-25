<script lang="ts">
	import type { Zone } from '../../../lib/types/api';

	interface Props {
		zones: Zone[];
		onZoneSelect: (zoneId: number) => void;
	}

	let { zones, onZoneSelect }: Props = $props();

	function getBorderColor(liberation: number): string {
		if (liberation >= 75) return 'var(--color-liberation-high)';
		if (liberation >= 50) return 'var(--color-liberation-medium)';
		if (liberation >= 25) return 'var(--color-war-zone)';
		return 'var(--color-liberation-low)';
	}

	function handleClick(zoneId: number) {
		onZoneSelect(zoneId);
	}

	// Organize zones into rows: 2-3-2 pattern
	const activeZones = $derived(zones.filter((z) => z.isActive).slice(0, 7));
	const row1 = $derived(activeZones.slice(0, 2));
	const row2 = $derived(activeZones.slice(2, 5));
	const row3 = $derived(activeZones.slice(5, 7));
	const rows = $derived([row1, row2, row3]);
</script>

<div class="hexagonal-map">
	<div class="hexagon-grid">
		{#each rows as row, index (index)}
			{#if row.length > 0}
				<div class="hexagon-row">
					{#each row as zone (zone.id)}
						<div
							class="hexagon-container"
							onclick={() => handleClick(zone.id)}
							onkeydown={(e) => e.key === 'Enter' && handleClick(zone.id)}
							role="button"
							tabindex="0"
						>
							<div class="hexagon">
								<svg class="hexagon-svg" preserveAspectRatio="none" viewBox="0 0 100 115">
									<defs>
										<linearGradient id="grad-{zone.id}" x1="0%" x2="100%" y1="0%" y2="100%">
											<stop
												style:stop-color={getBorderColor(zone.liberation)}
												style:stop-opacity="0.05"
												offset="0%"
											/>
											<stop
												style:stop-color={getBorderColor(zone.liberation)}
												style:stop-opacity="0.1"
												offset="100%"
											/>
										</linearGradient>
									</defs>
									<polygon
										fill="url(#grad-{zone.id})"
										points="50,2 98,30 98,85 50,113 2,85 2,30"
										stroke={getBorderColor(zone.liberation)}
										stroke-width="2"
									/>
								</svg>
								<div class="hexagon-content">
									<span class="hexagon-zone-id">{zone.name}</span>
									<span class="hexagon-liberation">{zone.userPercentage.toFixed(1)}%</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/each}
	</div>
</div>
