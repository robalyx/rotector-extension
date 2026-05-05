import type { ApiResponse } from '@/lib/types/api';
import { extractErrorMessage } from '@/lib/utils/dom/sanitizer';

// All errors thrown across services and the background worker share this shape.
// Optional fields stay undefined when the source didn't set them, so callers can
// read e.g. `asApiError(e).status` without ever silencing a real type error
export interface ApiError extends Error {
	status?: number;
	requestId?: string;
	code?: string;
	type?: string;
	rateLimitReset?: number;
	details?: Record<string, unknown>;
	robloxErrorCode?: number;
	isTimeoutError?: boolean;
	isAbortError?: boolean;
}

// Narrows an unknown caught value to ApiError, wrapping non-Errors so callers
// always get a structured shape they can read .field on
export function asApiError(value: unknown): ApiError {
	return value instanceof Error ? value : new Error(String(value));
}

// HTTP Response -> ApiError. Reads JSON body for structured error fields and
// sets rateLimitReset from the Retry-After header for 429 responses.
export async function buildHttpError(response: Response): Promise<ApiError> {
	let errorData: {
		error?: string;
		requestId?: string;
		code?: string;
		type?: string;
		details?: Record<string, unknown>;
	};
	try {
		const jsonData: unknown = await response.json();
		errorData = typeof jsonData === 'object' && jsonData !== null ? jsonData : {};
	} catch {
		const errorText = await response.text().catch(() => 'Unknown error');
		errorData = { error: errorText };
	}

	const error: ApiError = Object.assign(
		new Error(errorData.error ?? `HTTP ${String(response.status)}: ${response.statusText}`),
		{
			status: response.status,
			...(errorData.requestId && { requestId: errorData.requestId }),
			...(errorData.code && { code: errorData.code }),
			...(errorData.type && { type: errorData.type }),
			...(errorData.details && { details: errorData.details })
		}
	);

	if (response.status === 429) {
		const retryAfter = response.headers.get('Retry-After');
		if (retryAfter) {
			error.rateLimitReset = Math.ceil(Date.now() / 1000) + Number(retryAfter);
		}
	}

	return error;
}

// Failed ApiResponse envelope -> ApiError. Lifts structured fields off the
// envelope into a throwable so call sites that re-throw keep the shape.
export function buildResponseError(response: ApiResponse): ApiError {
	return Object.assign(new Error(response.error ?? 'An error occurred. Please try again.'), {
		...(response.requestId && { requestId: response.requestId }),
		...(response.code && { code: response.code }),
		...(response.type && { type: response.type }),
		...(response.status !== undefined && { status: response.status }),
		...(response.rateLimitReset && { rateLimitReset: response.rateLimitReset }),
		...(response.details && { details: response.details })
	});
}

// ApiError -> ApiResponse envelope. Inverse of buildResponseError, used by the
// background dispatcher to wrap thrown errors for the wire.
export function createErrorResponse(error: ApiError): ApiResponse {
	return {
		success: false,
		error: extractErrorMessage(error),
		...(error.requestId && { requestId: error.requestId }),
		...(error.code && { code: error.code }),
		...(error.type && { type: error.type }),
		...(error.status !== undefined && { status: error.status }),
		...(error.rateLimitReset && { rateLimitReset: error.rateLimitReset }),
		...(error.details && { details: error.details })
	};
}
