<script lang="ts">
	import type { IconDesignKey } from '@/lib/utils/membership-designs';
	import { getAssetUrl } from '@/lib/utils/assets';

	interface Props {
		iconKey: IconDesignKey;
		size: number;
	}

	const { iconKey, size }: Props = $props();

	const shieldSrc = getAssetUrl('/icon/32.png');

	const ICON_PATHS: Readonly<Record<Exclude<IconDesignKey, 'shield' | 'none'>, string>> = {
		star: 'M8 1l2.06 4.18 4.61.67-3.33 3.25.78 4.59L8 11.52l-4.12 2.17.78-4.59L1.33 5.85l4.61-.67z',
		crown: 'M1 10h14v2H1zM3 3L5 7 8 3 11 7 13 3 14 10H2z',
		heart:
			'M8 14.4l-1.1-1C3.2 10.1 1 8 1 5.4A3.4 3.4 0 0 1 4.4 2c1.3 0 2.6.6 3.6 1.7C9 2.6 10.3 2 11.6 2A3.4 3.4 0 0 1 15 5.4c0 2.6-2.2 4.7-5.9 8L8 14.4z',
		bolt: 'M9.4 1L3 9h4l-1.4 6L12 7H8l1.4-6z',
		banner: 'M4 1h8v12l-4-3-4 3z'
	};
</script>

{#if iconKey === 'shield'}
	<img alt="" height={size} src={shieldSrc} width={size} />
{:else}
	<svg
		aria-hidden="true"
		fill="#ffffff"
		height={size}
		viewBox="0 0 16 16"
		width={size}
		xmlns="http://www.w3.org/2000/svg"
	>
		{#if iconKey === 'none'}
			<rect height="2" opacity="0.4" rx="1" width="8" x="4" y="7" />
		{:else}
			<path d={ICON_PATHS[iconKey]} />
		{/if}
	</svg>
{/if}
