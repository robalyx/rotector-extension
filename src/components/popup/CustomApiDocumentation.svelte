<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';
	import Highlight from 'svelte-highlight';
	import json from 'svelte-highlight/languages/json';
	import 'svelte-highlight/styles/github-dark.css';

	interface Props {
		onBack: () => void;
	}

	let { onBack }: Props = $props();
</script>

<div class="custom-api-documentation-page">
	<!-- Header -->
	<div class="custom-api-header">
		<button class="back-button" onclick={onBack} type="button">
			<ArrowLeft size={16} />
			<span>Back</span>
		</button>
		<h2 class="custom-api-title">API Documentation</h2>
	</div>

	<p class="docs-intro">
		Implement two endpoints that return user status data. All responses must use the wrapper format
		with <code>success</code>, <code>data</code>, and <code>error</code> fields.
	</p>

	<!-- Single Lookup Section -->
	<div class="docs-section">
		<h4 class="docs-section-title">Single User Lookup</h4>
		<div class="docs-endpoint">
			<span class="http-method http-method-get">GET</span>
			<code class="endpoint-url">{'{{your-api-url}}/{{userId}}'}</code>
		</div>

		<h5 class="docs-subtitle">Example Request</h5>
		<pre class="code-block"><code>GET https://api.example.com/v1/lookup/roblox/user/123456789</code
			></pre>

		<h5 class="docs-subtitle">Success Response</h5>
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

		<h5 class="docs-subtitle">Error Response</h5>
		<Highlight
			code={JSON.stringify(
				{
					success: false,
					error: 'User not found in database'
				},
				null,
				2
			)}
			language={json}
		/>

		<h5 class="docs-subtitle">Required Fields (in data object)</h5>
		<ul class="docs-list">
			<li><code>id</code> (number) - User ID as integer</li>
			<li><code>flagType</code> (number) - 0-6 flag type (see below)</li>
		</ul>

		<h5 class="docs-subtitle">Optional Fields (in data object)</h5>
		<ul class="docs-list">
			<li><code>confidence</code> (number) - 0.0-1.0 confidence level</li>
			<li>
				<code>reasons</code> (object) - String-based reason names as keys, each with:
				<ul class="docs-list ml-6 mt-2">
					<li><code>message</code> (string) - Reason description</li>
					<li><code>confidence</code> (number) - 0.0-1.0 confidence</li>
					<li><code>evidence</code> (array or null) - Evidence strings or null</li>
				</ul>
			</li>
			<li>
				<code>reviewer</code> (object) - <code>username</code> and <code>displayName</code>
			</li>
			<li><code>engineVersion</code> (string) - Analysis engine version</li>
			<li><code>lastUpdated</code> (number) - Unix timestamp</li>
			<li>
				<code>badges</code> (array) - Up to 3 custom badge objects for visual status indicators
				<ul class="docs-list ml-6 mt-2">
					<li><code>text</code> (string, required) - Badge label text</li>
					<li>
						<code>color</code> (string, optional) - Background color (hex, rgb, or named color)
					</li>
					<li><code>textColor</code> (string, optional) - Text color for contrast</li>
				</ul>
			</li>
		</ul>

		<h5 class="docs-subtitle">Flag Types</h5>
		<ul class="docs-list">
			<li><code>0</code> - Safe</li>
			<li><code>1</code> - Pending</li>
			<li><code>2</code> - Unsafe (recommended)</li>
			<li><code>3</code> - Queued</li>
			<li><code>4</code> - Unused</li>
			<li><code>5</code> - Mixed</li>
			<li><code>6</code> - Past Offender</li>
		</ul>
		<p class="docs-note">
			Flag type 2 (Unsafe) is the primary type you need for indicating inappropriate users. Use
			other flag types only if you have a specific reason for categorizing users differently.
		</p>
	</div>

	<!-- Batch Lookup Section -->
	<div class="docs-section">
		<h4 class="docs-section-title">Batch User Lookup</h4>
		<div class="docs-endpoint">
			<span class="http-method">POST</span>
			<code class="endpoint-url">{'{{your-api-url}}'}</code>
		</div>

		<h5 class="docs-subtitle">Example Request</h5>
		<pre class="code-block"><code>POST https://api.example.com/v1/lookup/roblox/user</code></pre>

		<h5 class="docs-subtitle">Request Body</h5>
		<Highlight code={JSON.stringify({ ids: [123456789, 987654321] }, null, 2)} language={json} />

		<h5 class="docs-subtitle">Success Response</h5>
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

		<h5 class="docs-subtitle">Error Response</h5>
		<Highlight
			code={JSON.stringify(
				{
					success: false,
					error: 'Batch size exceeds maximum limit of 100 users'
				},
				null,
				2
			)}
			language={json}
		/>

		<p class="docs-note">
			The <code>data</code> field contains an object where keys are user IDs (as strings) and values
			are user status objects.
		</p>
	</div>

	<!-- Notes Section -->
	<div class="docs-section">
		<h4 class="docs-section-title">Important Notes</h4>

		<h5 class="docs-subtitle">HTTPS Required</h5>
		<p class="docs-note">All API endpoints must use HTTPS for security.</p>

		<h5 class="docs-subtitle">Wrapper Format</h5>
		<p class="docs-note">
			All responses must use <code>{'{success, data, error}'}</code> format. When
			<code>success: true</code>, include <code>data</code> field. When
			<code>success: false</code>, include <code>error</code> message.
		</p>

		<h5 class="docs-subtitle">Reason Keys</h5>
		<p class="docs-note">
			Use descriptive string names for reason keys (e.g., "High Risk Pattern", "Suspicious
			Activity"), not numeric indices. These display directly in tooltips.
		</p>

		<h5 class="docs-subtitle">Badges</h5>
		<p class="docs-note">
			Badges are small visual indicators that appear in user tooltips alongside the flag status.
			They display at the top of the tooltip to quickly communicate additional context about a user.
			Use badges to highlight important status information like verification status, priority
			levels, or special categories. Common examples: "Verified Unsafe", "High Priority", "Community
			Reported", "Auto-Detected".
		</p>

		<h5 class="docs-subtitle">Badge Colors</h5>
		<p class="docs-note">
			Badge colors support multiple formats: hex codes (<code>#ef4444</code>), RGB (<code
				>rgb(239, 68, 68)</code
			>), RGBA (<code>rgba(239, 68, 68, 0.9)</code>), or named colors (<code>red</code>). When
			<code>color</code>
			is not specified, badges use a default teal color. When <code>textColor</code> is not specified,
			badges use white text.
		</p>
	</div>
</div>
