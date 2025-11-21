<script lang="ts">
	import type { UserStatus } from '@/lib/types/api';
	import { _ } from 'svelte-i18n';

	interface Props {
		status: UserStatus;
		position?: 'inline' | 'below-header' | 'footer';
	}

	let { status, position = 'below-header' }: Props = $props();

	const versionStatus = $derived(() => {
		if (!status.engineVersion) {
			return {
				status: 'unknown',
				statusText: $_('engine_status_unknown'),
				description: $_('engine_desc_unknown'),
				impact: $_('engine_desc_unknown_impact')
			};
		}

		const compatibility = status.versionCompatibility;

		if (compatibility === 'current') {
			return {
				status: 'latest',
				statusText: $_('engine_status_latest'),
				description: $_('engine_desc_latest'),
				impact: $_('engine_desc_latest_impact')
			};
		} else if (compatibility === 'compatible') {
			return {
				status: 'behind-minor',
				statusText: $_('engine_status_compatible'),
				description: $_('engine_desc_compatible'),
				impact: $_('engine_desc_compatible_impact')
			};
		} else if (compatibility === 'outdated') {
			return {
				status: 'behind-major',
				statusText: $_('engine_status_outdated'),
				description: $_('engine_desc_outdated'),
				impact: $_('engine_desc_outdated_impact')
			};
		} else if (compatibility === 'deprecated') {
			return {
				status: 'deprecated',
				statusText: $_('engine_status_deprecated'),
				description: $_('engine_desc_deprecated'),
				impact: $_('engine_desc_deprecated_impact')
			};
		} else {
			// Fallback for unknown compatibility status
			return {
				status: 'unknown',
				statusText: $_('engine_status_unknown'),
				description: $_('engine_desc_unknown'),
				impact: $_('engine_desc_unknown_impact')
			};
		}
	});

	let showTooltip = $state(false);

	function handleMouseEnter() {
		showTooltip = true;
	}

	function handleMouseLeave() {
		showTooltip = false;
	}
</script>

<div
	class="engine-version-container-{position}"
	aria-label={$_('engine_aria_info')}
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
	role="tooltip"
>
	<div class="engine-version-tag {versionStatus().status}">
		{status.engineVersion}
	</div>

	{#if showTooltip}
		<div class="engine-version-tooltip {position} visible">
			<div
				class="engine-version-tooltip-header"
				class:centered={position === 'below-header' || position === 'footer'}
			>
				{$_('engine_header_version', {
					values: { 0: status.engineVersion ?? $_('engine_version_unknown') }
				})}
				<div class="engine-version-status {versionStatus().status}">
					{versionStatus().statusText}
				</div>
			</div>

			<div class="engine-version-description">
				{versionStatus().description}
			</div>

			<div class="engine-version-impact">
				{versionStatus().impact}
			</div>
		</div>
	{/if}
</div>
