<script lang="ts">
	import { getAssetUrl } from '@/lib/utils/assets';
	import { themeManager } from '@/lib/utils/theme';

	const lightLogoUrl = getAssetUrl('/assets/rotector-logo-light.webp');
	const darkLogoUrl = getAssetUrl('/assets/rotector-logo-dark.webp');
	const effectiveTheme = themeManager.effectiveTheme;
	const logoUrl = $derived($effectiveTheme === 'dark' ? darkLogoUrl : lightLogoUrl);
</script>

<img alt="Rotector" src={logoUrl} />
