import type {
  DiscordAuthUrlResponse,
  ExtensionReportsResponse,
  ExtensionStatistics,
  ExtensionUserProfile,
  ExtensionUserReport,
  LeaderboardResponse,
  ReportableUserResponse,
} from "@/lib/types/api";
import { API_CONFIG } from "@/lib/types/constants";
import { makeApiRequest, makeAuthenticatedApiRequest } from "../api-client";
import { extractResponseData } from "../utils";

// Get the current user's profile
export async function getExtensionProfile(): Promise<ExtensionUserProfile> {
  const response = await makeAuthenticatedApiRequest(
    API_CONFIG.ENDPOINTS.EXTENSION_PROFILE,
    {
      method: "GET",
    },
  );

  return extractResponseData<ExtensionUserProfile>(response);
}

// Update the current user's anonymous status
export async function updateExtensionAnonymous(
  isAnonymous: boolean,
): Promise<ExtensionUserProfile> {
  const response = await makeAuthenticatedApiRequest(
    API_CONFIG.ENDPOINTS.EXTENSION_PROFILE_ANONYMOUS,
    {
      method: "PATCH",
      body: JSON.stringify({ isAnonymous }),
    },
  );

  return extractResponseData<ExtensionUserProfile>(response);
}

// Reset the current user's UUID (logs out all other devices)
export async function resetExtensionUuid(): Promise<{
  uuid: string;
  message: string;
}> {
  const response = await makeAuthenticatedApiRequest(
    API_CONFIG.ENDPOINTS.EXTENSION_RESET_UUID,
    {
      method: "POST",
    },
  );

  return extractResponseData<{ uuid: string; message: string }>(response);
}

// Get Discord OAuth login URL
export async function getDiscordLoginUrl(): Promise<DiscordAuthUrlResponse> {
  const response = await makeApiRequest(
    API_CONFIG.ENDPOINTS.EXTENSION_AUTH_LOGIN,
    {
      method: "GET",
    },
  );

  return extractResponseData<DiscordAuthUrlResponse>(response);
}

// Submit a user report
export async function submitExtensionReport(
  reportedUserId: number,
  reportReason?: string,
): Promise<ExtensionUserReport> {
  const requestBody: Record<string, unknown> = {
    reportedUserId,
  };

  if (reportReason) {
    requestBody.reportReason = reportReason;
  }

  const response = await makeAuthenticatedApiRequest(
    API_CONFIG.ENDPOINTS.EXTENSION_REPORT,
    {
      method: "POST",
      body: JSON.stringify(requestBody),
    },
  );

  return extractResponseData<ExtensionUserReport>(response);
}

// Get user's historical reports
export async function getExtensionReports(
  limit?: number,
  offset?: number,
  status?: "pending" | "confirmed" | "rejected",
): Promise<ExtensionReportsResponse> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.set("limit", String(limit));
  if (offset !== undefined) params.set("offset", String(offset));
  if (status !== undefined) params.set("status", status);

  const queryString = params.toString();
  const url = queryString
    ? `${API_CONFIG.ENDPOINTS.EXTENSION_REPORTS}?${queryString}`
    : API_CONFIG.ENDPOINTS.EXTENSION_REPORTS;
  const response = await makeAuthenticatedApiRequest(url, {
    method: "GET",
  });

  return extractResponseData<ExtensionReportsResponse>(response);
}

// Get extension statistics
export async function getExtensionStatistics(): Promise<ExtensionStatistics> {
  const response = await makeApiRequest(
    API_CONFIG.ENDPOINTS.EXTENSION_STATISTICS,
    {
      method: "GET",
    },
  );

  return extractResponseData<ExtensionStatistics>(response);
}

// Get the leaderboard
export async function getLeaderboard(
  limit?: number,
  includeAnonymous?: boolean,
): Promise<LeaderboardResponse> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.set("limit", String(limit));
  if (includeAnonymous !== undefined)
    params.set("includeAnonymous", String(includeAnonymous));

  const queryString = params.toString();
  const url = queryString
    ? `${API_CONFIG.ENDPOINTS.EXTENSION_LEADERBOARD}?${queryString}`
    : API_CONFIG.ENDPOINTS.EXTENSION_LEADERBOARD;
  const response = await makeApiRequest(url, {
    method: "GET",
  });

  return extractResponseData<LeaderboardResponse>(response);
}

// Get a random reportable user for the authenticated extension user
export async function getReportableUser(): Promise<ReportableUserResponse> {
  const response = await makeAuthenticatedApiRequest(
    API_CONFIG.ENDPOINTS.EXTENSION_USERS_REPORTABLE,
    {
      method: "GET",
    },
  );

  return extractResponseData<ReportableUserResponse>(response);
}
