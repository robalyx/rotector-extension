import { logger } from './logger';

/**
 * XSS prevention and data sanitization utilities
 */
class Sanitizer {
  private static readonly DANGEROUS_TAGS = [
    'script', 'iframe', 'object', 'embed', 'applet', 'form', 'input',
    'button', 'select', 'textarea', 'link', 'meta', 'style', 'base'
  ];

  private static readonly DANGEROUS_ATTRIBUTES = [
    'onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout',
    'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset'
  ];

  private static readonly DANGEROUS_PROTOCOLS = [
    'javascript',
    'vbscript',
    'data',
    'file'
  ];

  private static readonly ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'];

  // Sanitizes HTML content by removing dangerous elements and attributes
  static sanitizeHtml(html: string): string {
    try {
      // Create a temporary DOM element to parse HTML
      const temp = document.createElement('div');
      temp.innerHTML = html;

      // Remove dangerous tags
      this.DANGEROUS_TAGS.forEach(tag => {
        const elements = temp.querySelectorAll(tag);
        elements.forEach(element => element.remove());
      });

      // Remove dangerous attributes from all elements
      const allElements = temp.querySelectorAll('*');
      allElements.forEach(element => {
        // Check each attribute
        for (let i = element.attributes.length - 1; i >= 0; i--) {
          const attr = element.attributes[i];
          const attrName = attr.name.toLowerCase();
          const attrValue = attr.value.toLowerCase();

          // Remove event handlers
          if (attrName.startsWith('on')) {
            element.removeAttribute(attrName);
            continue;
          }

          // Remove dangerous attribute values
          if (this.DANGEROUS_ATTRIBUTES.some(dangerous => 
            attrName.includes(dangerous) || attrValue.includes(dangerous)
          )) {
            element.removeAttribute(attrName);
            continue;
          }

          // Validate URLs in href and src attributes
          if ((attrName === 'href' || attrName === 'src') && attr.value) {
            if (!this.isValidUrl(attr.value)) {
              element.removeAttribute(attrName);
            }
          }
        }
      });

      return temp.innerHTML;
    } catch (error) {
      logger.error('Error sanitizing HTML:', error);
      return ''; // Return empty string on error to be safe
    }
  }

  // Sanitizes text content by escaping HTML characters
  static sanitizeText(text: string): string {
    if (!text) return '';

    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  // Sanitizes display text while preserving contractions (single quotes)
  static sanitizeDisplayText(text: string): string {
    if (!text) return '';

    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    // Note: Single quotes preserved for readable contractions like "don't", "can't"
  }

  // Checks if a URL has a dangerous protocol
  private static hasDangerousProtocol(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    return this.DANGEROUS_PROTOCOLS.some(protocol => 
      lowerUrl.startsWith(`${protocol}:`)
    );
  }

  // Validates if a URL is safe to use
  static isValidUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;

    try {
      const urlObj = new URL(url, window.location.origin);
      
      // Check if protocol is allowed
      if (!this.ALLOWED_PROTOCOLS.includes(urlObj.protocol)) {
        return false;
      }

      // Reject dangerous URLs
      if (this.hasDangerousProtocol(url)) {
        return false;
      }

      return true;
    } catch {
      // If URL parsing fails, consider it invalid
      return false;
    }
  }

  // Sanitizes user ID input
  static sanitizeUserId(userId: string | number): number | null {
    try {
      const parsed = typeof userId === 'string' ? parseInt(userId, 10) : userId;
      
      // Validate range (Roblox user IDs are positive integers)
      if (isNaN(parsed) || parsed <= 0 || parsed > Number.MAX_SAFE_INTEGER) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  // Sanitizes username input
  static sanitizeUsername(username: string): string {
    if (!username || typeof username !== 'string') return '';

    // Remove non-alphanumeric characters except underscores
    return username
      .replace(/[^a-zA-Z0-9_]/g, '')
      .slice(0, 20);
  }

  // Sanitizes API key input
  static sanitizeApiKey(apiKey: string): string {
    if (!apiKey || typeof apiKey !== 'string') return '';

    // Remove whitespace and keep only hex characters
    const cleaned = apiKey.trim().replace(/[^a-fA-F0-9]/g, '');
    
    // Basic length validation
    if (cleaned.length < 16 || cleaned.length > 128) {
      throw new Error('Invalid API key format');
    }

    return cleaned;
  }

  // Sanitizes CSS class names
  static sanitizeCssClass(className: string): string {
    if (!className || typeof className !== 'string') return '';

    // Remove invalid CSS class characters
    return className
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .replace(/^[0-9-]/, '') 
      .slice(0, 50);
  }

  // Sanitizes DOM selector strings
  static sanitizeSelector(selector: string): string {
    if (!selector || typeof selector !== 'string') return '';

    // Basic selector sanitization
    return selector
      .replace(/[;-><>;+~]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
  }

  // Validates and sanitizes confidence percentage
  static sanitizeConfidence(confidence: number | string): number {
    const parsed = typeof confidence === 'string' ? parseFloat(confidence) : confidence;
    
    if (isNaN(parsed)) return 0;
    
    return Math.max(0, Math.min(100, parsed));
  }

  // Validates vote type
  static validateVoteType(voteType: number): boolean {
    return voteType === 1 || voteType === -1;
  }

  // Sanitizes error messages for user display
  static sanitizeErrorMessage(error: unknown): string {
    if (!error) return 'An unknown error occurred';

    let message: string;
    
    if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object') {
      const errorObj = error as Record<string, unknown>;
      if (typeof errorObj.message === 'string') {
        message = errorObj.message;
      } else if (typeof errorObj.error === 'string') {
        message = errorObj.error;
      } else {
        message = 'An unknown error occurred';
      }
    } else {
      message = 'An unknown error occurred';
    }

    const sanitized = this.sanitizeText(message);
    
    return sanitized.length > 200 ? `${sanitized.slice(0, 200)  }...` : sanitized;
  }

  // Creates a safe DOM element with sanitized content
  static createSafeElement(
    tagName: string, 
    content?: string, 
    attributes?: Record<string, string>
  ): HTMLElement {
    // Validate tag name
    if (this.DANGEROUS_TAGS.includes(tagName.toLowerCase())) {
      throw new Error(`Dangerous tag name: ${tagName}`);
    }

    const element = document.createElement(tagName);

    // Set sanitized content
    if (content) {
      element.textContent = content;
    }

    // Set sanitized attributes
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        const sanitizedKey = key.toLowerCase();
        
        // Skip dangerous attributes
        if (sanitizedKey.startsWith('on') || 
            this.DANGEROUS_ATTRIBUTES.some(dangerous => sanitizedKey.includes(dangerous))) {
          logger.warn(`Skipping dangerous attribute: ${key}`);
          return;
        }

        // Validate URLs
        if ((sanitizedKey === 'href' || sanitizedKey === 'src') && !this.isValidUrl(value)) {
          logger.warn(`Skipping invalid URL in ${key}: ${value}`);
          return;
        }

        element.setAttribute(key, this.sanitizeText(value));
      });
    }

    return element;
  }

  // Validates JSON data structure
  static validateJsonStructure(data: unknown, expectedKeys: string[]): boolean {
    if (!data || typeof data !== 'object') return false;

    const dataObj = data as Record<string, unknown>;
    // Check if all expected keys are present
    return expectedKeys.every(key => key in dataObj);
  }

  // Deep clones an object while sanitizing string values
  static sanitizeObjectStrings(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    
    if (typeof obj === 'string') {
      return this.sanitizeText(obj);
    }
    
    if (typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObjectStrings(item));
    }
    
    const sanitized: Record<string, unknown> = {};
    const objRecord = obj as Record<string, unknown>;
    for (const [key, value] of Object.entries(objRecord)) {
      sanitized[this.sanitizeText(key)] = this.sanitizeObjectStrings(value);
    }
    
    return sanitized;
  }
  
  // Sanitizes URL for security validation
  static sanitizeUrl(url: string): string | null {
    if (!url || typeof url !== 'string') return null;

    try {
      const parsed = new URL(url);
      
      // Only allow http/https protocols
      if (!this.ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        return null;
      }

      // Check for roblox domain
      if (!parsed.hostname.includes('roblox.com')) {
        return null;
      }

      return parsed.href;
    } catch {
      return null;
    }
  }
}

export const sanitizeText = (text: string) => Sanitizer.sanitizeText(text);
export const sanitizeDisplayText = (text: string) => Sanitizer.sanitizeDisplayText(text);
export const sanitizeUserId = (userId: string | number) => Sanitizer.sanitizeUserId(userId);
export const sanitizeErrorMessage = (error: unknown) => Sanitizer.sanitizeErrorMessage(error);
export const sanitizeUrl = (url: string) => Sanitizer.sanitizeUrl(url); 