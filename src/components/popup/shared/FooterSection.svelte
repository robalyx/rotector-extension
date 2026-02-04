<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { BookOpen, ExternalLink, CircleHelp, FileText } from 'lucide-svelte';
	import SiDiscord from '@icons-pack/svelte-simple-icons/icons/SiDiscord';
	import SiGithub from '@icons-pack/svelte-simple-icons/icons/SiGithub';

	async function handleViewGuide() {
		await browser.storage.local.set({ onboardingReplayRequested: true });
		await browser.tabs.create({ url: 'https://www.roblox.com/home' });
	}
</script>

<div class="footer-container">
	<!-- Social Media / Community Links -->
	<div class="footer-social-section">
		<a
			class="footer-social-link footer-social-link-discord"
			href="https://discord.gg/2Cn7kXqqhY"
			rel="noopener noreferrer"
			target="_blank"
		>
			<SiDiscord size={14} />
			{$_('footer_discord')}
		</a>

		<a
			class="footer-social-link footer-social-link-github"
			href="https://github.com/robalyx"
			rel="noopener noreferrer"
			target="_blank"
		>
			<SiGithub size={14} />
			{$_('footer_github')}
		</a>
	</div>

	<!-- Source Code Link -->
	<div class="footer-social-section">
		<a
			class="footer-social-link footer-social-link-github"
			href="https://github.com/robalyx/rotector-extension"
			rel="noopener noreferrer"
			target="_blank"
		>
			<ExternalLink class="footer-social-icon-stroke" />
			{$_('footer_source_code')}
		</a>
	</div>

	<!-- Help Link -->
	<div class="footer-help-section">
		<button class="footer-help-link" onclick={handleViewGuide} type="button">
			<BookOpen class="footer-help-icon-stroke" />
			{$_('footer_view_guide')}
		</button>
		<a
			class="footer-help-link"
			href="https://roscoe.rotector.com/docs"
			rel="noopener noreferrer"
			target="_blank"
		>
			<FileText class="footer-help-icon-stroke" />
			{$_('footer_docs')}
		</a>
		<a
			class="footer-help-link"
			href="https://rotector.com"
			rel="noopener noreferrer"
			target="_blank"
		>
			<CircleHelp class="footer-help-icon-stroke" />
			{$_('footer_help')}
		</a>
	</div>

	<!-- Legal Links -->
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

	<!-- Creator Credit -->
	<p class="footer-credit">{$_('footer_made_by')}</p>
</div>
