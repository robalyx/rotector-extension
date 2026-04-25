import type { UserStatus, GroupStatus } from './api';

export type CustomApiAuthHeaderType =
	| 'x-auth-token'
	| 'authorization-bearer'
	| 'authorization-plain';

export interface CustomApiConfig {
	id: string; // UUID
	name: string; // Max 12 chars
	singleUrl: string; // Full URL for single lookups, must contain {userId}
	batchUrl: string; // Full URL for batch lookups
	enabled: boolean;
	timeout: number; // Required, in milliseconds
	order: number; // Display order
	createdAt: number;
	lastTested?: number | undefined;
	lastTestSuccess?: boolean | undefined;
	isSystem?: boolean | undefined;
	reasonFormat?: 'numeric' | 'string' | undefined;
	landscapeImageDataUrl?: string | undefined; // Optional base64 data URL for tab image
	apiKey?: string | undefined; // Optional API key
	authHeaderType?: CustomApiAuthHeaderType | undefined; // Defaults to 'x-auth-token' when omitted
}

export interface CustomApiResult<T extends UserStatus | GroupStatus = UserStatus | GroupStatus> {
	apiId: string;
	apiName: string;
	data?: T | undefined;
	error?: string | undefined;
	loading: boolean;
	timestamp?: number | undefined;
	landscapeImageDataUrl?: string | undefined;
}

export type CombinedStatus<T extends UserStatus | GroupStatus = UserStatus | GroupStatus> = Map<
	string,
	CustomApiResult<T>
>;
