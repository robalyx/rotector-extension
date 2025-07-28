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
    id: 'v2.0.0',
    version: '2.0.0',
    date: '2025-07-20',
    title: 'Complete Extension Rewrite',
    summary: 'The extension has been completely rebuilt from the ground up with modern technology, resulting in better performance, reliability, and new features for smoother browsing.',
    changes: [
      {
        type: 'added',
        description: 'Engine version indicators - See which AI detection engine version analyzed each user for transparency',
        technicalDescription: 'Added engine version metadata to API responses and tooltip display with version compatibility indicators'
      },
      {
        type: 'added',
        description: 'Theme system - Choose between auto, light, and dark themes to match your preference',
        technicalDescription: 'Implemented theme system with automatic Roblox theme detection and persistent user preferences'
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
        technicalDescription: 'Full TypeScript rewrite using WXT framework, Svelte 5 with runes, Tailwind CSS 4, and modern build tooling (Vite + Bun)'
      },
      {
        type: 'changed',
        description: 'Smoother user interface - All buttons, menus, and interactions now feel more responsive and polished',
        technicalDescription: 'Svelte 5 reactive components with optimized rendering, CSS transitions, and modern interaction patterns'
      },
      {
        type: 'changed',
        description: 'Better memory management - The extension uses less computer memory and won\'t slow down your browser during long browsing sessions',
        technicalDescription: 'Implemented proper observer cleanup, memory leak prevention, and health check systems with automatic garbage collection'
      },
      {
        type: 'changed',
        description: 'More reliable API connections - Network requests are now more stable',
        technicalDescription: 'Improved API client with exponential backoff retry logic, request caching, and service worker message passing architecture'
      },
      {
        type: 'changed',
        description: 'Improved accessibility - Better support for screen readers and keyboard navigation throughout the extension',
        technicalDescription: 'WCAG 2.1 compliance with proper ARIA labels, semantic markup, keyboard navigation, and screen reader support'
      },
      {
        type: 'changed',
        description: 'Optimized batch processing - More efficient handling of multiple users with intelligent batching and caching',
        technicalDescription: 'Reduced batch delays (250ms from 1000ms), optimized batch sizes, and improved vote data aggregation for better performance'
      },
      {
        type: 'fixed',
        description: 'Memory leak issues - Fixed problems where the extension would gradually use more memory over time',
        technicalDescription: 'Resolved DOM observer memory leaks through proper cleanup lifecycle, WeakMap usage, and MutationObserver disconnection'
      },
      {
        type: 'fixed',
        description: 'Page navigation detection - The extension now more reliably detects when you navigate between different Roblox pages',
        technicalDescription: 'Improved URL pattern matching, navigation event handling, and controller lifecycle management'
      },
      {
        type: 'fixed',
        description: 'Status indicator positioning - Fixed issues where status indicators could overlap or appear in wrong locations',
        technicalDescription: 'Implemented absolute positioning and proper positioning for friends carousel tiles'
      },
      {
        type: 'fixed',
        description: 'Tooltip display issues - Resolved problems where tooltips might not show or disappear too quickly',
        technicalDescription: 'Fixed tooltip z-index stacking, hover delay timings, and portal-based rendering to prevent DOM conflicts'
      },
      {
        type: 'fixed',
        description: 'Batch processing failures - Fixed edge cases where some users in large lists might not get checked',
        technicalDescription: 'Improved batch error handling with individual request failure isolation and retry logic for incomplete batches'
      },
      {
        type: 'security',
        description: 'Improved security protections - Strengthened defenses against potential security vulnerabilities and malicious content',
        technicalDescription: 'Implemented CSP headers, XSS sanitization utilities, secure content script isolation, and strict TypeScript compilation'
      },
      {
        type: 'security',
        description: 'Secure external link handling - All external links now properly prevent window.opener access for security',
        technicalDescription: 'Added rel="noopener noreferrer" attributes and target="_blank" security controls for all external navigation'
      },
      {
        type: 'security',
        description: 'Input sanitization - All user data and API responses are properly sanitized before display',
        technicalDescription: 'HTML escaping and input validation with dedicated sanitizer utilities and TypeScript type guards'
      }
    ]
  }
];

// Get the latest changelog
export function getLatestChangelog(): Changelog | null {
  return CHANGELOGS.length > 0 ? CHANGELOGS[0] : null;
}

