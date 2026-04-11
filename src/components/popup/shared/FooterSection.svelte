<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { BookOpen, ExternalLink, CircleHelp, FileText } from '@lucide/svelte';
	import SiDiscord from '@icons-pack/svelte-simple-icons/icons/SiDiscord';
	import SiGithub from '@icons-pack/svelte-simple-icons/icons/SiGithub';

	async function handleViewGuide() {
		await browser.storage.local.set({ onboardingReplayRequested: true });
		await browser.tabs.create({ url: 'https://www.roblox.com/home' });
	}
</script>

<div class="footer-container">
	<!-- Community links -->
	<div class="footer-link-row">
		<a
			class="footer-link"
			href="https://discord.gg/2Cn7kXqqhY"
			rel="noopener noreferrer"
			target="_blank"
		>
			<SiDiscord class="footer-link-icon" size={14} />
			{$_('footer_discord')}
		</a>
		<span class="footer-link-dot">&middot;</span>
		<a
			class="footer-link"
			href="https://github.com/robalyx"
			rel="noopener noreferrer"
			target="_blank"
		>
			<SiGithub class="footer-link-icon" size={14} />
			{$_('footer_github')}
		</a>
		<span class="footer-link-dot">&middot;</span>
		<a
			class="footer-link"
			href="https://github.com/robalyx/rotector-extension"
			rel="noopener noreferrer"
			target="_blank"
		>
			<ExternalLink class="footer-link-icon" />
			{$_('footer_source_code')}
		</a>
	</div>

	<!-- Help links -->
	<div class="footer-link-row">
		<button class="footer-link" onclick={handleViewGuide} type="button">
			<BookOpen class="footer-link-icon" />
			{$_('footer_view_guide')}
		</button>
		<span class="footer-link-dot">&middot;</span>
		<a
			class="footer-link"
			href="https://roscoe.rotector.com/docs"
			rel="noopener noreferrer"
			target="_blank"
		>
			<FileText class="footer-link-icon" />
			{$_('footer_docs')}
		</a>
		<span class="footer-link-dot">&middot;</span>
		<a class="footer-link" href="https://rotector.com" rel="noopener noreferrer" target="_blank">
			<CircleHelp class="footer-link-icon" />
			{$_('footer_help')}
		</a>
	</div>

	<!-- Legal links -->
	<div class="footer-legal-section">
		<a
			class="footer-legal-link"
			href="https://rotector.com/privacy"
			rel="noopener noreferrer"
			target="_blank">{$_('footer_privacy')}</a
		>
		<span class="footer-legal-divider">|</span>
		<a
			class="footer-legal-link"
			href="https://rotector.com/terms"
			rel="noopener noreferrer"
			target="_blank">{$_('footer_terms')}</a
		>
	</div>

	<!-- Creator credit -->
	<p class="footer-credit">{$_('footer_made_by')}</p>
</div>
