<script lang="ts">
	import { ArrowLeft, Copy, Check } from 'lucide-svelte';
	import Highlight from 'svelte-highlight';
	import json from 'svelte-highlight/languages/json';
	import 'svelte-highlight/styles/github-dark.css';
	import TurndownService from 'turndown';
	import { _ } from 'svelte-i18n';
	import { logger } from '@/lib/utils/logger';

	interface Props {
		onBack: () => void;
	}

	let { onBack }: Props = $props();

	let docContainer: HTMLDivElement;
	let copySuccess = $state(false);
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const turndownService = new TurndownService({
		headingStyle: 'atx',
		codeBlockStyle: 'fenced',
		bulletListMarker: '-'
	});

	async function copyDocumentation() {
		if (!docContainer) return;

		try {
			// Clone the container to avoid modifying the original
			const clone = docContainer.cloneNode(true) as HTMLElement;

			// Remove the header section
			const header = clone.querySelector('.custom-api-header');
			if (header) {
				header.remove();
			}

			const html = clone.innerHTML || '';
			const markdown = turndownService.turndown(html);
			await navigator.clipboard.writeText(markdown);

			// Clear any existing timeout
			if (timeoutId !== null) {
				clearTimeout(timeoutId);
			}

			copySuccess = true;
			timeoutId = setTimeout(() => {
				copySuccess = false;
				timeoutId = null;
			}, 2000);
		} catch (error) {
			logger.error('Failed to copy documentation', error);
		}
	}

	// Cleanup on unmount
	$effect(() => {
		return () => {
			if (timeoutId !== null) {
				clearTimeout(timeoutId);
			}
		};
	});
</script>

<div bind:this={docContainer} class="custom-api-documentation-page">
	<!-- Header -->
	<div class="custom-api-header">
		<div class="header-actions">
			<button class="back-button" onclick={onBack} type="button">
				<ArrowLeft size={16} />
				<span>{$_('custom_api_docs_button_back')}</span>
			</button>
			<button
				class="copy-button"
				onclick={copyDocumentation}
				title={$_('custom_api_docs_button_copy')}
				type="button"
			>
				{#if copySuccess}
					<Check size={16} />
				{:else}
					<Copy size={16} />
				{/if}
			</button>
		</div>
		<h2 class="custom-api-title">{$_('custom_api_docs_title')}</h2>
	</div>

	<p class="docs-intro">
		{$_('custom_api_docs_intro')}
	</p>

	<!-- Authentication Section -->
	<div class="docs-section">
		<h4 class="docs-section-title">{$_('custom_api_docs_section_authentication')}</h4>
		<p class="docs-note">
			{$_('custom_api_docs_note_no_auth')}
		</p>
	</div>

	<!-- API URL Configuration Section -->
	<div class="docs-section">
		<h4 class="docs-section-title">{$_('custom_api_docs_section_url_config')}</h4>
		<p class="docs-note mb-3">
			{$_('custom_api_docs_note_url_single')}
		</p>
		<p class="docs-note mb-3">
			{$_('custom_api_docs_note_url_batch')}
		</p>

		<h5 class="docs-subtitle">{$_('custom_api_docs_url_examples_correct_title')}</h5>
		<ul class="docs-list mb-3">
			<li><code>{$_('custom_api_docs_url_example_1')}</code></li>
			<li><code>{$_('custom_api_docs_url_example_2')}</code></li>
			<li><code>{$_('custom_api_docs_url_example_3')}</code></li>
		</ul>

		<h5 class="docs-subtitle">{$_('custom_api_docs_url_examples_incorrect_title')}</h5>
		<ul class="docs-list">
			<li><code>{$_('custom_api_docs_url_example_wrong_1')}</code></li>
			<li><code>{$_('custom_api_docs_url_example_wrong_2')}</code></li>
		</ul>
	</div>

	<!-- HTTP Status Codes Section -->
	<div class="docs-section">
		<h4 class="docs-section-title">{$_('custom_api_docs_section_http_status')}</h4>
		<p class="docs-note">
			{$_('custom_api_docs_note_http_status')}
		</p>
	</div>

	<!-- CORS Requirements Section -->
	<div class="docs-section">
		<h4 class="docs-section-title">{$_('custom_api_docs_section_cors')}</h4>
		<p class="docs-note">
			{$_('custom_api_docs_note_cors')}
		</p>
	</div>

	<!-- Single Lookup Section -->
	<div class="docs-section">
		<h4 class="docs-section-title">{$_('custom_api_docs_section_single_lookup')}</h4>
		<div class="docs-endpoint">
			<span class="http-method http-method-get">{$_('custom_api_mgmt_http_method_get')}</span>
			<code class="endpoint-url">{'{your-api-url}/{userId}'}</code>
		</div>

		<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_example_request')}</h5>
		<pre class="code-block"><code>GET https://api.example.com/v1/lookup/roblox/user/123456789</code
			></pre>

		<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_success_response')}</h5>
		<Highlight
			code={JSON.stringify(
				{
					success: true,
					data: {
						id: 123456789,
						flagType: 2,
						confidence: 0.85,
						reasons: {
							'High Risk Pattern': {
								message: 'Account exhibits high-risk behavioral patterns',
								confidence: 0.9,
								evidence: ['Pattern indicator 1', 'Pattern indicator 2']
							}
						},
						reviewer: {
							username: 'reviewer_name',
							displayName: 'Reviewer Display Name'
						},
						engineVersion: '2.17',
						lastUpdated: 1762158166,
						badges: [
							{
								text: 'Verified Unsafe',
								color: '#ef4444',
								textColor: '#ffffff'
							},
							{
								text: 'High Priority'
							}
						]
					}
				},
				null,
				2
			)}
			language={json}
		/>

		<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_error_response')}</h5>
		<p class="docs-note mb-3">
			{$_('custom_api_docs_error_note')}
		</p>
		<Highlight
			code={JSON.stringify(
				{
					success: false,
					error: 'Internal server error'
				},
				null,
				2
			)}
			language={json}
		/>

		<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_required_fields')}</h5>
		<ul class="docs-list">
			<li><code>id</code> - {$_('custom_api_docs_field_id')}</li>
			<li><code>flagType</code> - {$_('custom_api_docs_field_flag_type')}</li>
		</ul>

		<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_optional_fields')}</h5>
		<ul class="docs-list">
			<li><code>confidence</code> - {$_('custom_api_docs_field_confidence')}</li>
			<li>
				<code>reasons</code> - {$_('custom_api_docs_field_reasons')}
				<ul class="docs-list ml-6 mt-2">
					<li><code>message</code> - {$_('custom_api_docs_field_message')}</li>
					<li><code>confidence</code> - {$_('custom_api_docs_field_confidence_reason')}</li>
					<li><code>evidence</code> - {$_('custom_api_docs_field_evidence')}</li>
				</ul>
			</li>
			<li>
				<code>reviewer</code> - {$_('custom_api_docs_field_reviewer')}
			</li>
			<li><code>engineVersion</code> - {$_('custom_api_docs_field_engine_version')}</li>
			<li><code>lastUpdated</code> - {$_('custom_api_docs_field_last_updated')}</li>
			<li>
				<code>badges</code> - {$_('custom_api_docs_field_badges')}
				<ul class="docs-list ml-6 mt-2">
					<li><code>text</code> - {$_('custom_api_docs_field_badge_text')}</li>
					<li>
						<code>color</code> - {$_('custom_api_docs_field_badge_color')}
					</li>
					<li><code>textColor</code> - {$_('custom_api_docs_field_badge_text_color')}</li>
				</ul>
			</li>
		</ul>

		<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_flag_types')}</h5>
		<ul class="docs-list">
			<li><code>0</code> - {$_('custom_api_docs_flag_type_0')}</li>
			<li><code>1</code> - {$_('custom_api_docs_flag_type_1')}</li>
			<li><code>2</code> - {$_('custom_api_docs_flag_type_2')}</li>
			<li><code>3</code> - {$_('custom_api_docs_flag_type_3')}</li>
			<li><code>4</code> - {$_('custom_api_docs_flag_type_4')}</li>
			<li><code>5</code> - {$_('custom_api_docs_flag_type_5')}</li>
			<li><code>6</code> - {$_('custom_api_docs_flag_type_6')}</li>
		</ul>
		<p class="docs-note mb-3">
			{$_('custom_api_docs_flag_type_2_note')}
		</p>
		<p class="docs-note">
			{$_('custom_api_docs_note_flag_type_0')}
		</p>
	</div>

	<!-- Batch Lookup Section -->
	<div class="docs-section">
		<h4 class="docs-section-title">{$_('custom_api_docs_section_batch_lookup')}</h4>
		<div class="docs-endpoint">
			<span class="http-method">{$_('custom_api_mgmt_http_method_post')}</span>
			<code class="endpoint-url">{'{your-api-url}'}</code>
		</div>

		<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_example_request')}</h5>
		<pre class="code-block"><code>POST https://api.example.com/v1/lookup/roblox/user</code></pre>

		<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_request_body')}</h5>
		<Highlight code={JSON.stringify({ ids: [123456789, 987654321] }, null, 2)} language={json} />

		<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_success_response')}</h5>
		<Highlight
			code={JSON.stringify(
				{
					success: true,
					data: {
						'123456789': {
							id: 123456789,
							flagType: 2,
							confidence: 0.85
						},
						'987654321': {
							id: 987654321,
							flagType: 0,
							confidence: 0.1
						}
					}
				},
				null,
				2
			)}
			language={json}
		/>

		<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_error_response')}</h5>
		<p class="docs-note mb-3">
			{$_('custom_api_docs_error_note')}
		</p>
		<Highlight
			code={JSON.stringify(
				{
					success: false,
					error: 'Internal server error'
				},
				null,
				2
			)}
			language={json}
		/>

		<p class="docs-note mb-3">
			{$_('custom_api_docs_note_batch_data')}
		</p>
		<p class="docs-note mb-3">
			{$_('custom_api_docs_note_batch_partial')}
		</p>
		<p class="docs-note">
			{$_('custom_api_docs_note_batch_limit')}
		</p>
	</div>

	<!-- Notes Section -->
	<div class="docs-section">
		<h4 class="docs-section-title">{$_('custom_api_docs_section_notes')}</h4>

		<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_https')}</h5>
		<p class="docs-note">{$_('custom_api_docs_note_https')}</p>

		<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_wrapper')}</h5>
		<p class="docs-note">
			{$_('custom_api_docs_note_wrapper')}
		</p>

		<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_reason_keys')}</h5>
		<p class="docs-note">
			{$_('custom_api_docs_note_reason_keys')}
		</p>

		<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_badges')}</h5>
		<p class="docs-note">
			{$_('custom_api_docs_note_badges')}
		</p>

		<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_badge_colors')}</h5>
		<p class="docs-note">
			{$_('custom_api_docs_note_badge_colors')}
		</p>
	</div>
</div>
