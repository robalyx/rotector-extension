import { SETTINGS_DEFAULTS, SETTINGS_KEYS } from '../lib/types/settings';
import { API_CONFIG, API_ACTIONS, MESSAGES, VOTE_TYPES, STATUS } from '../lib/types/constants';
import type { VoteType } from '../lib/types/constants';
import type { 
  UserStatus, 
  VoteData, 
  VoteResult, 
  QueueResult, 
  ApiResponse,
  ContentMessage 
} from '../lib/types/api';
import type { Statistics } from '../lib/types/statistics';
import { logger } from '../lib/utils/logger';
import { sanitizeUserId, sanitizeErrorMessage } from '../lib/utils/sanitizer';

// Validates and sanitizes a user ID
function validateUserId(userId: string | number): number {
  const sanitized = sanitizeUserId(userId);
  if (!sanitized) {
    throw new Error(MESSAGES.ERROR.INVALID_USER_ID);
  }
  return sanitized;
}

// Extracts response data from API responses
function extractResponseData<T>(response: unknown): T {
  return (response as { data?: T }).data || (response as T);
}

// Processes and validates batch user IDs
function processBatchUserIds(userIds: (string | number)[]): number[] {
  const sanitized = userIds
    .map(id => sanitizeUserId(id))
    .filter((id): id is number => id !== null);
    
  if (sanitized.length === 0) {
    throw new Error("No valid user IDs provided for batch check");
  }
  return sanitized;
}

// Gets the advanced violation info setting from storage
async function getAdvancedViolationSetting(): Promise<boolean> {
  const settings = await browser.storage.sync.get(['advancedViolationInfoEnabled']);
  return !settings.advancedViolationInfoEnabled;
}

// Creates a standardized error response with optional error properties
function createErrorResponse(error: Error): ApiResponse & { requestId?: string; code?: string; type?: string } {
  const errorMessage = sanitizeErrorMessage(error);
  const errorObj = error as Error & { requestId?: string; code?: string; type?: string };
  
  return {
    success: false,
    error: errorMessage,
    ...(errorObj.requestId && { requestId: errorObj.requestId }),
    ...(errorObj.code && { code: errorObj.code }),
    ...(errorObj.type && { type: errorObj.type })
  };
}

export default defineBackground(() => {
  logger.info('Rotector Background Script: Starting...', { id: browser.runtime.id });

  initializeSettings();

  browser.runtime.onMessage.addListener((
    request: ContentMessage, 
    _sender: unknown, 
    sendResponse: (response: ApiResponse) => void
  ) => {
    (async () => {
      try {
        let response: unknown;

        switch (request.action) {
          case API_ACTIONS.CHECK_USER_STATUS:
            if (!request.userId) {
              throw new Error('User ID is required for check user status');
            }
            response = await checkUserStatus(request.userId);
            break;
          case API_ACTIONS.CHECK_MULTIPLE_USERS:
            if (!request.userIds) {
              throw new Error('User IDs are required for check multiple users');
            }
            response = await checkMultipleUsers(request.userIds);
            break;
          case API_ACTIONS.QUEUE_USER:
            if (!request.userId) {
              throw new Error('User ID is required for queue user');
            }
            response = await queueUser(request.userId, request.inappropriateOutfit);
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

        sendResponse({ success: true, data: response });
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
      const result = await browser.storage.sync.get(['apiKey']);
      return result.apiKey || null;
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
    let baseUrl = settings[SETTINGS_KEYS.API_BASE_URL] || API_CONFIG.BASE_URL;
    
    // Remove trailing slash
    baseUrl = baseUrl.replace(/\/$/, '');
    
    const url = `${baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Rotector-Extension/2.0',
      'Accept': 'application/json',
      ...options.headers as Record<string, string>
    };

    if (apiKey && apiKey.trim()) {
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
        logger.debug(`API Request attempt ${attempt}: ${options.method || 'GET'} ${url}`);
        
        const response = await fetch(url, requestOptions);
        const duration = Date.now() - startTime;
        
        if (!response.ok) {
          let errorData: { error?: string; requestId?: string; code?: string; type?: string };
          try {
            // Try to parse as JSON first
            errorData = await response.json();
          } catch {
            // Fallback to text
            const errorText = await response.text().catch(() => 'Unknown error');
            errorData = { error: errorText };
          }
          
          // Create a structured error
          const error = new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`) as Error & { 
            status: number; 
            requestId?: string; 
            code?: string; 
            type?: string; 
          };
          
          Object.assign(error, {
            status: response.status,
            ...(errorData.requestId && { requestId: errorData.requestId }),
            ...(errorData.code && { code: errorData.code }),
            ...(errorData.type && { type: errorData.type })
          });
          
          throw error;
        }
        
        const data = await response.json();
        logger.apiCall(options.method || 'GET', url, response.status, duration);
        
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
    
    throw lastError || new Error(MESSAGES.ERROR.API_ERROR);
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
    const sanitizedUserId = validateUserId(userId);
    const excludeInfo = await getAdvancedViolationSetting();
    
    const url = `${API_CONFIG.ENDPOINTS.USER_CHECK}/${sanitizedUserId}?excludeInfo=${excludeInfo}`;
    const response = await makeApiRequest(url, { method: 'GET' });
    
    const data = extractResponseData<UserStatus>(response);
    data.id = data.id.toString();
    
    if (data.flagType === STATUS.FLAGS.SAFE) {
      data.reasons = {};
    }
    
    return data;
  }

  // Check the status of multiple users in a batch request
  async function checkMultipleUsers(userIds: (string | number)[]): Promise<UserStatus[]> {
    const sanitizedUserIds = processBatchUserIds(userIds);
    const excludeInfo = await getAdvancedViolationSetting();
    
    const requestBody = { 
      ids: sanitizedUserIds,
      ...(excludeInfo && { excludeInfo: true })
    };
    
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

  // Queue a user for review by the moderation system
  async function queueUser(userId: string | number, inappropriateOutfit: boolean = false): Promise<QueueResult> {
    const sanitizedUserId = validateUserId(userId);

    const requestBody = {
      id: sanitizedUserId,
      ...(inappropriateOutfit !== undefined && { inappropriate_outfit: inappropriateOutfit })
    };

    const response = await makeApiRequest(API_CONFIG.ENDPOINTS.QUEUE_USER, {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });
    
    return response as QueueResult;
  }

  // Submit a community vote (upvote/downvote) for a user
  async function submitVote(userId: string | number, voteType: number): Promise<VoteResult> {
    const sanitizedUserId = validateUserId(userId);

    if (voteType !== VOTE_TYPES.UPVOTE && voteType !== VOTE_TYPES.DOWNVOTE) {
      throw new Error("Invalid vote type. Must be 1 (upvote) or -1 (downvote)");
    }

    const response = await makeApiRequest(`${API_CONFIG.ENDPOINTS.SUBMIT_VOTE}/${sanitizedUserId}`, {
      method: 'POST',
      body: JSON.stringify({ voteType })
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
    const sanitizedUserId = validateUserId(userId);

    const response = await makeApiRequest(`${API_CONFIG.ENDPOINTS.GET_VOTES}/${sanitizedUserId}?includeVote=true`, {
      method: 'GET'
    });
    
    return extractResponseData<VoteData>(response);
  }

  // Get vote data for multiple users in a batch request
  async function getMultipleVotes(userIds: (string | number)[]): Promise<VoteData[]> {
    const sanitizedUserIds = processBatchUserIds(userIds);

    const response = await makeApiRequest(`${API_CONFIG.ENDPOINTS.GET_VOTES}?includeVote=true`, {
      method: 'POST',
      body: JSON.stringify({ ids: sanitizedUserIds })
    });
    
    return extractResponseData<VoteData[]>(response);
  }

  // Get extension usage statistics
  async function getStatistics(): Promise<Statistics> {
    const response = await makeApiRequest(API_CONFIG.ENDPOINTS.GET_STATISTICS, {
      method: 'GET'
    });
    
    return (response as { data?: Statistics }).data || (response as Statistics);
  }

  logger.info('Rotector Background Script: Initialization complete');
});
