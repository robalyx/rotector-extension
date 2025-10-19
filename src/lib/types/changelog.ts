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
		id: 'v2.4.0',
		version: '2.4.0',
		date: '2025-10-20',
		title: 'Queue System Improvements & UI Enhancements',
		summary:
			'This update improves the queue system with better visibility into processing status, adds group statistics tracking, and refines status labels for clearer information.',
		changes: [
			{
				type: 'added',
				description:
					'War Zone (Closed Testing) - Community reporting feature currently in testing phase',
				subpoints: [
					'Hexagonal map showing 7 zones with progress tracking',
					'Major orders with community goals and rewards',
					'Leaderboard showing top contributors and their success rates',
					'Hunter profile showing your points and settings',
					'Find reportable users button to quickly discover flagged users',
					'Charts showing 30-day trends for zones and ban rates',
					'Zone details showing active users and progress history'
				]
			},
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
				type: 'changed',
				description:
					'Status labels now distinguish between users not flagged by AI and users not yet queued'
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
					'Weekly usage charts - View AI costs and usage transparency data with interactive weekly charts in popup'
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
					'Engine version indicators showing which AI detection engine version analyzed each user for transparency',
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
