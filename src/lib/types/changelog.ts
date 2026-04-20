export interface ChangelogEntry {
	type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
	description: string;
	subpoints?: string[];
}

export interface Changelog {
	id: string;
	version: string;
	date: string;
	title: string;
	summary: string;
	changes: ChangelogEntry[];
}

// Current changelog data
export const CHANGELOGS: Changelog[] = [
	{
		id: 'v2.16.0',
		version: '2.16.0',
		date: '2026-04-24',
		title: 'UI Redesign & Feature Expansion',
		summary:
			'A major UI refresh across the stats, settings, report helper, modals, and friend warning, alongside new detection tools, quality-of-life improvements, and a broad set of bug fixes.',
		changes: [
			{
				type: 'added',
				description:
					'Outfit thumbnails - Flagged outfit evidence in tooltips shows a preview of what the outfit looked like when it was detected'
			},
			{
				type: 'added',
				description:
					'Bio decoder - Detects Caesar cipher, Morse code, and binary-encoded text in profile bios and shows a one-click decode chip'
			},
			{
				type: 'added',
				description: 'Outfit image viewer - Click any outfit thumbnail to see it full size'
			},
			{
				type: 'added',
				description:
					'Info icon hints - Unseen info icons in tooltips pulse gently until hovered, making extra context easier to discover'
			},
			{
				type: 'added',
				description:
					'Outfit viewer everywhere - The 3D outfit viewer is accessible from all tooltip contexts, not just the profile page'
			},
			{
				type: 'added',
				description:
					'Custom API auth header - Pick X-Auth-Token, Authorization Bearer, or plain Authorization when configuring an API key. Header choice is preserved in exported configs.'
			},
			{
				type: 'changed',
				description:
					'Stats page - New activity charts with 24h, 7d, and 30d views, a quick-glance totals bar, and a community funding progress display'
			},
			{
				type: 'changed',
				description:
					'Settings page - Settings are grouped into collapsible sections that show how many options are on or off at a glance'
			},
			{
				type: 'changed',
				description:
					'Report helper - Slimmed down to a compact bar that shows auto-fill status and lets you reveal evidence details on demand'
			},
			{
				type: 'changed',
				description:
					'Modals and buttons - Cleaner look with consistent button styles and improved checkbox designs across all popups'
			},
			{
				type: 'changed',
				description:
					'Auto-confirm labels - Tooltips now show whether a flagged user was verified by a moderator or confirmed automatically'
			},
			{
				type: 'changed',
				description:
					'Tooltip notices - Reportable and outfit-only banners replaced with smaller indicators next to reason headers'
			},
			{
				type: 'changed',
				description: 'Safe reasons - More explanations for why a user was not flagged'
			},
			{
				type: 'changed',
				description: 'Wording updates - References to "AI" changed to "our system" for clarity'
			},
			{
				type: 'changed',
				description:
					'Outfit viewer layout - Warning and reason details below the 3D viewer use a cleaner text-based design'
			},
			{
				type: 'changed',
				description:
					'Friend warning - Redesigned with a user card, per-violation confidence, and source evidence bullets'
			},
			{
				type: 'changed',
				description:
					'Status lookups - List pages warm a shared cache so opening a tooltip or profile for a user you just scrolled past skips the network round trip, and pending lookups cancel when you navigate away'
			},
			{
				type: 'fixed',
				description:
					'Custom API toggle - Enabling an API that needs browser permission no longer leaves the toggle in a stuck state. Accept to enable, deny to keep disabled; no refresh needed.'
			},
			{
				type: 'fixed',
				description:
					'Custom API meta - Rotector system card no longer shows a meaningless Jan 1, 1970 creation date and fixed timeout'
			},
			{
				type: 'fixed',
				description:
					"Custom API empty results - Users omitted from a batch response now show as 'No data available for this API' in the tooltip header instead of displaying as an error. Empty-result tabs appear slightly dimmed."
			},
			{
				type: 'fixed',
				description:
					'Report auto-fill - Category and comment fields now fill in correctly on the Roblox report page'
			},
			{
				type: 'fixed',
				description:
					'Group members - Status icons no longer freeze when switching roles or pages quickly'
			},
			{
				type: 'fixed',
				description:
					'Queue history - Fast submissions no longer create duplicate or invalid entries'
			},
			{
				type: 'fixed',
				description:
					'Tooltip sizing - Safe user and group tooltips shrink to fit their content instead of staying oversized'
			},
			{
				type: 'fixed',
				description:
					'Connection errors - Network failures now retry and show a clear message instead of a raw error'
			},
			{
				type: 'fixed',
				description:
					'Evidence overflow - Long text and URLs in evidence no longer run off the edge of the tooltip'
			},
			{
				type: 'fixed',
				description:
					'Info popovers - Hover info boxes in the tooltip no longer get clipped by the scroll area'
			},
			{
				type: 'fixed',
				description:
					'Tooltip position - Preview tooltip no longer snaps to the top-left corner when navigating carousels or member lists quickly'
			},
			{
				type: 'fixed',
				description:
					'Profile tooltip name - Expanded tooltip no longer shows "Unknown User" when opened before Roblox finishes loading the profile header'
			},
			{
				type: 'fixed',
				description:
					'Bio emojis - Emojis from roseal extension in flagged bios now render at text size instead of stretching to full image dimensions'
			},
			{
				type: 'fixed',
				description:
					'3D outfit viewer - Outfit models now load correctly instead of failing with authentication errors'
			},
			{
				type: 'fixed',
				description:
					'Add friend warning - Modal now appears on flagged profiles again after a Roblox UI update broke detection of the Add Friend button'
			},
			{
				type: 'fixed',
				description:
					'Block from warning - Blocking a user from the warning modal works again and refreshes the profile afterward'
			},
			{
				type: 'fixed',
				description:
					'Custom API warnings - Friend warning modal shows the correct confidence and reasons when a user is flagged only by a custom API'
			},
			{
				type: 'fixed',
				description:
					'Translation fallback - Missing translations fall back to English text instead of showing raw message IDs'
			},
			{
				type: 'fixed',
				description:
					'Tooltip tab jitter - Active tab no longer switches under you as custom API responses arrive out of order'
			},
			{
				type: 'fixed',
				description:
					'Tooltip loading timeout - Stalled requests surface an error after 15 seconds instead of spinning forever'
			},
			{
				type: 'removed',
				description:
					'Tooltip badges - Reportable and queued pill badges removed from tooltip header'
			}
		]
	},
	{
		id: 'v2.15.1',
		version: '2.15.1',
		date: '2026-03-23',
		title: 'Group Configure & 3D Viewer Fixes',
		summary:
			'This patch fixes the group configure members page for the updated Roblox UI and resolves 3D viewer compatibility with the new Roblox OBJ format.',
		changes: [
			{
				type: 'fixed',
				description:
					'Group configure members page - Updated logic for the new Roblox v2 members UI, restoring the export button, status indicators, and blur functionality'
			},
			{
				type: 'fixed',
				description:
					'Group configure blur mapping - Blur settings now correctly use the groups page toggle instead of piggybacking on the friends page setting'
			},
			{
				type: 'fixed',
				description:
					'3D viewer - Handle Roblox OBJ vertex colors and MTL format changes that caused model rendering to fail'
			},
			{
				type: 'fixed',
				description:
					'3D viewer skin color - Heads now display the correct skin tone instead of appearing white'
			},
			{
				type: 'fixed',
				description:
					'Members export on Firefox - Export no longer fails with a cloning error when triggered from the group configure page'
			},
			{
				type: 'fixed',
				description:
					'Group configure blur reveal - Safe users on the group members page are no longer stuck with blurred names and avatars'
			}
		]
	},
	{
		id: 'v2.15.0',
		version: '2.15.0',
		date: '2026-03-11',
		title: 'Friends Scan, Group Exports & Tooltip Customization',
		summary:
			'This update introduces friends page scanning, group member exports and resizable tooltips with compact headers, alongside numerous changes and bug fixes.',
		changes: [
			{
				type: 'added',
				description:
					'Friends scan - Automatically scans all friends on the friends page and displays a summary bar'
			},
			{
				type: 'added',
				description: 'Tracked users inactive indicator - Users who left the group appear grayed out'
			},
			{
				type: 'added',
				description:
					'Tracked users membership filter - Dropdown to filter tracked users by active members, users who left, or all'
			},
			{
				type: 'added',
				description:
					'Export tracked users - Export flagged, confirmed, and mixed-status group members as JSON or CSV from the group configure members page'
			},
			{
				type: 'added',
				description:
					'Tooltip resizing - Preview and expanded tooltips can be resized via drag handle'
			},
			{
				type: 'added',
				description:
					'Compact header toggle - Click the bottom edge of the expanded tooltip header to collapse it into a two-column layout'
			},
			{
				type: 'added',
				description:
					'Discord server grace period - Hourglass icon indicates when a member had not yet passed the grace period at last check'
			},
			{
				type: 'added',
				description:
					'Discord first seen - Server entries show when a member was first observed when the join date is unavailable'
			},
			{
				type: 'added',
				description:
					'Stricter evaluation indicator - Hoverable info icon on profile reason headers explains when the system applied stricter standards'
			},
			{
				type: 'added',
				description:
					'Trap detection info - Hoverable info icon on Trap source badges explains how trap game detection works with a link to the blog post'
			},
			{
				type: 'added',
				description:
					'Discord detection info - Hoverable info icon on Discord source badges explains zero false positive verification and date field meanings'
			},
			{
				type: 'added',
				description:
					'Source-tagged evidence display - Reason messages with [Source] prefixes now visually distinct for readability'
			},
			{
				type: 'added',
				description:
					'Custom API authentication - Optional API key support for custom APIs, sent via X-Auth-Token header matching the Rotector API convention'
			},
			{
				type: 'added',
				description:
					'Safe user explanation - Queued users found safe now show an expandable list of possible reasons why they were not flagged'
			},
			{
				type: 'added',
				description:
					'Anonymous reviewer indicator - Info icon with hover popover clarifies when a reviewer has chosen to remain anonymous'
			},
			{
				type: 'changed',
				description:
					'Style isolation - Tooltips, modals, and onboarding are now isolated from Roblox page styles to prevent visual glitches'
			},
			{
				type: 'changed',
				description:
					'Custom API URL configuration - Custom APIs now define separate single lookup and batch URLs directly instead of a base URL with appended paths'
			},
			{
				type: 'changed',
				description: 'Confirmed user voting - Disagree button is now disabled for confirmed users'
			},
			{
				type: 'changed',
				description:
					'Performance dashboard - Now only accessible in development builds where tracing data is collected'
			},
			{
				type: 'fixed',
				description:
					'Queue status refresh - Status indicator now updates automatically when queue processing completes'
			},
			{
				type: 'fixed',
				description:
					'Chinese locale placeholders - Fixed translation placeholders not being substituted for Chinese (Simplified and Traditional) users by using BCP 47 locale format'
			},
			{
				type: 'fixed',
				description:
					'Tab navigation stability - Fixed status indicators reloading when switching between profile or group page tabs'
			},
			{
				type: 'fixed',
				description:
					'Profile status caching - Profile page now uses cached results like the group page, preventing redundant API calls on revisits'
			},
			{
				type: 'fixed',
				description:
					'Discord data caching - Discord account lookups are now cached, preventing redundant API calls when reopening tooltips or switching to expanded view'
			},
			{
				type: 'fixed',
				description:
					'Voting access control - Voting widget now hides when the user is access-denied instead of showing a broken interface'
			},
			{
				type: 'fixed',
				description:
					'Settings persistence - Optional settings like saved tooltip dimensions are no longer wiped on extension restart'
			},
			{
				type: 'fixed',
				description:
					'Profile group carousel access - Group status lookups for access-denied users now work on their own profile pages'
			},
			{
				type: 'fixed',
				description:
					'Hidden member list detection - Groups with owner-disabled member lists now show an explanatory message instead of a generic error'
			},
			{
				type: 'fixed',
				description:
					'Confirmed user outfit indicator - Confirmed users with outfit-only reasons now correctly show the confirmed status instead of the outfit detected indicator'
			},
			{
				type: 'fixed',
				description:
					'Rate limit handling - API requests now respect rate limit headers and wait for the reset window before retrying'
			},
			{
				type: 'fixed',
				description:
					'Queue history persistence - Fixed entries being lost due to cross-context race conditions'
			},
			{
				type: 'fixed',
				description:
					"Restricted access on own profile - Groups carousels now load normally on the user's own profile instead of incorrectly showing access denied"
			},
			{
				type: 'fixed',
				description:
					'Captcha session cleanup - Orphaned captcha sessions in storage are now cleaned up'
			}
		]
	},
	{
		id: 'v2.14.0',
		version: '2.14.0',
		date: '2026-02-16',
		title: 'Captcha, Developer Tools & Firefox Support',
		summary:
			'This update adds captcha verification for queue submissions, developer debugging tools, Discord account lookups, and full Firefox compatibility with numerous UI refinements and performance improvements.',
		changes: [
			{
				type: 'added',
				description:
					'Captcha verification - Queue submissions now include a captcha challenge to help prevent automated abuse'
			},
			{
				type: 'added',
				description:
					'Resizable expanded tooltip - Drag the bottom-right corner handle to resize the expanded tooltip; your preferred size is automatically saved'
			},
			{
				type: 'added',
				description:
					'Discord account lookup - Condo Activity evidence now shows linked Discord accounts with server memberships and Roblox alt accounts in an expandable view'
			},
			{
				type: 'added',
				description:
					'Developer logs page - View extension activity logs in the popup settings when developer mode is enabled'
			},
			{
				type: 'changed',
				description:
					'Faster page loading - Profile and group pages now load status indicators 800ms+ faster by fetching data while the page is still loading'
			},
			{
				type: 'changed',
				description:
					'Smarter page navigation - Jumping to distant pages in the group members carousel now requires fewer API requests by automatically choosing the optimal fetch direction'
			},
			{
				type: 'changed',
				description:
					'Outfit viewer access - Moved "View Outfits" button from Roblox profile dropdown to the tooltip options menu'
			},
			{
				type: 'changed',
				description:
					'Custom toast notifications - Replaced browser alert dialogs with styled toast notifications that auto-dismiss for success messages'
			},
			{
				type: 'changed',
				description:
					'Content blur settings - Moved blur options out of experimental into their own dedicated settings section'
			},
			{
				type: 'changed',
				description:
					'Verification source icons - Replaced text badges with clickable Bloxlink, RoVer, and profile icons that link to each service'
			},
			{
				type: 'changed',
				description:
					'Smaller extension size - Switched to a lightweight 3D renderer, reducing the extension package by ~370 KB'
			},
			{
				type: 'changed',
				description:
					'Queue submission acknowledgments - Replaced passive notices with mandatory checkboxes that must be accepted before submitting'
			},
			{
				type: 'changed',
				description:
					'API documentation - Moved Rotector API docs to external site with new footer link to roscoe.rotector.com/docs'
			},
			{
				type: 'changed',
				description:
					'Custom API management window - Custom API settings now open in a standalone window so file pickers work without closing the popup'
			},
			{
				type: 'fixed',
				description:
					'Captcha flow reliability - Fixed service worker termination and message delivery issues that prevented queue submission after captcha completion on Chrome'
			},
			{
				type: 'fixed',
				description:
					'Firefox captcha support - Captcha verification for queue submissions now works on Firefox using a message bridge for browser compatibility'
			},
			{
				type: 'fixed',
				description:
					'Firefox 3D outfit viewer - Fixed characters rendering as black by resolving a WebGL cross-origin texture loading issue'
			},
			{
				type: 'fixed',
				description:
					'Firefox outfit queue submission - Fixed outfit selection failing when queuing users due to reactive state serialization'
			},
			{
				type: 'fixed',
				description:
					'Slow device compatibility - Increased element detection retries to prevent initialization failures on slower devices'
			},
			{
				type: 'fixed',
				description:
					'Discord account ID selection - Discord account IDs in the tooltip can now be selected and copied'
			},
			{
				type: 'fixed',
				description:
					'Group tab navigation - Fixed members carousel appearing on store and affiliates tabs instead of only the about tab'
			},
			{
				type: 'fixed',
				description:
					'Group members carousel pagination - Fixed bug where members were being skipped when navigating through pages'
			},
			{
				type: 'fixed',
				description:
					'Tooltip user info - Fixed incorrect username and display name extraction on friends list and search pages'
			},
			{
				type: 'fixed',
				description:
					'Profile page initialization - Fixed status indicators not loading due to outdated selector for new Roblox profile layout'
			},
			{
				type: 'removed',
				description:
					'War Zone feature - Removed experimental hunter system; a better redesigned version is planned for a future update'
			}
		]
	},
	{
		id: 'v2.11.0',
		version: '2.11.0',
		date: '2026-02-02',
		title: 'Group Members Carousel & Queue History',
		summary:
			'This update adds a dedicated group members carousel for better browsing experience, queue history tracking with notifications, and various improvements.',
		changes: [
			{
				type: 'added',
				description:
					"Group members carousel - Browse group members in a paginated grid with direct page navigation, replacing Roblox's virtual scrolling list for improved usability"
			},
			{
				type: 'added',
				description:
					'Tracked users tab - View flagged users who have previously joined a small group directly from the group members carousel'
			},
			{
				type: 'added',
				description:
					'Group configure members page - Status indicators and blur support now work on the group admin members management page'
			},
			{
				type: 'added',
				description:
					'Queue history tracking - View submitted users in the popup Queue tab with real-time status updates and system notifications when processing completes'
			},
			{
				type: 'changed',
				description:
					'Tooltip user display - Now shows both display name and @username when available'
			},
			{
				type: 'changed',
				description:
					'Profile page blur handling - Improved blur system with group-based click-to-reveal and better support for profile header redesign'
			},
			{
				type: 'changed',
				description:
					'Error indicator styling - Changed from red circle to gray triangle to distinguish lookup errors from flagged users'
			},
			{
				type: 'changed',
				description:
					'Onboarding improvements - Clearer preset descriptions and added accuracy acknowledgment checkbox'
			},
			{
				type: 'fixed',
				description:
					'Profile header selectors - Updated to support unified Roblox profile header structure'
			},
			{
				type: 'fixed',
				description:
					'Report helper button styling - Fixed button text color being overridden by Roblox page styles'
			}
		]
	},
	{
		id: 'v2.10.0',
		version: '2.10.0',
		date: '2026-01-26',
		title: '3D Viewer & Sharing',
		summary:
			'This update adds interactive 3D outfit viewing, a shareable profile link button, and fixes for profile page stability.',
		changes: [
			{
				type: 'added',
				description:
					'3D outfit viewer - View outfits in an interactive 3D view with drag-to-rotate controls and adjustable brightness'
			},
			{
				type: 'added',
				description:
					'Groups modal member list support - Status indicators now work with the new modal-based member list on group pages'
			},
			{
				type: 'added',
				description:
					'Copy link button - Share user profiles via a copyable link from the tooltip options menu'
			},
			{
				type: 'fixed',
				description:
					'Profile status indicator persistence - Status indicator no longer disappears when Roblox re-renders the profile header'
			}
		]
	},
	{
		id: 'v2.9.0',
		version: '2.9.0',
		date: '2026-01-16',
		title: 'Bug Fixes & Improvements',
		summary:
			'This update introduces new outfit viewing capabilities, expands friend warning protection, and fixes several bugs.',
		changes: [
			{
				type: 'added',
				description:
					'Search page friend warnings - Prevents accidentally adding flagged users as friends from search results'
			},
			{
				type: 'added',
				description:
					'Outfit picker for queue - Select specific outfits to check when submitting users to the analysis queue'
			},
			{
				type: 'added',
				description:
					'Outfit viewer - View all user outfits in a modal from the profile dropdown, with flagged outfits highlighted and sorted first'
			},
			{
				type: 'changed',
				description:
					'Simplified queued user status - Removed separate "Likely Safe" indicator, now shows standard "Not Flagged" status'
			},
			{
				type: 'changed',
				description:
					'Faster status indicator loading - Status indicators now appear faster on slow-loading pages'
			},
			{
				type: 'changed',
				description:
					'Restricted access notice - Clarifies that access was revoked due to being flagged and adds link to appeal via live chat'
			},
			{
				type: 'fixed',
				description:
					'Groups page detection - Fixed extension not working when navigating to other pages for a group'
			},
			{
				type: 'fixed',
				description:
					'Group member list reliability - Fixed status indicators not loading for some users in large group member lists'
			},
			{
				type: 'fixed',
				description:
					'Profile page groups layout - Updated to support new Roblox carousel-based group display'
			}
		]
	},
	{
		id: 'v2.8.0',
		version: '2.8.0',
		date: '2025-12-19',
		title: 'Onboarding & Improvements',
		summary:
			'This update introduces a guided onboarding experience for new users, an experimental content blur feature, and various improvements.',
		changes: [
			{
				type: 'added',
				description:
					'Changelog popup - After extension updates, a modal displays new changes on the Roblox homepage with option to disable future notifications'
			},
			{
				type: 'added',
				description:
					'Onboarding experience - New users are guided through the extension features with an interactive walkthrough covering status indicators, tooltips, voting, and the queue system'
			},
			{
				type: 'added',
				description:
					'Age-based presets - Choose between profiles during onboarding to automatically configure appropriate protection levels'
			},
			{
				type: 'added',
				description:
					'Content blur - Optionally blur display names, usernames, descriptions, and avatars for flagged users'
			},
			{
				type: 'added',
				description:
					'Queue resubmission cooldown - Shows remaining days until a user can be resubmitted to the queue'
			},
			{
				type: 'added',
				description:
					'Anti-abuse measures - Added client identification to help prevent misuse of the extension'
			},
			{
				type: 'changed',
				description:
					'Settings reorganization - Experimental features now grouped in dedicated section'
			},
			{
				type: 'changed',
				description:
					'Faster status loading - Status indicators now load more smoothly with progressive updates'
			},
			{
				type: 'changed',
				description:
					'Chrome Web Store listing - Extension now displays all 24 supported languages in the store'
			},
			{
				type: 'fixed',
				description:
					'Tooltip typography - Resolved broken font sizes and spacing for better readability'
			},
			{
				type: 'fixed',
				description:
					'Report form language - Content submitted to Roblox reports now stays in English regardless of your language setting'
			},
			{
				type: 'fixed',
				description:
					'Profile page groups - Status indicators for groups now load correctly on the first page visit'
			},
			{
				type: 'fixed',
				description:
					'Restricted access handling - Users with revoked access now see a clear notice instead of broken status indicators'
			},
			{
				type: 'fixed',
				description: 'Badge spinning - Status badges no longer rotate with the loading indicator'
			}
		]
	},
	{
		id: 'v2.5.1',
		version: '2.5.1',
		date: '2025-11-21',
		title: 'Stability & Bug Fixes',
		summary:
			'This update improves extension stability and fixes several bugs related to groups showcase on profile pages.',
		changes: [
			{
				type: 'added',
				description:
					'Queue limits in modal - View your remaining queue quota directly in the queue submission modal before submitting'
			},
			{
				type: 'added',
				description:
					'Language selection - Choose your preferred language in settings instead of relying on browser detection'
			},
			{
				type: 'changed',
				description:
					'Reason type identifiers - Simplified internal reason handling by using descriptive string keys instead of numeric codes'
			},
			{
				type: 'fixed',
				description:
					'Groups showcase reliability - Fixed duplicate API requests and status indicator display issues when viewing groups on profile pages'
			},
			{
				type: 'changed',
				description:
					'Status indicator colors - Pending users now display orange and mixed users display yellow for better visual distinction'
			},
			{
				type: 'changed',
				description:
					'Translation permission - Auto-translate feature now requests permission only when enabled instead of requiring it at install'
			}
		]
	},
	{
		id: 'v2.5.0',
		version: '2.5.0',
		date: '2025-11-17',
		title: 'API Integration & Multi-Language Support',
		summary:
			'This update introduces API integration features including custom API connections and public API documentation, along with multi-language support for 24 languages and several bug fixes.',
		changes: [
			{
				type: 'added',
				description:
					'Custom API integration system - Connect your own content analysis APIs alongside Rotector',
				subpoints: [
					'Full management interface for adding, editing, and configuring custom APIs',
					'Tabbed tooltips showing results from all enabled APIs with smart default tab selection',
					'Export and import functionality for sharing custom API configurations'
				]
			},
			{
				type: 'added',
				description:
					'Multi-language support - Extension now available in 24 languages based on browser settings',
				subpoints: [
					'Supported languages: English, Spanish, Arabic, Bengali, German, Filipino, French, Hindi, Indonesian, Italian, Japanese, Korean, Malay, Dutch, Polish, Portuguese, Russian, Swedish, Thai, Turkish, Ukrainian, Vietnamese, Chinese (Simplified), Chinese (Traditional)'
				]
			},
			{
				type: 'added',
				description:
					'Rotector API documentation - Complete public API reference for integrating Rotector into your own systems'
			},
			{
				type: 'changed',
				description:
					'Streamlined queue submission interface - Simplified from multi-step process to single-screen selection with threshold options'
			},
			{
				type: 'changed',
				description:
					'Reprocess with custom options - Select specific check options when reprocessing already-analyzed users'
			},
			{
				type: 'fixed',
				description:
					'Friend warning displays - Friend warnings now only appear when attempting to add inappropriate users, not safe users'
			},
			{
				type: 'fixed',
				description:
					'Internationalized URL support - Extension now works correctly on non-English Roblox URLs (e.g., roblox.com/es/, roblox.com/de/)'
			},
			{
				type: 'fixed',
				description:
					'Report helper setting requirement - Auto-fill feature now checks if Advanced Violation Information is enabled and displays appropriate guidance'
			},
			{
				type: 'fixed',
				description:
					'Pagination status indicators - Status indicators now properly update when navigating between pages on friends, followers, and following lists'
			}
		]
	},
	{
		id: 'v2.4.0',
		version: '2.4.0',
		date: '2025-10-20',
		title: 'Queue System Improvements & UI Enhancements',
		summary:
			'This update improves the queue system with better visibility into processing status, adds group statistics tracking, and refines status labels for clearer information.',
		changes: [
			{
				type: 'added',
				description: 'Reprocess users - Submit already-checked users for another review if outdated'
			},
			{
				type: 'added',
				description:
					'Timestamps in tooltips - See when users were queued and how long processing took'
			},
			{
				type: 'added',
				description:
					'Queue limits display - View your current queue usage and remaining quota in stats'
			},
			{
				type: 'added',
				description:
					'Group statistics - See counts for flagged, confirmed, and mixed groups in stats'
			},
			{
				type: 'added',
				description:
					'Queued status indicator - Shows when users are currently being checked by the system'
			},
			{
				type: 'added',
				description:
					'War Zone (Closed Testing) - Community reporting feature currently in testing phase'
			},
			{
				type: 'changed',
				description:
					'Status labels now distinguish between users not flagged by the system and users not yet queued'
			},
			{
				type: 'changed',
				description: 'Improved icon quality with cleaner designs throughout the extension'
			},
			{
				type: 'changed',
				description: 'Improved queue modal design with clearer success and error messages'
			},
			{
				type: 'fixed',
				description:
					'Report helper compatibility - Updated to work with latest Roblox report page changes'
			},
			{
				type: 'fixed',
				description:
					'Profile page compatibility - Added support for new A/B tested profile header design while maintaining legacy version support'
			}
		]
	},
	{
		id: 'v2.3.1',
		version: '2.3.1',
		date: '2025-09-05',
		title: 'Friends Tile Dropdown Fix',
		summary:
			'This patch fixes remaining friend dropdown positioning issues on the Roblox homepage.',
		changes: [
			{
				type: 'fixed',
				description:
					'Friend tile dropdown positioning - Resolved issue where dropdown menus would appear in the wrong position on homepage'
			}
		]
	},
	{
		id: 'v2.3.0',
		version: '2.3.0',
		date: '2025-09-03',
		title: 'Compatibility & User Experience Improvements',
		summary:
			'This update fixes compatibility issues with other browser extensions, adds support for new Roblox pages, and improves the extension popup design.',
		changes: [
			{
				type: 'added',
				description:
					'User search page support - Status indicators now appear on Roblox user search results pages'
			},
			{
				type: 'added',
				description:
					"BTRoblox extension compatibility - Full support for BTRoblox's modified groups layout on profile pages"
			},
			{
				type: 'added',
				description:
					'Weekly usage charts - View analysis costs and usage transparency data with interactive weekly charts in popup'
			},
			{
				type: 'changed',
				description: 'Extension popup improvements',
				subpoints: [
					'Streamlined banner layouts and moved integration stats to tooltips for cleaner interface',
					'Simplified changelog display by removing technical descriptions for better readability'
				]
			},
			{
				type: 'changed',
				description: 'Performance optimizations',
				subpoints: [
					'Improved page loading responsiveness when navigating between pages for slow-loading pages',
					'Faster page change detection using browser events instead of periodic checking',
					'Improved extension stability during long browsing sessions with better memory management'
				]
			},
			{
				type: 'changed',
				description: 'User interface refinements',
				subpoints: [
					'Simplified page settings into single category and removed unnecessary tooltip toggles',
					'Repositioned indicators on user and group lists to be less visually distracting'
				]
			},
			{
				type: 'fixed',
				description:
					"Friend tile dropdown positioning - Resolved issue where Roblox's dropdown menus on homepage would get stuck in wrong screen position"
			},
			{
				type: 'fixed',
				description:
					'Refresh button animation - Fixed spinner animation in statistics section not displaying properly'
			},
			{
				type: 'fixed',
				description:
					'Page navigation reliability - Fixed rare issue where extension might not work properly when navigating between similar page types'
			}
		]
	},
	{
		id: 'v2.2.0',
		version: '2.2.0',
		date: '2025-08-27',
		title: 'Group Support & 3rd Party Integrations',
		summary:
			'This major update introduces Roblox group support, partnership integrations with other safety initiatives, and financial transparency features.',
		changes: [
			{
				type: 'added',
				description:
					'Groups support - Complete group analysis system supporting Roblox groups with safety indicators and tooltips'
			},
			{
				type: 'added',
				description:
					'Integrations system - Partnership support allowing other safety initiatives to integrate their user lists with the extension'
			},
			{
				type: 'added',
				description:
					'Financial transparency section - Extension operational costs and support information in popup'
			},
			{
				type: 'added',
				description: 'Friends navigation support - Full support for /users/friends navigation pages'
			},
			{
				type: 'changed',
				description: 'Code quality and UI improvements',
				subpoints: [
					'Popup styling architecture to resolve potential conflicts with Roblox page styles',
					'Improved page loading responsiveness with faster element detection and optimized retry timing',
					'Replaced asymmetric borders with uniform design across components for consistency',
					'Comprehensive code formatting standardization across 91+ project files'
				]
			},
			{
				type: 'fixed',
				description:
					'Changelog banner persistence - "View Details" button now properly dismisses the banner'
			}
		]
	},
	{
		id: 'v2.1.1',
		version: '2.1.1',
		date: '2025-07-31',
		title: 'Bug Fixes & UI Improvements',
		summary:
			'This update fixes several compatibility issues and adds an advanced violation banner for better user experience.',
		changes: [
			{
				type: 'added',
				description:
					'Violation banner - New banner component for alerting about disabled violation information in popup'
			},
			{
				type: 'changed',
				description: 'Redesigned popup footer - Improved layout and styling of footer section'
			},
			{
				type: 'changed',
				description:
					'Updated statistics formatting - Improved number formatting for better readability'
			},
			{
				type: 'fixed',
				description:
					'Extension compatibility issues - Resolved CSS conflicts that could affect compatibility with other extensions'
			},
			{
				type: 'fixed',
				description:
					'Report page functionality - Updated selectors to work with latest Roblox report page changes'
			}
		]
	},
	{
		id: 'v2.1.0',
		version: '2.1.0',
		date: '2025-07-28',
		title: 'Improved Queue System & Bug Fixes',
		summary:
			'This update introduces a new multi-option queue selection system and fixes bugs from the rewrite.',
		changes: [
			{
				type: 'added',
				description: 'Queue system improvements',
				subpoints: [
					'Multi-option queue selection to choose specific data types (outfits, profile, friends, groups) with lock-in confirmation',
					'Banned users statistics showing count of users banned by Roblox in the statistics panel'
				]
			},
			{
				type: 'changed',
				description: 'UI and animation improvements',
				subpoints: [
					'Reduced modal transition durations for snappier interface interactions',
					'Improved friend warning modal with better visual design and updated styling'
				]
			},
			{
				type: 'changed',
				description: 'Architecture refactoring',
				subpoints: [
					'Unified tooltip architecture combining separate components into single system',
					'Dedicated page manager components with extracted UI logic for improved reactivity',
					'Simplified tooltip and status indicator architecture with reusable utilities',
					'Shared user list management logic in base controller class with optimized profile page handling'
				]
			},
			{
				type: 'changed',
				description:
					'Updated Roblox compatibility - Adapted to new Roblox report page structure and URL patterns'
			},
			{
				type: 'fixed',
				description:
					'Queue modal display issues - Resolved problem where queue modal would not appear on profile pages'
			},
			{
				type: 'fixed',
				description:
					'Friend button interception - Fixed more reliable friend button detection and interception'
			},
			{
				type: 'fixed',
				description:
					'Text display issues - Removed redundant escaping that was causing text to be displayed incorrectly'
			},
			{
				type: 'fixed',
				description:
					'Statistics last updated time - Now shows when server data was generated instead of when extension fetched it'
			}
		]
	},
	{
		id: 'v2.0.0',
		version: '2.0.0',
		date: '2025-07-20',
		title: 'Complete Extension Rewrite',
		summary:
			'The extension has been completely rebuilt from the ground up with modern technology, resulting in better performance, reliability, and new features for smoother browsing.',
		changes: [
			{
				type: 'added',
				description: 'New features and capabilities',
				subpoints: [
					'Engine version indicators showing which detection engine version analyzed each user for transparency',
					'Theme system allowing choice between auto, light, and dark themes to match preferences',
					'Secret developer panel for advanced users with custom API endpoints and debug logging',
					'Changelog notifications to stay informed about new features and improvements',
					'Cache duration control to customize how long user status data is cached',
					'Improved queue feedback with clearer success and error messages'
				]
			},
			{
				type: 'changed',
				description: 'Complete rebuild with modern technology',
				subpoints: [
					'Entire extension rewritten from ground up for better speed, stability, and future updates',
					'Smoother user interface with more responsive and polished buttons, menus, and interactions',
					'Better memory management using less computer memory during long browsing sessions',
					'More reliable API connections with more stable network requests'
				]
			},
			{
				type: 'changed',
				description:
					'Improved accessibility - Better support for screen readers and keyboard navigation throughout the extension'
			},
			{
				type: 'changed',
				description:
					'Optimized batch processing - More efficient handling of multiple users with intelligent batching and caching'
			},
			{
				type: 'fixed',
				description: 'Stability and reliability improvements',
				subpoints: [
					'Memory leak issues where extension would gradually use more memory over time',
					'Page navigation detection now more reliably detects navigation between different Roblox pages',
					'Status indicator positioning issues where indicators could overlap or appear in wrong locations',
					'Tooltip display issues where tooltips might not show or disappear too quickly',
					'Batch processing failures in edge cases where some users in large lists might not get checked'
				]
			},
			{
				type: 'security',
				description: 'Enhanced security protections',
				subpoints: [
					'Strengthened defenses against potential security vulnerabilities and malicious content',
					'Secure external link handling preventing window.opener access',
					'Input sanitization ensuring all user data and API responses are properly sanitized before display'
				]
			}
		]
	}
];
