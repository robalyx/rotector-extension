import type { UserStatus, GroupStatus } from './api';

export interface CustomApiConfig {
	id: string; // UUID
	name: string; // Max 12 chars
	singleUrl: string; // Full URL for single lookups, must contain {userId}
	batchUrl: string; // Full URL for batch lookups
	enabled: boolean;
	timeout: number; // Required, in milliseconds
	order: number; // Display order
	createdAt: number;
	lastTested?: number;
	lastTestSuccess?: boolean;
	isSystem?: boolean;
	reasonFormat?: 'numeric' | 'string';
	landscapeImageDataUrl?: string; // Optional base64 data URL for tab image
	apiKey?: string; // Optional API key sent via X-Auth-Token header
}

export interface CustomApiResult {
	apiId: string;
	apiName: string;
	data?: UserStatus | GroupStatus;
	error?: string;
	loading: boolean;
	timestamp?: number;
	landscapeImageDataUrl?: string;
}

export interface CombinedStatus {
	customApis: Map<string, CustomApiResult>;
}
