<script lang="ts">
	import { ArrowLeft, Copy, Check } from 'lucide-svelte';
	import Highlight from 'svelte-highlight';
	import json from 'svelte-highlight/languages/json';
	import javascript from 'svelte-highlight/languages/javascript';
	import typescript from 'svelte-highlight/languages/typescript';
	import python from 'svelte-highlight/languages/python';
	import go from 'svelte-highlight/languages/go';
	import lua from 'svelte-highlight/languages/lua';
	import 'svelte-highlight/styles/github-dark.css';
	import TurndownService from 'turndown';
	import { t } from '@/lib/stores/i18n';
	import { logger } from '@/lib/utils/logger';

	interface Props {
		onBack: () => void;
	}

	let { onBack }: Props = $props();

	type Language = 'javascript' | 'typescript' | 'python' | 'go' | 'lua';
	let activeLanguageTab = $state<Language>('javascript');

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
				<span>{t('rotector_api_docs_button_back')}</span>
			</button>
			<button
				class="copy-button"
				onclick={copyDocumentation}
				title={t('custom_api_docs_button_copy')}
				type="button"
			>
				{#if copySuccess}
					<Check size={16} />
				{:else}
					<Copy size={16} />
				{/if}
			</button>
		</div>
		<h2 class="custom-api-title">{t('rotector_api_docs_title')}</h2>
	</div>

	<p class="docs-intro">
		{t('rotector_api_docs_intro')}
	</p>

	<!-- Authentication Section -->
	<div class="docs-section">
		<h4 class="docs-section-title">{t('rotector_api_docs_section_authentication')}</h4>
		<p class="docs-note">
			{t('rotector_api_docs_note_no_auth')}
		</p>
	</div>

	<!-- HTTP Status Codes Section -->
	<div class="docs-section">
		<h4 class="docs-section-title">{t('rotector_api_docs_section_http_status')}</h4>
		<p class="docs-note">
			{t('rotector_api_docs_note_http_status')}
		</p>
	</div>

	<!-- CORS Support Section -->
	<div class="docs-section">
		<h4 class="docs-section-title">{t('rotector_api_docs_section_cors')}</h4>
		<p class="docs-note">
			{t('rotector_api_docs_note_cors')}
		</p>
	</div>

	<!-- Single User Lookup Section -->
	<div class="docs-section">
		<h4 class="docs-section-title">{t('rotector_api_docs_section_single_lookup')}</h4>
		<div class="docs-endpoint">
			<span class="http-method http-method-get">{t('custom_api_mgmt_http_method_get')}</span>
			<code class="endpoint-url">https://roscoe.robalyx.com/v1/lookup/roblox/user/{'{userId}'}</code
			>
		</div>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_example_request')}</h5>
		<pre class="code-block"><code
				>GET https://roscoe.robalyx.com/v1/lookup/roblox/user/1234567890</code
			></pre>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_code_examples')}</h5>

		<!-- Language Tabs -->
		<div class="code-tabs">
			<button
				class="code-tab"
				class:active={activeLanguageTab === 'javascript'}
				onclick={() => (activeLanguageTab = 'javascript')}
				type="button"
			>
				JS
			</button>
			<button
				class="code-tab"
				class:active={activeLanguageTab === 'typescript'}
				onclick={() => (activeLanguageTab = 'typescript')}
				type="button"
			>
				TS
			</button>
			<button
				class="code-tab"
				class:active={activeLanguageTab === 'python'}
				onclick={() => (activeLanguageTab = 'python')}
				type="button"
			>
				Python
			</button>
			<button
				class="code-tab"
				class:active={activeLanguageTab === 'go'}
				onclick={() => (activeLanguageTab = 'go')}
				type="button"
			>
				Go
			</button>
			<button
				class="code-tab"
				class:active={activeLanguageTab === 'lua'}
				onclick={() => (activeLanguageTab = 'lua')}
				type="button"
			>
				Lua
			</button>
		</div>

		<!-- Code Examples -->
		<div class="code-content">
			{#if activeLanguageTab === 'javascript'}
				<Highlight
					code={`async function checkUser(userId) {
  const response = await fetch(
    \`https://roscoe.robalyx.com/v1/lookup/roblox/user/\${userId}\`
  );

  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }

  const result = await response.json();
  return result.data;
}

// Usage
try {
  const user = await checkUser(1234567890);
  console.log('Flag Type:', user.flagType);
  console.log('Confidence:', user.confidence);
} catch (error) {
  console.error('Error checking user:', error);
}`}
					language={javascript}
				/>
			{:else if activeLanguageTab === 'typescript'}
				<Highlight
					code={`interface Reason {
  message: string;
  confidence: number;
  evidence: string[] | null;
}

interface Reviewer {
  username: string;
  displayName: string;
}

interface UserStatus {
  id: number;
  flagType: number;
  confidence?: number;
  reasons?: Record<string, Reason>;
  reviewer?: Reviewer;
  engineVersion?: string;
  versionCompatibility?: string;
  lastUpdated?: number;
}

interface ApiResponse {
  success: boolean;
  data?: UserStatus;
  error?: string;
}

async function checkUser(userId: number): Promise<UserStatus> {
  const response = await fetch(
    \`https://roscoe.robalyx.com/v1/lookup/roblox/user/\${userId}\`
  );

  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }

  const result: ApiResponse = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch user data');
  }

  return result.data;
}

// Usage
try {
  const user: UserStatus = await checkUser(1234567890);
  console.log('Flag Type:', user.flagType);
  console.log('Confidence:', user.confidence);
} catch (error) {
  console.error('Error checking user:', error);
}`}
					language={typescript}
				/>
			{:else if activeLanguageTab === 'python'}
				<Highlight
					code={`import requests

def check_user(user_id):
    url = f"https://roscoe.robalyx.com/v1/lookup/roblox/user/{user_id}"

    response = requests.get(url)
    response.raise_for_status()

    result = response.json()
    return result["data"]

# Usage
try:
    user = check_user(1234567890)
    print(f"Flag Type: {user['flagType']}")
    print(f"Confidence: {user.get('confidence', 'N/A')}")
except requests.exceptions.RequestException as e:
    print(f"Error checking user: {e}")`}
					language={python}
				/>
			{:else if activeLanguageTab === 'go'}
				<Highlight
					code={`package main

import (
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

type UserStatus struct {
    ID         int64              \`json:"id"\`
    FlagType   int                \`json:"flagType"\`
    Confidence float64            \`json:"confidence,omitempty"\`
    Reasons    map[string]Reason  \`json:"reasons,omitempty"\`
}

type Reason struct {
    Message    string   \`json:"message"\`
    Confidence float64  \`json:"confidence"\`
    Evidence   []string \`json:"evidence,omitempty"\`
}

type Response struct {
    Success bool       \`json:"success"\`
    Data    UserStatus \`json:"data"\`
}

func checkUser(userID int64) (*UserStatus, error) {
    url := fmt.Sprintf("https://roscoe.robalyx.com/v1/lookup/roblox/user/%d", userID)

    resp, err := http.Get(url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    var result Response
    if err := json.Unmarshal(body, &result); err != nil {
        return nil, err
    }

    return &result.Data, nil
}

func main() {
    user, err := checkUser(1234567890)
    if err != nil {
        fmt.Printf("Error: %v\\n", err)
        return
    }

    fmt.Printf("Flag Type: %d\\n", user.FlagType)
    fmt.Printf("Confidence: %.2f\\n", user.Confidence)
}`}
					language={go}
				/>
			{:else if activeLanguageTab === 'lua'}
				<Highlight
					code={`local HttpService = game:GetService("HttpService")

local function checkUser(userId)
    local url = string.format(
        "https://roscoe.robalyx.com/v1/lookup/roblox/user/%d",
        userId
    )

    local success, response = pcall(function()
        return HttpService:RequestAsync({
            Url = url,
            Method = "GET"
        })
    end)

    if not success then
        warn("Error making request:", response)
        return nil
    end

    if not response.Success then
        warn("HTTP error:", response.StatusCode, response.StatusMessage)
        return nil
    end

    local result = HttpService:JSONDecode(response.Body)
    return result.data
end

-- Usage
local user = checkUser(1234567890)
if user then
    print("Flag Type:", user.flagType)
    print("Confidence:", user.confidence or "N/A")
else
    print("Failed to check user")
end`}
					language={lua}
				/>
			{/if}
		</div>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_success_response')}</h5>
		<Highlight
			code={JSON.stringify(
				{
					success: true,
					data: {
						id: 1234567890,
						flagType: 2,
						confidence: 0.95,
						reasons: {
							'Inappropriate Content': {
								message:
									'The user profile contains content that violates platform safety guidelines',
								confidence: 0.9,
								evidence: ['Evidence item 1', 'Evidence item 2']
							},
							'Network Analysis': {
								message: 'This account demonstrates patterns of associating with flagged accounts',
								confidence: 0.85,
								evidence: null
							}
						},
						reviewer: {
							username: 'system_reviewer',
							displayName: 'System Reviewer'
						},
						engineVersion: '2.17',
						versionCompatibility: 'compatible',
						lastUpdated: 1762158166
					}
				},
				null,
				2
			)}
			language={json}
		/>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_error_response')}</h5>
		<p class="docs-note mb-3">
			{t('rotector_api_docs_note_http_status')}
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
	</div>

	<!-- Batch User Lookup Section -->
	<div class="docs-section">
		<h4 class="docs-section-title">{t('rotector_api_docs_section_batch_lookup')}</h4>
		<div class="docs-endpoint">
			<span class="http-method">{t('custom_api_mgmt_http_method_post')}</span>
			<code class="endpoint-url">https://roscoe.robalyx.com/v1/lookup/roblox/user</code>
		</div>

		<p class="docs-note mb-3">
			{t('rotector_api_docs_batch_intro')}
		</p>
		<p class="docs-note">
			{t('rotector_api_docs_note_batch_limit')}
		</p>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_request_body')}</h5>
		<Highlight
			code={JSON.stringify(
				{
					ids: [1234567890, 9876543210, 5555555555]
				},
				null,
				2
			)}
			language={json}
		/>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_code_examples')}</h5>

		<!-- Language Tabs for Batch -->
		<div class="code-tabs">
			<button
				class="code-tab"
				class:active={activeLanguageTab === 'javascript'}
				onclick={() => (activeLanguageTab = 'javascript')}
				type="button"
			>
				JS
			</button>
			<button
				class="code-tab"
				class:active={activeLanguageTab === 'typescript'}
				onclick={() => (activeLanguageTab = 'typescript')}
				type="button"
			>
				TS
			</button>
			<button
				class="code-tab"
				class:active={activeLanguageTab === 'python'}
				onclick={() => (activeLanguageTab = 'python')}
				type="button"
			>
				Python
			</button>
			<button
				class="code-tab"
				class:active={activeLanguageTab === 'go'}
				onclick={() => (activeLanguageTab = 'go')}
				type="button"
			>
				Go
			</button>
			<button
				class="code-tab"
				class:active={activeLanguageTab === 'lua'}
				onclick={() => (activeLanguageTab = 'lua')}
				type="button"
			>
				Lua
			</button>
		</div>

		<!-- Code Examples for Batch -->
		<div class="code-content">
			{#if activeLanguageTab === 'javascript'}
				<Highlight
					code={`async function checkMultipleUsers(userIds) {
  const response = await fetch(
    'https://roscoe.robalyx.com/v1/lookup/roblox/user',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids: userIds })
    }
  );

  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }

  const result = await response.json();
  return result.data;
}

// Usage
try {
  const users = await checkMultipleUsers([1234567890, 9876543210]);

  for (const [userId, userData] of Object.entries(users)) {
    console.log(\`User \${userId}: Flag Type \${userData.flagType}\`);
  }
} catch (error) {
  console.error('Error checking users:', error);
}`}
					language={javascript}
				/>
			{:else if activeLanguageTab === 'typescript'}
				<Highlight
					code={`interface Reason {
  message: string;
  confidence: number;
  evidence: string[] | null;
}

interface Reviewer {
  username: string;
  displayName: string;
}

interface UserStatus {
  id: number;
  flagType: number;
  confidence?: number;
  reasons?: Record<string, Reason>;
  reviewer?: Reviewer;
  engineVersion?: string;
  versionCompatibility?: string;
  lastUpdated?: number;
}

interface BatchRequest {
  ids: number[];
}

interface BatchApiResponse {
  success: boolean;
  data?: Record<string, UserStatus>;
  error?: string;
}

async function checkMultipleUsers(userIds: number[]): Promise<Record<string, UserStatus>> {
  const response = await fetch(
    'https://roscoe.robalyx.com/v1/lookup/roblox/user',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids: userIds } as BatchRequest)
    }
  );

  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }

  const result: BatchApiResponse = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch users data');
  }

  return result.data;
}

// Usage
try {
  const users: Record<string, UserStatus> = await checkMultipleUsers([1234567890, 9876543210]);

  for (const [userId, userData] of Object.entries(users)) {
    console.log(\`User \${userId}: Flag Type \${userData.flagType}\`);
  }
} catch (error) {
  console.error('Error checking users:', error);
}`}
					language={typescript}
				/>
			{:else if activeLanguageTab === 'python'}
				<Highlight
					code={`import requests

def check_multiple_users(user_ids):
    url = "https://roscoe.robalyx.com/v1/lookup/roblox/user"
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "ids": user_ids
    }

    response = requests.post(url, headers=headers, json=payload)
    response.raise_for_status()

    result = response.json()
    return result["data"]

# Usage
try:
    users = check_multiple_users([1234567890, 9876543210])

    for user_id, user_data in users.items():
        print(f"User {user_id}: Flag Type {user_data['flagType']}")
except requests.exceptions.RequestException as e:
    print(f"Error checking users: {e}")`}
					language={python}
				/>
			{:else if activeLanguageTab === 'go'}
				<Highlight
					code={`package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

type BatchRequest struct {
    IDs []int64 \`json:"ids"\`
}

type BatchResponse struct {
    Success bool                   \`json:"success"\`
    Data    map[string]UserStatus  \`json:"data"\`
}

func checkMultipleUsers(userIDs []int64) (map[string]UserStatus, error) {
    url := "https://roscoe.robalyx.com/v1/lookup/roblox/user"

    payload := BatchRequest{
        IDs: userIDs,
    }

    jsonData, err := json.Marshal(payload)
    if err != nil {
        return nil, err
    }

    req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, err
    }

    req.Header.Set("Content-Type", "application/json")

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    var result BatchResponse
    if err := json.Unmarshal(body, &result); err != nil {
        return nil, err
    }

    return result.Data, nil
}

func main() {
    users, err := checkMultipleUsers([]int64{1234567890, 9876543210})
    if err != nil {
        fmt.Printf("Error: %v\\n", err)
        return
    }

    for userID, userData := range users {
        fmt.Printf("User %s: Flag Type %d\\n", userID, userData.FlagType)
    }
}`}
					language={go}
				/>
			{:else if activeLanguageTab === 'lua'}
				<Highlight
					code={`local HttpService = game:GetService("HttpService")

local function checkMultipleUsers(userIds)
    local url = "https://roscoe.robalyx.com/v1/lookup/roblox/user"

    local payload = {
        ids = userIds
    }

    local success, response = pcall(function()
        return HttpService:RequestAsync({
            Url = url,
            Method = "POST",
            Headers = {
                ["Content-Type"] = "application/json"
            },
            Body = HttpService:JSONEncode(payload)
        })
    end)

    if not success then
        warn("Error making request:", response)
        return nil
    end

    if not response.Success then
        warn("HTTP error:", response.StatusCode, response.StatusMessage)
        return nil
    end

    local result = HttpService:JSONDecode(response.Body)
    return result.data
end

-- Usage
local users = checkMultipleUsers({1234567890, 9876543210})
if users then
    for userId, userData in pairs(users) do
        print(string.format("User %s: Flag Type %d", userId, userData.flagType))
    end
else
    print("Failed to check users")
end`}
					language={lua}
				/>
			{/if}
		</div>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_success_response')}</h5>
		<Highlight
			code={JSON.stringify(
				{
					success: true,
					data: {
						'1234567890': {
							id: 1234567890,
							flagType: 2,
							confidence: 0.95,
							reasons: {
								'Risk Pattern': {
									message: 'Account exhibits concerning behavioral patterns',
									confidence: 0.9,
									evidence: null
								}
							},
							engineVersion: '2.25',
							versionCompatibility: 'current',
							lastUpdated: 1761358239
						},
						'9876543210': {
							id: 9876543210,
							flagType: 0
						},
						'5555555555': {
							id: 5555555555,
							flagType: 1,
							confidence: 0.65
						}
					}
				},
				null,
				2
			)}
			language={json}
		/>

		<p class="docs-note mb-3">
			{t('rotector_api_docs_batch_note')}
		</p>
		<p class="docs-note">
			{t('rotector_api_docs_note_batch_all_users')}
		</p>
	</div>

	<!-- Response Schema Section -->
	<div class="docs-section">
		<h4 class="docs-section-title">{t('rotector_api_docs_section_response_schema')}</h4>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_required_fields')}</h5>
		<ul class="docs-list">
			<li><code>id</code> - {t('rotector_api_docs_field_id')}</li>
			<li><code>flagType</code> - {t('rotector_api_docs_field_flag_type')}</li>
		</ul>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_optional_fields')}</h5>
		<ul class="docs-list">
			<li><code>confidence</code> - {t('rotector_api_docs_field_confidence')}</li>
			<li>
				<code>reasons</code> - {t('rotector_api_docs_field_reasons')}
				<ul class="docs-list ml-6 mt-2">
					<li><code>message</code> - {t('rotector_api_docs_field_message')}</li>
					<li><code>confidence</code> - {t('rotector_api_docs_field_confidence_reason')}</li>
					<li><code>evidence</code> - {t('rotector_api_docs_field_evidence')}</li>
				</ul>
			</li>
			<li>
				<code>reviewer</code> - {t('rotector_api_docs_field_reviewer')}
				<ul class="docs-list ml-6 mt-2">
					<li><code>username</code> - {t('rotector_api_docs_field_username')}</li>
					<li><code>displayName</code> - {t('rotector_api_docs_field_display_name')}</li>
				</ul>
			</li>
			<li><code>engineVersion</code> - {t('rotector_api_docs_field_engine_version')}</li>
			<li>
				<code>versionCompatibility</code> - {t('rotector_api_docs_field_version_compatibility')}
			</li>
			<li><code>lastUpdated</code> - {t('rotector_api_docs_field_last_updated')}</li>
		</ul>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_flag_types')}</h5>
		<ul class="docs-list">
			<li><code>0</code> - {t('rotector_api_docs_flag_type_0')}</li>
			<li><code>1</code> - {t('rotector_api_docs_flag_type_1')}</li>
			<li><code>2</code> - {t('rotector_api_docs_flag_type_2')}</li>
			<li><code>3</code> - {t('rotector_api_docs_flag_type_3')}</li>
			<li><code>4</code> - {t('rotector_api_docs_flag_type_4')}</li>
			<li><code>5</code> - {t('rotector_api_docs_flag_type_5')}</li>
			<li><code>6</code> - {t('rotector_api_docs_flag_type_6')}</li>
		</ul>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_field_presence')}</h5>
		<ul class="docs-list">
			<li><code>confidence</code> - {t('rotector_api_docs_note_field_confidence')}</li>
			<li><code>reasons</code> - {t('rotector_api_docs_note_field_reasons')}</li>
			<li><code>reviewer</code> - {t('rotector_api_docs_note_field_reviewer')}</li>
			<li>
				<code>versionCompatibility</code> - {t(
					'rotector_api_docs_note_field_version_compatibility'
				)}
			</li>
		</ul>
	</div>

	<!-- Rate Limiting & Best Practices -->
	<div class="docs-section">
		<h4 class="docs-section-title">{t('rotector_api_docs_section_best_practices')}</h4>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_rate_limiting')}</h5>
		<ul class="docs-list">
			<li>{t('rotector_api_docs_rate_limit_1')}</li>
			<li>{t('rotector_api_docs_rate_limit_2')}</li>
		</ul>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_batch_recommendations')}</h5>
		<ul class="docs-list">
			<li>{t('rotector_api_docs_batch_rec_1')}</li>
			<li>{t('rotector_api_docs_batch_rec_2')}</li>
			<li>{t('rotector_api_docs_batch_rec_3')}</li>
		</ul>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_error_handling')}</h5>
		<ul class="docs-list">
			<li>{t('rotector_api_docs_error_handling_1')}</li>
			<li>{t('rotector_api_docs_error_handling_2')}</li>
			<li>{t('rotector_api_docs_error_handling_3')}</li>
		</ul>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_response_time')}</h5>
		<p class="docs-note">
			{t('rotector_api_docs_note_response_time')}
		</p>
	</div>

	<!-- Additional Notes Section -->
	<div class="docs-section">
		<h4 class="docs-section-title">{t('rotector_api_docs_section_notes')}</h4>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_https')}</h5>
		<p class="docs-note">{t('rotector_api_docs_note_https')}</p>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_wrapper_format')}</h5>
		<p class="docs-note">
			{t('rotector_api_docs_note_wrapper_format')}
		</p>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_caching')}</h5>
		<p class="docs-note">
			{t('rotector_api_docs_note_caching')}
		</p>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_safe_users')}</h5>
		<p class="docs-note">
			{t('rotector_api_docs_note_safe_users')}
		</p>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_support')}</h5>
		<p class="docs-note">
			{t('rotector_api_docs_note_support')}
		</p>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_timestamp_format')}</h5>
		<p class="docs-note">
			{t('rotector_api_docs_note_timestamp_format')}
		</p>

		<h5 class="docs-subtitle">{t('rotector_api_docs_subtitle_version_compatibility_values')}</h5>
		<ul class="docs-list">
			<li><code>current</code> - {t('rotector_api_docs_note_version_compatibility_current')}</li>
			<li>
				<code>compatible</code> - {t('rotector_api_docs_note_version_compatibility_compatible')}
			</li>
			<li>
				<code>outdated</code> - {t('rotector_api_docs_note_version_compatibility_outdated')}
			</li>
			<li>
				<code>deprecated</code> - {t('rotector_api_docs_note_version_compatibility_deprecated')}
			</li>
		</ul>
	</div>
</div>
