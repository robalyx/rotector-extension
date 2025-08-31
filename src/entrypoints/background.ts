import {SETTINGS_DEFAULTS, SETTINGS_KEYS} from '@/lib/types/settings';
import {API_ACTIONS, API_CONFIG, INTEGRATION_SOURCES, STATUS, VOTE_TYPES, type VoteType} from '@/lib/types/constants';
import type {
    ApiResponse,
    ContentMessage,
    GroupStatus,
    QueueResult,
    UserStatus,
    VoteData,
    VoteResult
} from '@/lib/types/api';
import type {Statistics} from '@/lib/types/statistics';
import {logger} from '@/lib/utils/logger';
import {extractErrorMessage, sanitizeEntityId} from '@/lib/utils/sanitizer';

// Validates and sanitizes an entity ID (user or group)
function validateEntityId(entityId: string | number): string {
    const sanitized = sanitizeEntityId(entityId);
    if (!sanitized) {
        throw new Error('Invalid entity ID');
    }
    return sanitized;
}

// Extracts response data from API responses
function extractResponseData<T>(response: unknown): T {
    if (typeof response === 'object' && response !== null && 'data' in response) {
        return (response as { data: T }).data;
    }
    return response as T;
}

// Processes and validates batch entity IDs
function processBatchEntityIds(entityIds: Array<string | number>): string[] {
    const sanitized = entityIds
        .map(id => sanitizeEntityId(id))
        .filter((id): id is string => id !== null);

    if (sanitized.length === 0) {
        throw new Error("No valid entity IDs provided for batch check");
    }
    return sanitized;
}

// Gets the advanced violation info setting from storage
async function getExcludeAdvancedInfoSetting(): Promise<boolean> {
    const settings = await browser.storage.sync.get([SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED]);
    return !settings[SETTINGS_KEYS.ADVANCED_VIOLATION_INFO_ENABLED];
}

// Gets the BloxDB integration setting from storage
async function getBloxdbIntegrationSetting(): Promise<boolean> {
    const settings = await browser.storage.sync.get([SETTINGS_KEYS.BLOXDB_INTEGRATION_ENABLED]);
    return settings[SETTINGS_KEYS.BLOXDB_INTEGRATION_ENABLED] !== false; // Default to true if not set
}

// Creates a standardized error response with optional error properties
function createErrorResponse(error: Error): ApiResponse & { requestId?: string; code?: string; type?: string } {
    const errorMessage = extractErrorMessage(error);
    const errorObj = error as Error & { requestId?: string; code?: string; type?: string };

    return {
        success: false,
        error: errorMessage,
        ...(errorObj.requestId && {requestId: errorObj.requestId}),
        ...(errorObj.code && {code: errorObj.code}),
        ...(errorObj.type && {type: errorObj.type})
    };
}

export default defineBackground(() => {
    logger.info('Rotector Background Script: Starting...', {id: browser.runtime.id});

    initializeSettings().catch(err => {
        logger.error('Failed to initialize settings:', err);
    });

    browser.runtime.onMessage.addListener((
        request: ContentMessage,
        _sender: unknown,
        sendResponse: (response: ApiResponse) => void
    ) => {
        void (async () => {
            try {
                let response: unknown;

                switch (request.action) {
                    case API_ACTIONS.CHECK_USER_STATUS:
                        if (!request.userId) {
                            throw new Error('User ID is required for check user status');
                        }
                        response = await checkUserStatus(request.userId);
                        break;
                    case API_ACTIONS.CHECK_GROUP_STATUS:
                        if (!request.groupId) {
                            throw new Error('Group ID is required for check group status');
                        }
                        response = await checkGroupStatus(request.groupId);
                        break;
                    case API_ACTIONS.CHECK_MULTIPLE_USERS:
                        if (!request.userIds) {
                            throw new Error('User IDs are required for check multiple users');
                        }
                        response = await checkMultipleUsers(request.userIds);
                        break;
                    case API_ACTIONS.CHECK_MULTIPLE_GROUPS:
                        if (!request.groupIds) {
                            throw new Error('Group IDs are required for check multiple groups');
                        }
                        response = await checkMultipleGroups(request.groupIds);
                        break;
                    case API_ACTIONS.QUEUE_USER:
                        if (!request.userId) {
                            throw new Error('User ID is required for queue user');
                        }
                        response = await queueUser(request.userId, request.inappropriateOutfit, request.inappropriateProfile, request.inappropriateFriends, request.inappropriateGroups);
                        break;
                    case API_ACTIONS.SUBMIT_VOTE:
                        if (!request.userId || !request.voteType) {
                            throw new Error('User ID and vote type are required for submit vote');
                        }
                        response = await submitVote(request.userId, request.voteType);
                        break;
                    case API_ACTIONS.GET_VOTES:
                        if (!request.userId) {
                            throw new Error('User ID is required for get votes');
                        }
                        response = await getVotes(request.userId);
                        break;
                    case API_ACTIONS.GET_MULTIPLE_VOTES:
                        if (!request.userIds) {
                            throw new Error('User IDs are required for get multiple votes');
                        }
                        response = await getMultipleVotes(request.userIds);
                        break;
                    case API_ACTIONS.GET_STATISTICS:
                        response = await getStatistics();
                        break;
                    default:
                        throw new Error(`Unknown action: ${request.action}`);
                }

                sendResponse({success: true, data: response});
                logger.debug(`Successfully handled action: ${request.action}`);
            } catch (error) {
                logger.error(`Background script error for action ${request.action}:`, error);
                sendResponse(createErrorResponse(error as Error));
            }
        })();

        // Return true to indicate we will respond asynchronously
        return true;
    });

    // Initialize settings on first install
    async function initializeSettings(): Promise<void> {
        try {
            const existingSettings = await browser.storage.sync.get(Object.keys(SETTINGS_DEFAULTS));
            const missingSettings: Partial<typeof SETTINGS_DEFAULTS> = {};

            for (const [key, defaultValue] of Object.entries(SETTINGS_DEFAULTS)) {
                if (!(key in existingSettings)) {
                    (missingSettings as Record<string, unknown>)[key] = defaultValue;
                }
            }

            if (Object.keys(missingSettings).length > 0) {
                await browser.storage.sync.set(missingSettings);
                logger.info('Background: Initialized missing settings', missingSettings);
            } else {
                logger.debug('Background: All settings already initialized');
            }
        } catch (error) {
            logger.error('Background: Failed to initialize settings:', error);
        }
    }

    // Get API key from settings
    async function getApiKey(): Promise<string | null> {
        try {
            const result = await browser.storage.sync.get([SETTINGS_KEYS.API_KEY]);
            const apiKey = result[SETTINGS_KEYS.API_KEY] as string | undefined;
            return typeof apiKey === 'string' ? (apiKey || null) : null;
        } catch (error) {
            logger.error('Background: Failed to get API key:', error);
            return null;
        }
    }

    // Authenticate and execute API requests
    async function makeApiRequest(endpoint: string, options: RequestInit = {}): Promise<unknown> {
        const startTime = Date.now();
        const apiKey = await getApiKey();

        // Get API base URL from settings
        const settings = await browser.storage.sync.get([SETTINGS_KEYS.API_BASE_URL]);
        const raw = typeof settings[SETTINGS_KEYS.API_BASE_URL] === 'string'
            ? (settings[SETTINGS_KEYS.API_BASE_URL] as string).trim()
            : '';
        let baseUrl = raw ? raw : API_CONFIG.BASE_URL;

        // Remove trailing slash
        baseUrl = baseUrl.replace(/\/$/, '');

        const url = `${baseUrl}${endpoint}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers as Record<string, string>
        };

        if (apiKey?.trim()) {
            headers['X-Auth-Token'] = apiKey.trim();
        }

        const requestOptions: RequestInit = {
            ...options,
            headers,
            signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
        };

        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= API_CONFIG.MAX_RETRIES; attempt++) {
            try {
                logger.debug(`API Request attempt ${attempt}: ${options.method ?? 'GET'} ${url}`);

                const response = await fetch(url, requestOptions);
                const duration = Date.now() - startTime;

                if (!response.ok) {
                    let errorData: { error?: string; requestId?: string; code?: string; type?: string };
                    try {
                        // Try to parse as JSON first
                        const jsonData: unknown = await response.json();
                        errorData = typeof jsonData === 'object' && jsonData !== null ? jsonData as {
                            error?: string;
                            requestId?: string;
                            code?: string;
                            type?: string
                        } : {};
                    } catch {
                        // Fallback to text
                        const errorText = await response.text().catch(() => 'Unknown error');
                        errorData = {error: errorText};
                    }

                    // Create a structured error
                    const error = new Error(errorData.error ?? `HTTP ${response.status}: ${response.statusText}`) as Error & {
                        status: number;
                        requestId?: string;
                        code?: string;
                        type?: string;
                    };

                    Object.assign(error, {
                        status: response.status,
                        ...(errorData.requestId && {requestId: errorData.requestId}),
                        ...(errorData.code && {code: errorData.code}),
                        ...(errorData.type && {type: errorData.type})
                    });

                    throw error;
                }

                const data: unknown = await response.json();
                logger.apiCall(options.method ?? 'GET', url, response.status, duration);

                return data;
            } catch (error) {
                lastError = error as Error;
                const duration = Date.now() - startTime;

                logger.warn(`API request failed (attempt ${attempt}/${API_CONFIG.MAX_RETRIES})`, {
                    url,
                    error: lastError.message,
                    duration
                });

                // Check if error is retryable
                if (attempt < API_CONFIG.MAX_RETRIES && isRetryableError(lastError)) {
                    const delay = API_CONFIG.RETRY_DELAY * attempt;
                    logger.debug(`Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    break;
                }
            }
        }

        logger.error(`API request failed after ${API_CONFIG.MAX_RETRIES} attempts`, {
            url,
            error: lastError?.message
        });

        throw lastError ?? new Error('API error. Please try again later.');
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

    // Check the status of a single user by ID
    async function checkUserStatus(userId: string | number): Promise<UserStatus> {
        const sanitizedUserId = validateEntityId(userId);
        const excludeInfo = await getExcludeAdvancedInfoSetting();
        const bloxdbEnabled = await getBloxdbIntegrationSetting();

        const params = new URLSearchParams();
        params.set('excludeInfo', excludeInfo.toString());

        if (!bloxdbEnabled) {
            params.set('excludeIntegrations', INTEGRATION_SOURCES.BLOXDB);
        }

        const url = `${API_CONFIG.ENDPOINTS.USER_CHECK}/${sanitizedUserId}?${params.toString()}`;
        const response = await makeApiRequest(url, {method: 'GET'});

        const data = extractResponseData<UserStatus>(response);
        data.id = data.id.toString();

        if (data.flagType === STATUS.FLAGS.SAFE) {
            data.reasons = {};
        }

        return data;
    }

    // Check the status of a single group by ID
    async function checkGroupStatus(groupId: string | number): Promise<GroupStatus> {
        const sanitizedGroupId = validateEntityId(groupId);

        const url = `${API_CONFIG.ENDPOINTS.GROUP_CHECK}/${sanitizedGroupId}`;
        const response = await makeApiRequest(url, {method: 'GET'});

        const data = extractResponseData<GroupStatus>(response);
        data.id = data.id.toString();

        if (data.flagType === STATUS.FLAGS.SAFE) {
            data.reasons = {};
        }

        return data;
    }

    // Check the status of multiple users in a batch request
    async function checkMultipleUsers(userIds: Array<string | number>): Promise<UserStatus[]> {
        const sanitizedUserIds = processBatchEntityIds(userIds);
        const excludeInfo = await getExcludeAdvancedInfoSetting();
        const bloxdbEnabled = await getBloxdbIntegrationSetting();

        const requestBody: Record<string, unknown> = {
            ids: sanitizedUserIds.map(id => parseInt(id, 10)),
            ...(excludeInfo && {excludeInfo: true})
        };

        if (!bloxdbEnabled) {
            requestBody.excludeIntegrations = [INTEGRATION_SOURCES.BLOXDB];
        }

        const response = await makeApiRequest(API_CONFIG.ENDPOINTS.MULTIPLE_USER_CHECK, {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });

        const responseData = extractResponseData<Record<string, UserStatus>>(response);
        const data = Object.values(responseData);
        data.forEach(status => {
            status.id = status.id.toString();
            if (status.flagType === STATUS.FLAGS.SAFE) {
                status.reasons = {};
            }
        });
        return data;
    }

    // Check the status of multiple groups in a batch request
    async function checkMultipleGroups(groupIds: Array<string | number>): Promise<GroupStatus[]> {
        const sanitizedGroupIds = processBatchEntityIds(groupIds);

        const requestBody = {
            ids: sanitizedGroupIds.map(id => parseInt(id, 10))
        };

        const response = await makeApiRequest(API_CONFIG.ENDPOINTS.GROUP_CHECK, {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });

        const responseData = extractResponseData<Record<string, GroupStatus>>(response);
        const data = Object.values(responseData);
        data.forEach(status => {
            status.id = status.id.toString();
            if (status.flagType === STATUS.FLAGS.SAFE) {
                status.reasons = {};
            }
        });
        return data;
    }

    // Queue a user for review by the moderation system
    async function queueUser(userId: string | number, inappropriateOutfit: boolean = false, inappropriateProfile: boolean = false, inappropriateFriends: boolean = false, inappropriateGroups: boolean = false): Promise<QueueResult> {
        const sanitizedUserId = validateEntityId(userId);

        const requestBody = {
            id: parseInt(sanitizedUserId, 10),
            ...(inappropriateOutfit !== undefined && {inappropriate_outfit: inappropriateOutfit}),
            ...(inappropriateProfile !== undefined && {inappropriate_profile: inappropriateProfile}),
            ...(inappropriateFriends !== undefined && {inappropriate_friends: inappropriateFriends}),
            ...(inappropriateGroups !== undefined && {inappropriate_groups: inappropriateGroups})
        };

        const response = await makeApiRequest(API_CONFIG.ENDPOINTS.QUEUE_USER, {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });

        return response as QueueResult;
    }

    // Submit a community vote (upvote/downvote) for a user
    async function submitVote(userId: string | number, voteType: number): Promise<VoteResult> {
        const sanitizedUserId = validateEntityId(userId);

        if (voteType !== VOTE_TYPES.UPVOTE && voteType !== VOTE_TYPES.DOWNVOTE) {
            throw new Error("Invalid vote type. Must be 1 (upvote) or -1 (downvote)");
        }

        const response = await makeApiRequest(`${API_CONFIG.ENDPOINTS.SUBMIT_VOTE}/${sanitizedUserId}`, {
            method: 'POST',
            body: JSON.stringify({voteType})
        });

        const voteData = extractResponseData<VoteData>(response);

        return {
            success: true,
            userId: sanitizedUserId.toString(),
            voteType: voteType as VoteType,
            newVoteData: voteData
        };
    }

    // Get vote data for a single user
    async function getVotes(userId: string | number): Promise<VoteData> {
        const sanitizedUserId = validateEntityId(userId);

        const response = await makeApiRequest(`${API_CONFIG.ENDPOINTS.GET_VOTES}/${sanitizedUserId}?includeVote=true`, {
            method: 'GET'
        });

        return extractResponseData<VoteData>(response);
    }

    // Get vote data for multiple users in a batch request
    async function getMultipleVotes(userIds: Array<string | number>): Promise<VoteData[]> {
        const sanitizedUserIds = processBatchEntityIds(userIds);

        const response = await makeApiRequest(`${API_CONFIG.ENDPOINTS.GET_VOTES}?includeVote=true`, {
            method: 'POST',
            body: JSON.stringify({ids: sanitizedUserIds.map(id => parseInt(id, 10))})
        });

        return extractResponseData<VoteData[]>(response);
    }

    // Get extension usage statistics
    async function getStatistics(): Promise<Statistics> {
        const response = await makeApiRequest(API_CONFIG.ENDPOINTS.GET_STATISTICS, {
            method: 'GET'
        });

        return (response as { data?: Statistics }).data ?? (response as Statistics);
    }

    logger.info('Rotector Background Script: Initialization complete');
});
