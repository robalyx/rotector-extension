<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { BookOpen, ExternalLink, CircleQuestionMark, FileText } from '@lucide/svelte';
	import SiDiscord from '@icons-pack/svelte-simple-icons/icons/SiDiscord';
	import SiGithub from '@icons-pack/svelte-simple-icons/icons/SiGithub';
	import ExtLink from '@/components/ui/ExtLink.svelte';
	import { LEGAL_URLS } from '@/lib/types/constants';
	import { setStorage } from '@/lib/utils/storage';

	async function handleViewGuide() {
		await setStorage('local', 'onboardingReplayRequested', true);
		await browser.tabs.create({ url: 'https://www.roblox.com/home' });
	}
</script>

<div class="footer-container">
	<div class="footer-link-row">
		<ExtLink class="footer-link" href="https://discord.gg/2Cn7kXqqhY">
			<SiDiscord class="footer-link-icon" size={14} />
			{$_('footer_discord')}
		</ExtLink>
		<span class="footer-link-dot">&middot;</span>
		<ExtLink class="footer-link" href="https://github.com/robalyx">
			<SiGithub class="footer-link-icon" size={14} />
			{$_('footer_github')}
		</ExtLink>
		<span class="footer-link-dot">&middot;</span>
		<ExtLink class="footer-link" href="https://github.com/robalyx/rotector-extension">
			<ExternalLink class="footer-link-icon" />
			{$_('footer_source_code')}
		</ExtLink>
	</div>

	<div class="footer-link-row">
		<button class="footer-link" onclick={handleViewGuide} type="button">
			<BookOpen class="footer-link-icon" />
			{$_('footer_view_guide')}
		</button>
		<span class="footer-link-dot">&middot;</span>
		<ExtLink class="footer-link" href="https://roscoe.rotector.com/docs">
			<FileText class="footer-link-icon" />
			{$_('footer_docs')}
		</ExtLink>
		<span class="footer-link-dot">&middot;</span>
		<ExtLink class="footer-link" href="https://rotector.com">
			<CircleQuestionMark class="footer-link-icon" />
			{$_('footer_help')}
		</ExtLink>
	</div>

	<div class="footer-legal-section">
		<ExtLink class="footer-legal-link" href={LEGAL_URLS.privacy}>{$_('footer_privacy')}</ExtLink>
		<span class="footer-legal-divider">|</span>
		<ExtLink class="footer-legal-link" href={LEGAL_URLS.terms}>{$_('footer_terms')}</ExtLink>
	</div>

	<p class="footer-credit">{$_('footer_made_by')}</p>
</div>
