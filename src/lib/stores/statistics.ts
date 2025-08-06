import { writable, derived } from 'svelte/store';
import type { Statistics, StatisticsState, StatisticsCache } from '../types/statistics.js';
import { STATISTICS_CONFIG, STATISTICS_CACHE_KEY } from '../types/statistics.js';

export const statistics = writable<Statistics | null>(null);
export const statisticsState = writable<StatisticsState>('loading');
const lastUpdated = writable<number | null>(null);

// Derive human-readable update time
export const lastUpdatedFormatted = derived(
  lastUpdated,
  ($lastUpdated) => {
    if (!$lastUpdated) return 'Never';
    
    const now = Date.now();
    const diff = now - $lastUpdated;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
  }
);

// Check if cached statistics are still valid
async function getCachedStatistics(): Promise<Statistics | null> {
  try {
    const result = await browser.storage.local.get([STATISTICS_CACHE_KEY]);
    const cache: StatisticsCache | undefined = result[STATISTICS_CACHE_KEY];
    
    if (!cache) return null;
    
    const now = Date.now();
    if (now - cache.timestamp > STATISTICS_CONFIG.CACHE_DURATION) {
      return null; // Cache expired
    }
    
    return cache.data;
  } catch (error) {
    console.error('Failed to get cached statistics:', error);
    return null;
  }
}

// Cache statistics data
async function cacheStatistics(data: Statistics): Promise<void> {
  try {
    const cache: StatisticsCache = {
      data,
      timestamp: Date.now()
    };
    await browser.storage.local.set({ [STATISTICS_CACHE_KEY]: cache });
  } catch (error) {
    console.error('Failed to cache statistics:', error);
  }
}

// Load statistics from API
async function fetchStatisticsFromAPI(): Promise<Statistics> {
  const response = await browser.runtime.sendMessage({
    action: 'getStatistics'
  });
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch statistics');
  }
  
  return response.data;
}

// Load statistics with caching
export async function loadStatistics(forceRefresh: boolean = false): Promise<void> {
  statisticsState.set('loading');
  
  try {
    let data: Statistics | null = null;
    
    if (!forceRefresh) {
      data = await getCachedStatistics();
    }
    
    if (!data) {
      data = await fetchStatisticsFromAPI();
      await cacheStatistics(data);
    }
    
    statistics.set(data);
    lastUpdated.set(new Date(data.lastUpdated).getTime());
    statisticsState.set('loaded');
  } catch (error) {
    console.error('Failed to load statistics:', error);
    statisticsState.set('error');
    throw error;
  }
}

// Force refresh statistics
export async function refreshStatistics(): Promise<void> {
  return loadStatistics(true);
}

// Format numbers for display
export function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null || isNaN(num)) {
    return '0';
  }
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 100000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

// Format currency for display
export function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.abs(amount));
}

// Calculate funding percentage (donations vs costs)
export function calculateFundingPercentage(donations: number | undefined, costs: number | undefined): number {
  if (!donations || !costs || costs === 0) return 0;
  return Math.min(Math.round((donations / costs) * 100), 100);
}
