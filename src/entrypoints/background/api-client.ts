import { API_CONFIG } from "@/lib/types/constants";
import { SETTINGS_KEYS } from "@/lib/types/settings";
import { logger } from "@/lib/utils/logger";

// Get API key from settings
async function getApiKey(): Promise<string | null> {
  try {
    const result = await browser.storage.sync.get([SETTINGS_KEYS.API_KEY]);
    const apiKey = result[SETTINGS_KEYS.API_KEY] as string | undefined;
    return typeof apiKey === "string" ? apiKey || null : null;
  } catch (error) {
    logger.error("Background: Failed to get API key:", error);
    return null;
  }
}

// Get extension UUID from storage
async function getExtensionUuid(): Promise<string | null> {
  try {
    const result = await browser.storage.local.get(["extension_uuid"]);
    return (result.extension_uuid as string) ?? null;
  } catch (error) {
    logger.error("Failed to get extension UUID:", error);
    return null;
  }
}

// Determine if error should trigger retry
function isRetryableError(error: Error): boolean {
  const status = (error as Error & { status?: number }).status;

  // HTTP status codes that are retryable
  if (status) {
    // Rate limits and server errors
    if (status === 429 || (status >= 500 && status < 600)) {
      return true;
    }

    // Request timeout
    if (status === 408) {
      return true;
    }
  }

  return false;
}

// Authenticate and execute API requests
export async function makeApiRequest(
  endpoint: string,
  options: RequestInit = {},
): Promise<unknown> {
  const startTime = Date.now();
  const apiKey = await getApiKey();

  // Get API base URL from settings
  const settings = await browser.storage.sync.get([SETTINGS_KEYS.API_BASE_URL]);
  const raw =
    typeof settings[SETTINGS_KEYS.API_BASE_URL] === "string"
      ? (settings[SETTINGS_KEYS.API_BASE_URL] as string).trim()
      : "";
  let baseUrl = raw ? raw : API_CONFIG.BASE_URL;

  // Remove trailing slash
  baseUrl = baseUrl.replace(/\/$/, "");

  const url = `${baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (apiKey?.trim()) {
    headers["X-Auth-Token"] = apiKey.trim();
  }

  const requestOptions: RequestInit = {
    ...options,
    headers,
    signal: AbortSignal.timeout(API_CONFIG.TIMEOUT),
  };

  let lastError: Error | null = null;

  const method = (options.method ?? "GET").toUpperCase();
  const isSafeMethod = ["GET", "HEAD", "OPTIONS"].includes(method);

  for (let attempt = 1; attempt <= API_CONFIG.MAX_RETRIES; attempt++) {
    try {
      logger.debug(
        `API Request attempt ${attempt}: ${options.method ?? "GET"} ${url}`,
      );

      const response = await fetch(url, requestOptions);
      const duration = Date.now() - startTime;

      if (!response.ok) {
        let errorData: {
          error?: string;
          requestId?: string;
          code?: string;
          type?: string;
        };
        try {
          // Try to parse as JSON first
          const jsonData: unknown = await response.json();
          errorData =
            typeof jsonData === "object" && jsonData !== null
              ? (jsonData as {
                  error?: string;
                  requestId?: string;
                  code?: string;
                  type?: string;
                })
              : {};
        } catch {
          // Fallback to text
          const errorText = await response.text().catch(() => "Unknown error");
          errorData = { error: errorText };
        }

        // Create a structured error
        const error = new Error(
          errorData.error ?? `HTTP ${response.status}: ${response.statusText}`,
        ) as Error & {
          status: number;
          requestId?: string;
          code?: string;
          type?: string;
        };

        Object.assign(error, {
          status: response.status,
          ...(errorData.requestId && { requestId: errorData.requestId }),
          ...(errorData.code && { code: errorData.code }),
          ...(errorData.type && { type: errorData.type }),
        });

        throw error;
      }

      const data: unknown = await response.json();
      logger.apiCall(options.method ?? "GET", url, response.status, duration);

      return data;
    } catch (error) {
      lastError = error as Error;
      const duration = Date.now() - startTime;

      logger.warn(
        `API request failed (attempt ${attempt}/${API_CONFIG.MAX_RETRIES})`,
        {
          url,
          error: lastError.message,
          duration,
        },
      );

      // Check if error is retryable
      if (
        isSafeMethod &&
        attempt < API_CONFIG.MAX_RETRIES &&
        isRetryableError(lastError)
      ) {
        const delay = API_CONFIG.RETRY_DELAY * attempt;
        logger.debug(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }

  logger.error(`API request failed after ${API_CONFIG.MAX_RETRIES} attempts`, {
    url,
    error: lastError?.message,
  });

  throw lastError ?? new Error("API error. Please try again later.");
}

// Make authenticated request with UUID header
export async function makeAuthenticatedApiRequest(
  endpoint: string,
  options: RequestInit = {},
): Promise<unknown> {
  const uuid = await getExtensionUuid();

  if (!uuid) {
    throw new Error("Extension not authenticated. Please login with Discord.");
  }

  const headers = {
    ...((options.headers as Record<string, string>) || {}),
    "X-Extension-UUID": uuid,
  };

  try {
    return await makeApiRequest(endpoint, {
      ...options,
      headers,
    });
  } catch (error) {
    const err = error as Error & { status?: number };

    // Clear stored UUID if backend invalidated it due to IP address mismatch
    if (err.status === 403 && err.message.includes("UUID invalidated")) {
      await browser.storage.local.remove(["extension_uuid"]);
      logger.info("Stored UUID cleared due to invalidation");
    }

    throw error;
  }
}
