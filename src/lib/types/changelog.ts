export interface ChangelogEntry {
    type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
    description: string;
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
        id: 'v2.2.0',
        version: '2.2.0',
        date: '2025-08-27',
        title: 'Group Support & 3rd Party Integrations',
        summary: 'This major update introduces Roblox group support, partnership integrations with other safety initiatives, and financial transparency features.',
        changes: [
            {
                type: 'added',
                description: 'Groups support - Complete group analysis system supporting Roblox groups with safety indicators and tooltips'
            },
            {
                type: 'added',
                description: 'Integrations system - Partnership support allowing other safety initiatives to integrate their user lists with the extension'
            },
            {
                type: 'added',
                description: 'Financial transparency section - Extension operational costs and support information in popup'
            },
            {
                type: 'added',
                description: 'Friends navigation support - Full support for /users/friends navigation pages'
            },
            {
                type: 'changed',
                description: 'Popup styling architecture - Resolve potential conflicts with Roblox page styles'
            },
            {
                type: 'changed',
                description: 'Improved page loading responsiveness - Faster element detection with optimized retry timing'
            },
            {
                type: 'changed',
                description: 'UI border consistency - Replaced asymmetric borders with uniform design across components'
            },
            {
                type: 'changed',
                description: 'Comprehensive code formatting standardization across 91+ project files'
            },
            {
                type: 'fixed',
                description: 'Changelog banner persistence - "View Details" button now properly dismisses the banner'
            }
        ]
    },
    {
        id: 'v2.1.1',
        version: '2.1.1',
        date: '2025-07-31',
        title: 'Bug Fixes & UI Improvements',
        summary: 'This update fixes several compatibility issues and adds an advanced violation banner for better user experience.',
        changes: [
            {
                type: 'added',
                description: 'Violation banner - New banner component for alerting about disabled violation information in popup'
            },
            {
                type: 'changed',
                description: 'Redesigned popup footer - Improved layout and styling of footer section'
            },
            {
                type: 'changed',
                description: 'Updated statistics formatting - Improved number formatting for better readability'
            },
            {
                type: 'fixed',
                description: 'Extension compatibility issues - Resolved CSS conflicts that could affect compatibility with other extensions'
            },
            {
                type: 'fixed',
                description: 'Report page functionality - Updated selectors to work with latest Roblox report page changes'
            }
        ]
    },
    {
        id: 'v2.1.0',
        version: '2.1.0',
        date: '2025-07-28',
        title: 'Improved Queue System & Bug Fixes',
        summary: 'This update introduces a new multi-option queue selection system and fixes bugs from the rewrite.',
        changes: [
            {
                type: 'added',
                description: 'Improved queue selection system - Choose specific data types to queue (outfits, profile, friends, groups) with lock-in confirmation'
            },
            {
                type: 'added',
                description: 'Banned users statistics - View count of users banned by Roblox in the statistics panel'
            },
            {
                type: 'changed',
                description: 'Improved modal animations - Reduced transition durations for snappier interface interactions'
            },
            {
                type: 'changed',
                description: 'Improved friend warning modal - Better visual design and updated styling'
            },
            {
                type: 'changed',
                description: 'Unified tooltip architecture combining separate components into single system'
            },
            {
                type: 'changed',
                description: 'Dedicated page manager components with extracted UI logic for improved reactivity'
            },
            {
                type: 'changed',
                description: 'Simplified tooltip and status indicator architecture with reusable utilities'
            },
            {
                type: 'changed',
                description: 'Shared user list management logic in base controller class with optimized profile page handling'
            },
            {
                type: 'changed',
                description: 'Updated Roblox compatibility - Adapted to new Roblox report page structure and URL patterns'
            },
            {
                type: 'fixed',
                description: 'Queue modal display issues - Resolved problem where queue modal would not appear on profile pages'
            },
            {
                type: 'fixed',
                description: 'Friend button interception - Fixed more reliable friend button detection and interception'
            },
            {
                type: 'fixed',
                description: 'Text display issues - Removed redundant escaping that was causing text to be displayed incorrectly'
            },
            {
                type: 'fixed',
                description: 'Statistics last updated time - Now shows when server data was generated instead of when extension fetched it'
            }
        ]
    },
    {
        id: 'v2.0.0',
        version: '2.0.0',
        date: '2025-07-20',
        title: 'Complete Extension Rewrite',
        summary: 'The extension has been completely rebuilt from the ground up with modern technology, resulting in better performance, reliability, and new features for smoother browsing.',
        changes: [
            {
                type: 'added',
                description: 'Engine version indicators - See which AI detection engine version analyzed each user for transparency'
            },
            {
                type: 'added',
                description: 'Theme system - Choose between auto, light, and dark themes to match your preference'
            },
            {
                type: 'added',
                description: 'Secret developer panel - Advanced users can access additional settings like custom API endpoints and debug logging'
            },
            {
                type: 'added',
                description: 'Changelog notifications - Stay informed about new features and improvements with in-extension notifications'
            },
            {
                type: 'added',
                description: 'Cache duration control - Customize how long user status data is cached to balance performance and freshness'
            },
            {
                type: 'added',
                description: 'Improved queue feedback - Clearer success and error messages when adding users to the review queue'
            },
            {
                type: 'changed',
                description: 'Completely rebuilt using modern web technology - The entire extension has been rewritten for better speed, stability, and future updates'
            },
            {
                type: 'changed',
                description: 'Smoother user interface - All buttons, menus, and interactions now feel more responsive and polished'
            },
            {
                type: 'changed',
                description: 'Better memory management - The extension uses less computer memory and won\'t slow down your browser during long browsing sessions'
            },
            {
                type: 'changed',
                description: 'More reliable API connections - Network requests are now more stable'
            },
            {
                type: 'changed',
                description: 'Improved accessibility - Better support for screen readers and keyboard navigation throughout the extension'
            },
            {
                type: 'changed',
                description: 'Optimized batch processing - More efficient handling of multiple users with intelligent batching and caching'
            },
            {
                type: 'fixed',
                description: 'Memory leak issues - Fixed problems where the extension would gradually use more memory over time'
            },
            {
                type: 'fixed',
                description: 'Page navigation detection - The extension now more reliably detects when you navigate between different Roblox pages'
            },
            {
                type: 'fixed',
                description: 'Status indicator positioning - Fixed issues where status indicators could overlap or appear in wrong locations'
            },
            {
                type: 'fixed',
                description: 'Tooltip display issues - Resolved problems where tooltips might not show or disappear too quickly'
            },
            {
                type: 'fixed',
                description: 'Batch processing failures - Fixed edge cases where some users in large lists might not get checked'
            },
            {
                type: 'security',
                description: 'Improved security protections - Strengthened defenses against potential security vulnerabilities and malicious content'
            },
            {
                type: 'security',
                description: 'Secure external link handling - All external links now properly prevent window.opener access for security'
            },
            {
                type: 'security',
                description: 'Input sanitization - All user data and API responses are properly sanitized before display'
            }
        ]
    }
];
