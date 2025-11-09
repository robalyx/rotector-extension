import type {
	GlobalHistoricalStats,
	MajorOrder,
	WarMapState,
	ZoneDetails,
	ZoneHistoricalStats
} from '@/lib/types/api';
import { API_CONFIG } from '@/lib/types/constants';
import { makeHttpRequest } from '../http-client';
import { extractResponseData } from '../utils';

// Get 30 days of historical statistics for a specific zone
export async function getWarZoneStatistics(zoneId: number): Promise<ZoneHistoricalStats> {
	const response = await makeHttpRequest(`${API_CONFIG.ENDPOINTS.WAR_ZONES}/${zoneId}/stats`, {
		method: 'GET',
		requireAuth: true
	});

	return extractResponseData<ZoneHistoricalStats>(response);
}

// Get all currently active major orders
export async function getWarOrders(): Promise<MajorOrder[]> {
	const response = await makeHttpRequest(API_CONFIG.ENDPOINTS.WAR_ORDERS, {
		method: 'GET',
		requireAuth: true
	});

	return extractResponseData<MajorOrder[]>(response);
}

// Get detailed information about a specific major order
export async function getWarOrder(orderId: number): Promise<MajorOrder> {
	const response = await makeHttpRequest(`${API_CONFIG.ENDPOINTS.WAR_ORDERS}/${orderId}`, {
		method: 'GET',
		requireAuth: true
	});

	return extractResponseData<MajorOrder>(response);
}

// Get 30 days of global historical statistics
export async function getGlobalStatisticsHistory(): Promise<GlobalHistoricalStats> {
	const response = await makeHttpRequest(API_CONFIG.ENDPOINTS.WAR_STATS_HISTORY, {
		method: 'GET',
		requireAuth: true
	});

	return extractResponseData<GlobalHistoricalStats>(response);
}

// Get the complete war map state
export async function getWarMap(): Promise<WarMapState> {
	const response = await makeHttpRequest(API_CONFIG.ENDPOINTS.WAR_MAP, {
		method: 'GET',
		requireAuth: true
	});

	return extractResponseData<WarMapState>(response);
}

// Get detailed information about a specific zone
export async function getWarZone(zoneId: number): Promise<ZoneDetails> {
	const response = await makeHttpRequest(`${API_CONFIG.ENDPOINTS.WAR_ZONES}/${zoneId}`, {
		method: 'GET',
		requireAuth: true
	});

	return extractResponseData<ZoneDetails>(response);
}
