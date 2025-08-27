export interface ChangelogEntry {
    type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
    description?: string;
    technicalDescription?: string;
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
                description: 'Groups support - Complete group analysis system supporting Roblox groups with safety indicators and tooltips',
                technicalDescription: 'Profile page group showcase processing, group status API integration, and group-specific UI components'
            },
            {
                type: 'added',
                description: 'Integrations system - Partnership support allowing other safety initiatives to integrate their user lists with the extension',
                technicalDescription: 'Enhanced status indicators with partnership badges and integration-specific styling throughout the extension'
            },
            {
                type: 'added',
                description: 'Financial transparency section - Extension operational costs and support information in popup',
                technicalDescription: 'Popup section displaying operational cost transparency and donation links with dedicated styling'
            },
            {
                type: 'added',
                description: 'Friends navigation support - Full support for /users/friends navigation pages',
                technicalDescription: 'URL pattern matching for both user-specific and current user friends pages'
            },
            {
                type: 'changed',
                description: 'Popup styling architecture - Resolve potential conflicts with Roblox page styles',
                technicalDescription: 'Isolated popup styling system with dedicated reset styles to prevent conflicts with Roblox page styles'
            },
            {
                type: 'changed',
                description: 'Improved page loading responsiveness - Faster element detection with optimized retry timing',
                technicalDescription: 'Optimized retry configuration with reduced delays and adjusted backoff settings for more responsive page initialization'
            },
            {
                type: 'changed',
                description: 'UI border consistency - Replaced asymmetric borders with uniform design across components',
                technicalDescription: 'Uniform border design across modal and tooltip components for improved visual consistency'
            },
            {
                type: 'changed',
                technicalDescription: 'Comprehensive code formatting standardization across 91+ project files'
            },
            {
                type: 'fixed',
                description: 'Changelog banner persistence - "View Details" button now properly dismisses the banner',
                technicalDescription: 'Unified banner dismissal behavior between dismiss button and view details action for consistent user experience'
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
                description: 'Violation banner - New banner component for alerting about disabled violation information in popup',
                technicalDescription: 'Violation banner component with dedicated state management and styling for enhanced violation display'
            },
            {
                type: 'changed',
                description: 'Redesigned popup footer - Improved layout and styling of footer section',
                technicalDescription: 'Dedicated footer component with improved styling and organization'
            },
            {
                type: 'changed',
                description: 'Updated statistics formatting - Improved number formatting for better readability',
                technicalDescription: 'Higher thresholds for number formatting display in statistics'
            },
            {
                type: 'fixed',
                description: 'Extension compatibility issues - Resolved CSS conflicts that could affect compatibility with other extensions',
                technicalDescription: 'Resolved CSS specificity conflicts in status indicators, settings inputs, statistics containers, and tooltip voting components'
            },
            {
                type: 'fixed',
                description: 'Report page functionality - Updated selectors to work with latest Roblox report page changes',
                technicalDescription: 'Updated DOM selectors to match current Roblox report page structure'
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
                description: 'Improved queue selection system - Choose specific data types to queue (outfits, profile, friends, groups) with lock-in confirmation',
                technicalDescription: 'Transformed queue popup from simple checkbox to three-option selection system with mandatory lock-in, summary view, and click-and-hold unlock mechanism'
            },
            {
                type: 'added',
                description: 'Banned users statistics - View count of users banned by Roblox in the statistics panel',
                technicalDescription: 'Subtitle text below detection system statistics displaying banned user counts'
            },
            {
                type: 'changed',
                description: 'Improved modal animations - Reduced transition durations for snappier interface interactions',
                technicalDescription: 'Reduced modal transition duration for better user experience and responsive feedback'
            },
            {
                type: 'changed',
                description: 'Improved friend warning modal - Better visual design and updated styling',
                technicalDescription: 'Improved friend warning modal visual design with updated styling and icon improvements'
            },
            {
                type: 'changed',
                technicalDescription: 'Unified tooltip architecture combining separate components into single system, eliminating redundant service layer'
            },
            {
                type: 'changed',
                technicalDescription: 'Dedicated page manager components with extracted UI logic for improved reactivity and maintainability'
            },
            {
                type: 'changed',
                technicalDescription: 'Simplified tooltip and status indicator architecture with reusable utilities for page detection, status configuration, and positioning'
            },
            {
                type: 'changed',
                technicalDescription: 'Shared user list management logic in base controller class with consolidated modal visibility and optimized profile page handling'
            },
            {
                type: 'changed',
                description: 'Updated Roblox compatibility - Adapted to new Roblox report page structure and URL patterns',
                technicalDescription: 'Updated report page compatibility for new Roblox URL structure and HTML layout changes'
            },
            {
                type: 'fixed',
                description: 'Queue modal display issues - Resolved problem where queue modal would not appear on profile pages',
                technicalDescription: 'Resolved queue modal display issues with consolidated modal methods and proper component state management'
            },
            {
                type: 'fixed',
                description: 'Friend button interception - Fixed more reliable friend button detection and interception',
                technicalDescription: 'Enhanced friend button detection reliability with proper element waiting and interception mechanisms'
            },
            {
                type: 'fixed',
                description: 'Text display issues - Removed redundant escaping that was causing text to be displayed incorrectly',
                technicalDescription: 'Eliminated redundant HTML escaping that caused double-escaping conflicts with built-in XSS protection'
            },
            {
                type: 'fixed',
                description: 'Statistics last updated time - Now shows when server data was generated instead of when extension fetched it',
                technicalDescription: 'Server timestamp integration for accurate data freshness display instead of client-side timestamps'
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
                description: 'Engine version indicators - See which AI detection engine version analyzed each user for transparency',
                technicalDescription: 'Engine version metadata integration in API responses and tooltip display with compatibility indicators'
            },
            {
                type: 'added',
                description: 'Theme system - Choose between auto, light, and dark themes to match your preference',
                technicalDescription: 'Theme system with automatic Roblox theme detection and persistent user preferences'
            },
            {
                type: 'added',
                description: 'Secret developer panel - Advanced users can access additional settings like custom API endpoints and debug logging',
                technicalDescription: 'Developer panel with runtime configuration management'
            },
            {
                type: 'added',
                description: 'Changelog notifications - Stay informed about new features and improvements with in-extension notifications',
                technicalDescription: 'In-extension changelog system with dismissible banners, version tracking, and technical details toggle for developers'
            },
            {
                type: 'added',
                description: 'Cache duration control - Customize how long user status data is cached to balance performance and freshness',
                technicalDescription: 'User-configurable cache duration (1-10 minutes) with intelligent cache invalidation and background refresh'
            },
            {
                type: 'added',
                description: 'Improved queue feedback - Clearer success and error messages when adding users to the review queue',
                technicalDescription: 'Dedicated modal components for queue operations with detailed error handling and user action confirmation'
            },
            {
                type: 'changed',
                description: 'Completely rebuilt using modern web technology - The entire extension has been rewritten for better speed, stability, and future updates',
                technicalDescription: 'Complete TypeScript rewrite with WXT framework, Svelte 5 runes, Tailwind CSS 4, and modern build tooling'
            },
            {
                type: 'changed',
                description: 'Smoother user interface - All buttons, menus, and interactions now feel more responsive and polished',
                technicalDescription: 'Reactive component architecture with optimized rendering, CSS transitions, and modern interaction patterns'
            },
            {
                type: 'changed',
                description: 'Better memory management - The extension uses less computer memory and won\'t slow down your browser during long browsing sessions',
                technicalDescription: 'Proper observer cleanup, memory leak prevention, and health check systems with automatic garbage collection'
            },
            {
                type: 'changed',
                description: 'More reliable API connections - Network requests are now more stable',
                technicalDescription: 'Enhanced API client with exponential backoff retry logic, request caching, and service worker message passing architecture'
            },
            {
                type: 'changed',
                description: 'Improved accessibility - Better support for screen readers and keyboard navigation throughout the extension',
                technicalDescription: 'WCAG 2.1 accessibility compliance with ARIA labels, semantic markup, keyboard navigation, and screen reader support'
            },
            {
                type: 'changed',
                description: 'Optimized batch processing - More efficient handling of multiple users with intelligent batching and caching',
                technicalDescription: 'Optimized batch processing with reduced delays, improved batch sizes, and enhanced vote data aggregation'
            },
            {
                type: 'fixed',
                description: 'Memory leak issues - Fixed problems where the extension would gradually use more memory over time',
                technicalDescription: 'Resolved DOM observer memory leaks through proper cleanup lifecycle, WeakMap usage, and observer disconnection'
            },
            {
                type: 'fixed',
                description: 'Page navigation detection - The extension now more reliably detects when you navigate between different Roblox pages',
                technicalDescription: 'Improved URL pattern matching, navigation event handling, and controller lifecycle management'
            },
            {
                type: 'fixed',
                description: 'Status indicator positioning - Fixed issues where status indicators could overlap or appear in wrong locations',
                technicalDescription: 'Enhanced positioning system with absolute positioning and proper carousel tile alignment'
            },
            {
                type: 'fixed',
                description: 'Tooltip display issues - Resolved problems where tooltips might not show or disappear too quickly',
                technicalDescription: 'Resolved tooltip z-index stacking, hover delay timings, and portal-based rendering conflicts'
            },
            {
                type: 'fixed',
                description: 'Batch processing failures - Fixed edge cases where some users in large lists might not get checked',
                technicalDescription: 'Enhanced batch error handling with individual request failure isolation and retry logic for incomplete batches'
            },
            {
                type: 'security',
                description: 'Improved security protections - Strengthened defenses against potential security vulnerabilities and malicious content',
                technicalDescription: 'CSP headers, XSS sanitization utilities, secure content script isolation, and strict TypeScript compilation'
            },
            {
                type: 'security',
                description: 'Secure external link handling - All external links now properly prevent window.opener access for security',
                technicalDescription: 'Secure external link handling with noopener noreferrer attributes and target blank security controls'
            },
            {
                type: 'security',
                description: 'Input sanitization - All user data and API responses are properly sanitized before display',
                technicalDescription: 'HTML escaping and input validation with dedicated sanitization utilities and TypeScript type guards'
            }
        ]
    }
];

// Get the latest changelog
export function getLatestChangelog(): Changelog | null {
    return CHANGELOGS.length > 0 ? CHANGELOGS[0] : null;
}

