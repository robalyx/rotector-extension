import type { UserStatus, GroupStatus } from './api';

export interface CustomApiConfig {
	id: string; // UUID
	name: string; // Max 12 chars
	url: string; // Must be HTTPS
	enabled: boolean;
	timeout: number; // Required, in milliseconds
	order: number; // Display order
	createdAt: number;
	lastTested?: number;
	lastTestSuccess?: boolean;
	isSystem?: boolean;
	reasonFormat?: 'numeric' | 'string';
	landscapeImageDataUrl?: string; // Optional base64 data URL for tab image
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
