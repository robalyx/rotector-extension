import type { Changelog } from '@/lib/types/changelog';

export const CHANGELOGS: Changelog[] = [
	{
		id: 'v2.17.0',
		version: '2.17.0',
		date: '2026-05-20',
		title: 'New tools, sharper insights, smoother performance',
		summary:
			'This release brings new ways to share and contribute, including a leaderboard, tooltip image exports, and a clearer queue experience. Scan bars, indicators, and carousels load more progressively, and a long list of fixes tightens up Firefox support, tooltips, and blur handling.',
		changes: [
			{
				type: 'added',
				description:
					'Leaderboard - New tab in the popup ranks submitters by queue submissions that ended up flagged'
			},
			{
				type: 'added',
				description:
					'Tooltip export - Save the expanded tooltip as PNG, JPG, WebP, or SVG, or copy it to the clipboard, from the new Export submenu in the 3-dot menu'
			},
			{
				type: 'added',
				description:
					'Inspect-resistant tooltip text - The most-fakeable fields now render as canvas pixels so they cannot be edited via inspect-element'
			},
			{
				type: 'added',
				description:
					'Content categories - Flagged users now show a category label (CSAM, Sexual, Kink, Raceplay, Condo, or Other) alongside their status in the indicator and tooltip'
			},
			{
				type: 'added',
				description:
					'Queue history user identity - Each entry shows the user’s avatar, display name, and @username instead of just a numeric ID'
			},
			{
				type: 'added',
				description:
					'Profile scan bars - Friends and Communities carousels on profile pages now show a bulk scan summary inline with each section heading, mirroring the friends list page'
			},
			{
				type: 'added',
				description:
					'Integration scan bar chip - Friends scan bar adds a teal chip for Not Flagged friends caught by an enabled integration API'
			},
			{
				type: 'added',
				description:
					'Queue popup explainer - New sections explain how our database works, when (and when not) to queue, and the consequences of misuse'
			},
			{
				type: 'added',
				description:
					'Queue submission cost - Thorough checks count as 3× against your queue limit, with the cost shown next to the Submit button'
			},
			{
				type: 'added',
				description:
					'Review prompt - Modal asking you to leave a store review once you have helped flag a few users'
			},
			{
				type: 'changed',
				description:
					'Scan bar granularity - Now shows a separate chip for each status type instead of grouping several together'
			},
			{
				type: 'changed',
				description:
					'Progressive status indicators - Lists leave the loading spinner as soon as Rotector resolves, without waiting for every enabled custom API'
			},
			{
				type: 'changed',
				description:
					'Group members carousel - Thumbnails, presence icons, and statuses load in parallel, and indicators mount as soon as tiles render'
			},
			{
				type: 'changed',
				description:
					'Debug logs - The Developer Logs page is replaced by a Download debug logs button in settings that exports logs and system info to share with developers'
			},
			{
				type: 'changed',
				description:
					'Reliability improvements - Several core parts of the extension were rewritten behind the scenes for better stability and smoother day-to-day use'
			},
			{
				type: 'changed',
				description:
					'Queue popup acknowledgments - Trimmed from 11 to 5 items as dropped rules are now conveyed by the new explainer sections'
			},
			{
				type: 'changed',
				description: 'Ko-fi URL - Membership and funding links now point to ko-fi.com/rotector'
			},
			{
				type: 'fixed',
				description:
					'Firefox feature loading - Friend scans, group roles, and other Roblox-powered features now work on Firefox instead of failing to load'
			},
			{
				type: 'fixed',
				description:
					'Scan bar progress - Bar now fills smoothly as each batch of friends or groups is checked instead of jumping to 30% and disappearing'
			},
			{
				type: 'fixed',
				description:
					'Self-fetched status - A locally cached status no longer keeps the indicator stuck in the loading state'
			},
			{
				type: 'fixed',
				description:
					'Tooltip on Not Flagged users - Hovering the indicator on a Not Flagged profile now reliably shows the tooltip'
			},
			{
				type: 'fixed',
				description:
					'Activity chart - Readable 7d and 30d views as well as 12-hour clock labels on the 24h view'
			},
			{
				type: 'fixed',
				description:
					'Group members carousel tooltip - Hovering a tile past the first page now shows the avatar, username, and display name in the tooltip header'
			},
			{
				type: 'fixed',
				description:
					'Group members carousel - The carousel now renders on community pages even when another extension appends extra fragments to the URL'
			},
			{
				type: 'fixed',
				description:
					'Group members carousel hidden list - Groups with a permission-restricted member list now show the "Use the Tracked tab" empty state instead of a generic error'
			},
			{
				type: 'fixed',
				description:
					'Tooltip compact mode - Switching to compact now works right away instead of only after resizing the tooltip'
			},
			{
				type: 'fixed',
				description:
					'Group members carousel stuck indicators - Switching tabs or filters quickly no longer leaves status indicators stuck on the loading spinner'
			},
			{
				type: 'fixed',
				description:
					'Profile blur - Slow page loads no longer leave description text or store items blurred on innocent profiles'
			},
			{
				type: 'fixed',
				description:
					'Rovalra currently-wearing carousel - Items rendered by the Rovalra extension are now blurred and revealed alongside the rest of the avatar items'
			},
			{
				type: 'fixed',
				description:
					'Firefox debug logs - Error details that were previously skipped now appear in downloadable debug logs'
			},
			{
				type: 'fixed',
				description:
					'Tooltip vote totals - Vote counts now refresh in the expanded tooltip after voting instead of needing to reopen it'
			},
			{
				type: 'removed',
				description:
					'Tooltip "Copy Link" menu item - Replaced by the new tooltip image export which captures the full content as a PNG instead of just a link'
			},
			{
				type: 'removed',
				description:
					'Onboarding feature showcase - Dropped the step that walked through tooltips, queue, and voting since those features are visible in the live UI'
			}
		]
	}
];
