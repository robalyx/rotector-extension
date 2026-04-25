<script lang="ts">
	import { Copy, Check, ExternalLink } from '@lucide/svelte';
	import Highlight from 'svelte-highlight';
	import json from 'svelte-highlight/languages/json';
	import 'svelte-highlight/styles/github-dark.css';
	import TurndownService from 'turndown';
	import { _ } from 'svelte-i18n';
	import { logger } from '@/lib/utils/logger';

	const ROTECTOR_DOCS_URL = 'https://roscoe.rotector.com/docs';

	const SECTIONS = [
		{ id: 'overview', labelKey: 'custom_api_docs_toc_overview' },
		{ id: 'authentication', labelKey: 'custom_api_docs_toc_authentication' },
		{ id: 'url-config', labelKey: 'custom_api_docs_toc_url_config' },
		{ id: 'endpoints', labelKey: 'custom_api_docs_toc_endpoints' },
		{ id: 'schema', labelKey: 'custom_api_docs_toc_schema' },
		{ id: 'flag-types', labelKey: 'custom_api_docs_toc_flag_types' },
		{ id: 'reason-types', labelKey: 'custom_api_docs_toc_reason_types' },
		{ id: 'errors', labelKey: 'custom_api_docs_toc_errors' },
		{ id: 'requirements', labelKey: 'custom_api_docs_toc_requirements' },
		{ id: 'differences', labelKey: 'custom_api_docs_toc_differences' }
	] as const;

	const SINGLE_SUCCESS_EXAMPLE = JSON.stringify(
		{
			success: true,
			data: {
				id: 123456789,
				flagType: 2,
				confidence: 0.85,
				reasons: {
					'User Profile': {
						message: 'Inappropriate content detected in profile description',
						confidence: 0.9,
						evidence: ['Evidence snippet 1', 'Evidence snippet 2']
					}
				},
				reviewer: {
					username: 'reviewer_name',
					displayName: 'Reviewer Display Name'
				},
				engineVersion: '2.17',
				versionCompatibility: 'current',
				isReportable: true,
				isLocked: false,
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
	);

	const BATCH_REQUEST_EXAMPLE = JSON.stringify({ ids: [123456789, 987654321] }, null, 2);

	const BATCH_SUCCESS_EXAMPLE = JSON.stringify(
		{
			success: true,
			data: {
				'123456789': { id: 123456789, flagType: 2, confidence: 0.85 },
				'987654321': { id: 987654321, flagType: 0, confidence: 0.1 }
			}
		},
		null,
		2
	);

	const ERROR_EXAMPLE = JSON.stringify({ success: false, error: 'Internal server error' }, null, 2);

	let docContainer = $state<HTMLDivElement | null>(null);
	let contentRoot = $state<HTMLDivElement | null>(null);
	let copySuccess = $state(false);
	let activeSection = $state<string>(SECTIONS[0].id);
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const turndownService = new TurndownService({
		headingStyle: 'atx',
		codeBlockStyle: 'fenced',
		bulletListMarker: '-'
	});

	async function copyDocumentation() {
		if (!docContainer) return;

		try {
			const clone = docContainer.cloneNode(true) as HTMLElement;

			clone.querySelector('.docs-page-header')?.remove();
			clone.querySelector('.docs-toc')?.remove();

			const html = clone.innerHTML || '';
			const markdown = turndownService.turndown(html);
			await navigator.clipboard.writeText(markdown);

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

	function scrollToSection(id: string) {
		const target = contentRoot?.querySelector(`#section-${id}`);
		if (target instanceof HTMLElement) {
			target.scrollIntoView({ behavior: 'smooth', block: 'start' });
			activeSection = id;
		}
	}

	// Highlight the section currently near the top of the viewport
	$effect(() => {
		const root = contentRoot;
		if (!root) return;

		const observed = SECTIONS.map((section) =>
			root.querySelector<HTMLElement>(`#section-${section.id}`)
		).filter((el): el is HTMLElement => el !== null);

		if (observed.length === 0) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((entry) => entry.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
				const [first] = visible;
				if (first) {
					activeSection = first.target.id.replace(/^section-/, '');
				}
			},
			{ rootMargin: '0px 0px -70% 0px', threshold: 0 }
		);

		for (const el of observed) {
			observer.observe(el);
		}

		return () => observer.disconnect();
	});

	$effect(() => {
		return () => {
			if (timeoutId !== null) {
				clearTimeout(timeoutId);
			}
		};
	});
</script>

<div bind:this={docContainer} class="custom-api-documentation-page">
	<!-- Page header -->
	<header class="docs-page-header">
		<div class="custom-api-page-header min-w-0 flex-1">
			<h2 class="custom-api-title">{$_('custom_api_docs_title')}</h2>
			<p class="custom-api-subtitle">{$_('custom_api_docs_intro')}</p>
		</div>
		<button
			class="docs-copy-button"
			onclick={copyDocumentation}
			title={$_('custom_api_docs_button_copy')}
			type="button"
		>
			{#if copySuccess}
				<Check size={14} />
			{:else}
				<Copy size={14} />
			{/if}
			<span>{$_('custom_api_docs_button_copy')}</span>
		</button>
	</header>

	<div class="docs-layout">
		<!-- TOC sidebar -->
		<nav class="docs-toc" aria-label={$_('custom_api_docs_toc_aria_label')}>
			{#each SECTIONS as section (section.id)}
				<button
					class="docs-toc-link"
					class:active={activeSection === section.id}
					onclick={() => scrollToSection(section.id)}
					type="button"
				>
					{$_(section.labelKey)}
				</button>
			{/each}
		</nav>

		<!-- Main content -->
		<div bind:this={contentRoot} class="docs-content">
			<!-- Overview -->
			<section id="section-overview" class="docs-section">
				<h4 class="docs-section-title">{$_('custom_api_docs_section_overview')}</h4>
				<p class="docs-note">{$_('custom_api_docs_note_overview_what')}</p>
				<p class="docs-note">{$_('custom_api_docs_note_overview_scope')}</p>
				<p class="docs-note">{$_('custom_api_docs_note_overview_reference')}</p>
				<a
					class="docs-external-link-block"
					href={ROTECTOR_DOCS_URL}
					rel="noopener noreferrer"
					target="_blank"
				>
					<span>{ROTECTOR_DOCS_URL}</span>
					<ExternalLink size={11} />
				</a>
			</section>

			<!-- Authentication -->
			<section id="section-authentication" class="docs-section">
				<h4 class="docs-section-title">{$_('custom_api_docs_section_authentication')}</h4>
				<p class="docs-note">{$_('custom_api_docs_note_auth_optional')}</p>
				<p class="docs-note">{$_('custom_api_docs_note_auth_choose')}</p>

				<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_auth_x_token')}</h5>
				<pre class="code-block"><code>X-Auth-Token: your-api-key</code></pre>

				<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_auth_bearer')}</h5>
				<pre class="code-block"><code>Authorization: Bearer your-api-key</code></pre>

				<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_auth_plain')}</h5>
				<pre class="code-block"><code>Authorization: your-api-key</code></pre>
			</section>

			<!-- URL Configuration -->
			<section id="section-url-config" class="docs-section">
				<h4 class="docs-section-title">{$_('custom_api_docs_section_url_config')}</h4>
				<p class="docs-note">{$_('custom_api_docs_note_url_overview')}</p>
				<p class="docs-note">{$_('custom_api_docs_note_url_single')}</p>
				<p class="docs-note">{$_('custom_api_docs_note_url_batch')}</p>
			</section>

			<!-- Endpoints -->
			<section id="section-endpoints" class="docs-section">
				<h4 class="docs-section-title">{$_('custom_api_docs_section_endpoints')}</h4>

				<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_single_lookup')}</h5>
				<div class="docs-endpoint">
					<span class="api-http-method get">{$_('custom_api_mgmt_http_method_get')}</span>
					<code class="endpoint-url">{'{single-lookup-url}'}</code>
				</div>
				<p class="docs-note">{$_('custom_api_docs_note_single_example')}</p>
				<pre class="code-block"><code
						>GET https://api.example.com/v1/lookup/roblox/user/123456789</code
					></pre>
				<h6 class="docs-inline-heading">{$_('custom_api_docs_subtitle_success_response')}</h6>
				<Highlight code={SINGLE_SUCCESS_EXAMPLE} language={json} />

				<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_batch_lookup')}</h5>
				<div class="docs-endpoint">
					<span class="api-http-method post">{$_('custom_api_mgmt_http_method_post')}</span>
					<code class="endpoint-url">{'{batch-url}'}</code>
				</div>
				<p class="docs-note">{$_('custom_api_docs_note_batch_example')}</p>
				<pre class="code-block"><code>POST https://api.example.com/v1/lookup/roblox/user</code
					></pre>
				<h6 class="docs-inline-heading">{$_('custom_api_docs_subtitle_request_body')}</h6>
				<Highlight code={BATCH_REQUEST_EXAMPLE} language={json} />
				<h6 class="docs-inline-heading">{$_('custom_api_docs_subtitle_success_response')}</h6>
				<Highlight code={BATCH_SUCCESS_EXAMPLE} language={json} />
				<p class="docs-note">{$_('custom_api_docs_note_batch_data')}</p>
				<p class="docs-note">{$_('custom_api_docs_note_batch_partial')}</p>
				<p class="docs-note">{$_('custom_api_docs_note_batch_limit')}</p>
			</section>

			<!-- Response Schema -->
			<section id="section-schema" class="docs-section">
				<h4 class="docs-section-title">{$_('custom_api_docs_section_schema')}</h4>
				<p class="docs-note">{$_('custom_api_docs_note_wrapper')}</p>

				<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_required_fields')}</h5>
				<ul class="docs-list">
					<li><code>id</code> &mdash; {$_('custom_api_docs_field_id')}</li>
					<li><code>flagType</code> &mdash; {$_('custom_api_docs_field_flag_type')}</li>
				</ul>

				<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_optional_fields')}</h5>
				<ul class="docs-list">
					<li><code>confidence</code> &mdash; {$_('custom_api_docs_field_confidence')}</li>
					<li>
						<code>reasons</code> &mdash; {$_('custom_api_docs_field_reasons')}
						<ul class="docs-list mt-2 ml-6">
							<li><code>message</code> &mdash; {$_('custom_api_docs_field_message')}</li>
							<li>
								<code>confidence</code> &mdash; {$_('custom_api_docs_field_confidence_reason')}
							</li>
							<li><code>evidence</code> &mdash; {$_('custom_api_docs_field_evidence')}</li>
						</ul>
					</li>
					<li><code>reviewer</code> &mdash; {$_('custom_api_docs_field_reviewer')}</li>
					<li><code>engineVersion</code> &mdash; {$_('custom_api_docs_field_engine_version')}</li>
					<li>
						<code>versionCompatibility</code> &mdash; {$_(
							'custom_api_docs_field_version_compatibility'
						)}
					</li>
					<li><code>isReportable</code> &mdash; {$_('custom_api_docs_field_is_reportable')}</li>
					<li><code>isLocked</code> &mdash; {$_('custom_api_docs_field_is_locked')}</li>
					<li><code>lastUpdated</code> &mdash; {$_('custom_api_docs_field_last_updated')}</li>
					<li>
						<code>badges</code> &mdash; {$_('custom_api_docs_field_badges')}
						<ul class="docs-list mt-2 ml-6">
							<li><code>text</code> &mdash; {$_('custom_api_docs_field_badge_text')}</li>
							<li><code>color</code> &mdash; {$_('custom_api_docs_field_badge_color')}</li>
							<li><code>textColor</code> &mdash; {$_('custom_api_docs_field_badge_text_color')}</li>
						</ul>
					</li>
				</ul>
			</section>

			<!-- Flag Types -->
			<section id="section-flag-types" class="docs-section">
				<h4 class="docs-section-title">{$_('custom_api_docs_section_flag_types')}</h4>
				<p class="docs-note">{$_('custom_api_docs_note_flag_types_intro')}</p>
				<div class="docs-table-wrapper">
					<table class="docs-table">
						<thead>
							<tr>
								<th>{$_('custom_api_docs_table_flag_value')}</th>
								<th>{$_('custom_api_docs_table_flag_name')}</th>
								<th>{$_('custom_api_docs_table_flag_actionable')}</th>
								<th>{$_('custom_api_docs_table_flag_description')}</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td><code>0</code></td>
								<td>{$_('custom_api_docs_flag_row_name_0')}</td>
								<td>{$_('custom_api_docs_flag_row_actionable_0')}</td>
								<td>{$_('custom_api_docs_flag_row_description_0')}</td>
							</tr>
							<tr>
								<td><code>1</code></td>
								<td>{$_('custom_api_docs_flag_row_name_1')}</td>
								<td>{$_('custom_api_docs_flag_row_actionable_1')}</td>
								<td>{$_('custom_api_docs_flag_row_description_1')}</td>
							</tr>
							<tr>
								<td><code>2</code></td>
								<td>{$_('custom_api_docs_flag_row_name_2')}</td>
								<td>{$_('custom_api_docs_flag_row_actionable_2')}</td>
								<td>{$_('custom_api_docs_flag_row_description_2')}</td>
							</tr>
							<tr>
								<td><code>3</code></td>
								<td>{$_('custom_api_docs_flag_row_name_3')}</td>
								<td>{$_('custom_api_docs_flag_row_actionable_3')}</td>
								<td>{$_('custom_api_docs_flag_row_description_3')}</td>
							</tr>
							<tr>
								<td><code>5</code></td>
								<td>{$_('custom_api_docs_flag_row_name_5')}</td>
								<td>{$_('custom_api_docs_flag_row_actionable_5')}</td>
								<td>{$_('custom_api_docs_flag_row_description_5')}</td>
							</tr>
							<tr>
								<td><code>6</code></td>
								<td>{$_('custom_api_docs_flag_row_name_6')}</td>
								<td>{$_('custom_api_docs_flag_row_actionable_6')}</td>
								<td>{$_('custom_api_docs_flag_row_description_6')}</td>
							</tr>
						</tbody>
					</table>
				</div>
				<p class="docs-note">{$_('custom_api_docs_note_flag_type_warning')}</p>
			</section>

			<!-- Reason Types -->
			<section id="section-reason-types" class="docs-section">
				<h4 class="docs-section-title">{$_('custom_api_docs_section_reason_types')}</h4>
				<p class="docs-note">{$_('custom_api_docs_note_reason_types_intro')}</p>
				<ul class="docs-list">
					<li><code>User Profile</code> &mdash; {$_('custom_api_docs_reason_user_profile')}</li>
					<li><code>Friend Network</code> &mdash; {$_('custom_api_docs_reason_friend_network')}</li>
					<li><code>Avatar Outfit</code> &mdash; {$_('custom_api_docs_reason_avatar_outfit')}</li>
					<li>
						<code>Group Membership</code> &mdash; {$_('custom_api_docs_reason_group_membership')}
					</li>
					<li><code>Condo Activity</code> &mdash; {$_('custom_api_docs_reason_condo_activity')}</li>
					<li><code>Chat Messages</code> &mdash; {$_('custom_api_docs_reason_chat_messages')}</li>
					<li><code>Game Favorites</code> &mdash; {$_('custom_api_docs_reason_game_favorites')}</li>
					<li><code>Earned Badges</code> &mdash; {$_('custom_api_docs_reason_earned_badges')}</li>
					<li><code>User Creations</code> &mdash; {$_('custom_api_docs_reason_user_creations')}</li>
					<li><code>Other Reasons</code> &mdash; {$_('custom_api_docs_reason_other')}</li>
				</ul>
				<p class="docs-note">{$_('custom_api_docs_note_reason_types_custom')}</p>
			</section>

			<!-- Errors & Status Codes -->
			<section id="section-errors" class="docs-section">
				<h4 class="docs-section-title">{$_('custom_api_docs_section_errors')}</h4>
				<p class="docs-note">{$_('custom_api_docs_note_errors_intro')}</p>
				<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_error_response')}</h5>
				<Highlight code={ERROR_EXAMPLE} language={json} />
				<p class="docs-note">{$_('custom_api_docs_note_http_status')}</p>
			</section>

			<!-- Requirements -->
			<section id="section-requirements" class="docs-section">
				<h4 class="docs-section-title">{$_('custom_api_docs_section_requirements')}</h4>
				<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_https')}</h5>
				<p class="docs-note">{$_('custom_api_docs_note_https')}</p>
				<h5 class="docs-subtitle">{$_('custom_api_docs_subtitle_cors')}</h5>
				<p class="docs-note">{$_('custom_api_docs_note_cors')}</p>
			</section>

			<!-- Differences vs Rotector API -->
			<section id="section-differences" class="docs-section">
				<h4 class="docs-section-title">{$_('custom_api_docs_section_differences')}</h4>
				<p class="docs-note">{$_('custom_api_docs_note_differences_badges')}</p>
				<p class="docs-note">{$_('custom_api_docs_note_differences_fields')}</p>
				<p class="docs-note">{$_('custom_api_docs_note_differences_endpoints')}</p>
			</section>
		</div>
	</div>
</div>
