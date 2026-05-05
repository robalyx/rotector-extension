<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { TriangleAlert } from '@lucide/svelte';
	import { legalNeedsAcceptance } from '@/lib/stores/legal';
	import { setStorage } from '@/lib/utils/storage';

	async function handleReview() {
		await setStorage('local', 'legalReviewRequested', true);
		await browser.tabs.create({ url: 'https://www.roblox.com/home' });
	}
</script>

{#if $legalNeedsAcceptance}
	<div class="legal-paused-banner" role="alert">
		<TriangleAlert class="legal-paused-icon" size={18} />
		<div class="legal-paused-text">
			<p class="legal-paused-title">{$_('popup_legal_paused_title')}</p>
			<p class="legal-paused-body">{$_('popup_legal_paused_body')}</p>
		</div>
		<button class="legal-paused-button" onclick={handleReview} type="button">
			{$_('popup_legal_paused_button')}
		</button>
	</div>
{/if}
