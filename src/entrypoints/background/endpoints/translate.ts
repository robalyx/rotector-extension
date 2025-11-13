import type { TranslationResult } from '@/lib/types/api';
import { logger } from '@/lib/utils/logger';

// Google Translate API response format
type GoogleTranslateSegment = [string, string, null, null, number];
type GoogleTranslateResponse = [GoogleTranslateSegment[], null, string, ...unknown[]];

// Cache entry with timestamp for TTL
interface CacheEntry {
	translation: string;
	timestamp: number;
}

// LRU + TTL cache for translations
const MAX_CACHE_SIZE = 100;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const translationCache = new Map<string, CacheEntry>();

// Generate cache key
function getCacheKey(text: string, targetLanguage: string, sourceLanguage: string): string {
	return `${sourceLanguage}->${targetLanguage}:${text}`;
}

// Get cached translation with TTL check
function getCachedTranslation(
	text: string,
	targetLanguage: string,
	sourceLanguage: string
): string | null {
	const key = getCacheKey(text, targetLanguage, sourceLanguage);
	const entry = translationCache.get(key);

	if (!entry) return null;

	// Check if entry has expired
	if (Date.now() - entry.timestamp >= CACHE_TTL) {
		translationCache.delete(key);
		return null;
	}

	return entry.translation;
}

// Set cached translation with LRU eviction
function setCachedTranslation(
	text: string,
	targetLanguage: string,
	sourceLanguage: string,
	translation: string
): void {
	const key = getCacheKey(text, targetLanguage, sourceLanguage);

	// If cache is full and this is a new entry, evict oldest
	if (translationCache.size >= MAX_CACHE_SIZE && !translationCache.has(key)) {
		const oldestKey = translationCache.keys().next().value;
		if (oldestKey !== undefined) {
			translationCache.delete(oldestKey);
		}
	}

	// Store translation with current timestamp
	translationCache.set(key, {
		translation,
		timestamp: Date.now()
	});
}

// Translate multiple texts in a batch request using delimiter
async function translateBatch(
	texts: string[],
	targetLanguage: string,
	sourceLanguage: string = 'en'
): Promise<Record<string, string>> {
	const DELIMITER = '|||';

	// Check if any text contains the delimiter
	const hasCollision = texts.some((text) => text.includes(DELIMITER));

	if (hasCollision) {
		logger.warn('Delimiter collision detected, falling back to parallel requests');
		return translateParallel(texts, targetLanguage, sourceLanguage);
	}

	// Combine texts with delimiter
	const combinedText = texts.join(DELIMITER);

	const params = new URLSearchParams({
		client: 'gtx',
		sl: sourceLanguage,
		tl: targetLanguage,
		dt: 't',
		q: combinedText
	});

	const url = `https://translate.googleapis.com/translate_a/single?${params.toString()}`;

	logger.debug('Batch translating texts with delimiter', {
		count: texts.length,
		from: sourceLanguage,
		to: targetLanguage
	});

	const response = await fetch(url, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Translation API returned status ${response.status}`);
	}

	const data = (await response.json()) as GoogleTranslateResponse;

	// Validate response structure
	if (!Array.isArray(data) || !Array.isArray(data[0]) || !Array.isArray(data[0][0])) {
		throw new Error('Invalid translation response format');
	}

	// Extract the translated combined text
	// Response format: [[["translated text", "original text", null, null, 3]], null, "en"]
	const translatedCombined = data[0][0][0];

	if (!translatedCombined) {
		throw new Error('No translation returned');
	}

	// Split translated text by delimiter
	const translatedParts = translatedCombined.split(DELIMITER);

	// Validate we got the expected number of parts
	if (translatedParts.length !== texts.length) {
		logger.warn('Translation part count mismatch', {
			expected: texts.length,
			received: translatedParts.length
		});
	}

	const translations: Record<string, string> = {};

	// Map translated parts back to original texts
	for (let i = 0; i < texts.length; i++) {
		const originalText = texts[i];
		const translatedText = (translatedParts[i] || originalText).trim();

		translations[originalText] = translatedText;

		// Cache the successful translation
		setCachedTranslation(originalText, targetLanguage, sourceLanguage, translatedText);
	}

	logger.debug('Batch translation successful', {
		count: texts.length
	});

	return translations;
}

// Translate texts in parallel using individual requests
async function translateParallel(
	texts: string[],
	targetLanguage: string,
	sourceLanguage: string = 'en'
): Promise<Record<string, string>> {
	logger.debug('Translating texts in parallel', {
		count: texts.length,
		from: sourceLanguage,
		to: targetLanguage
	});

	// Create promises for all translations
	const promises = texts.map(async (text) => {
		const params = new URLSearchParams({
			client: 'gtx',
			sl: sourceLanguage,
			tl: targetLanguage,
			dt: 't',
			q: text
		});

		const url = `https://translate.googleapis.com/translate_a/single?${params.toString()}`;

		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(
				`Translation API returned status ${response.status} for text: ${text.substring(0, 50)}`
			);
		}

		const data = (await response.json()) as GoogleTranslateResponse;
		const translated = data[0]?.[0]?.[0];

		if (!translated) {
			throw new Error(`No translation returned for text: ${text.substring(0, 50)}`);
		}

		setCachedTranslation(text, targetLanguage, sourceLanguage, translated);
		return { text, translation: translated };
	});

	// Wait for all translations to complete
	const results = await Promise.all(promises);

	// Build translations map
	const translations: Record<string, string> = {};
	for (const { text, translation } of results) {
		translations[text] = translation;
	}

	logger.debug('Parallel translation successful', {
		count: texts.length
	});

	return translations;
}

// Translate multiple texts
export async function translateTexts(
	texts: string[],
	targetLanguage: string,
	sourceLanguage: string = 'en'
): Promise<TranslationResult> {
	if (texts?.length === 0) {
		throw new Error('No texts provided for translation');
	}

	if (!targetLanguage) {
		throw new Error('Target language is required');
	}

	// Normalize language codes
	const normalizedTarget = targetLanguage.split('-')[0].toLowerCase();
	const normalizedSource =
		sourceLanguage === 'auto' ? 'auto' : sourceLanguage.split('-')[0].toLowerCase();

	// If source and target are the same, return original texts
	if (normalizedSource !== 'auto' && normalizedSource === normalizedTarget) {
		const translations: Record<string, string> = {};
		for (const text of texts) {
			translations[text] = text;
		}
		return { translations };
	}

	logger.info('Translating texts', {
		count: texts.length,
		from: normalizedSource,
		to: normalizedTarget
	});

	const translations: Record<string, string> = {};
	const uncachedTexts: string[] = [];

	// Separate cached vs uncached texts
	for (const text of texts) {
		if (!text || text.trim() === '') {
			translations[text] = text;
			continue;
		}

		const cached = getCachedTranslation(text, normalizedTarget, normalizedSource);
		if (cached) {
			translations[text] = cached;
			logger.debug('Translation cache hit', { text: text.substring(0, 50) });
		} else {
			uncachedTexts.push(text);
		}
	}

	// Batch translate all uncached texts
	if (uncachedTexts.length > 0) {
		const batchTranslations = await translateBatch(
			uncachedTexts,
			normalizedTarget,
			normalizedSource
		);
		Object.assign(translations, batchTranslations);
	}

	return { translations };
}
